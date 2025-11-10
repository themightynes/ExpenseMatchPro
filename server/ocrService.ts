import { createWorker } from 'tesseract.js';
import { getStorage } from './storageFactory';
import type { IStorageService } from './storageFactory';
import Anthropic from '@anthropic-ai/sdk';
import FormData from 'form-data';
import fetch from 'node-fetch';

interface ExtractedReceiptData {
  merchant?: string;
  amount?: string;
  date?: string;
  category?: string;
  total?: string;
  items?: string[];
  // Transportation-specific fields
  fromAddress?: string;
  toAddress?: string;
  tripDistance?: string;
  tripDuration?: string;
  driverName?: string;
  vehicleInfo?: string;
  paymentMethod?: string;
  tipAmount?: string;
  subtotal?: string;
  fees?: string[];
}

export interface ExtractionResult {
  ocrText: string;
  extractedData: ExtractedReceiptData;
  extractionMethod: 'claude' | 'tesseract';
  confidence: number;
}

export class OCRService {
  private objectStorage: IStorageService;
  private tesseractWorker: any = null;
  private anthropicClient: Anthropic | null = null;

  constructor() {
    // Use storage factory to get the appropriate storage service
    this.objectStorage = getStorage();
    
    // Initialize Anthropic client if API key is available
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      console.log('✅ Claude Vision API client initialized');
    } else {
      console.warn('⚠️  ANTHROPIC_API_KEY not set - Claude Vision will be unavailable, using Tesseract only');
    }
  }

  /**
   * Initialize Tesseract worker for image OCR
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, description: string): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${description} timed out after ${timeoutMs / 1000}s`));
        }, timeoutMs).unref?.();
      });

      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  private async initTesseract() {
    if (!this.tesseractWorker) {
      console.log('Initializing Tesseract worker...');
      this.tesseractWorker = await createWorker('eng');
      await this.tesseractWorker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,/$-:',
      });
      console.log('Tesseract worker initialized');
    }
    return this.tesseractWorker;
  }

  /**
   * Extract text from PDF by trying multiple approaches
   */
  private async extractPdfText(buffer: Buffer): Promise<string> {
    try {
      console.log('PDF processing: Attempting text extraction...');
      
      // First try: Direct PDF text extraction using pdf-parse (Node.js compatible)
      try {
        console.log('Attempting direct PDF text extraction using pdf-parse...');
        const pdfParseModule = await import('pdf-parse');
        const pdfParse = pdfParseModule.default || pdfParseModule;
        
        // Configure pdf-parse options based on documentation:
        // - max: 0 = parse all pages (receipts can span multiple pages)
        // - version: 'default' uses the default PDF.js version
        const options = {
          max: 0, // Parse all pages (receipts can be multi-page, especially hotel folios)
        };
        
        // Ensure buffer is a proper Buffer instance
        // pdf-parse can be sensitive to buffer types, so ensure it's a native Node.js Buffer
        let pdfBuffer: Buffer;
        if (Buffer.isBuffer(buffer)) {
          // Create a fresh copy to avoid any potential issues with shared buffers
          pdfBuffer = Buffer.allocUnsafe(buffer.length);
          buffer.copy(pdfBuffer);
        } else {
          pdfBuffer = Buffer.from(buffer);
        }
        
        // Verify it's a valid PDF by checking magic bytes
        if (pdfBuffer[0] !== 0x25 || pdfBuffer[1] !== 0x50 || pdfBuffer[2] !== 0x44 || pdfBuffer[3] !== 0x46) {
          throw new Error('Buffer does not appear to be a valid PDF (missing PDF magic bytes)');
        }
        
        const data = await this.withTimeout(
          pdfParse(pdfBuffer, options),
          60000,
          'PDF text extraction'
        );
        
        // Log detailed parsing results for debugging
        console.log(`PDF parsed successfully. Total pages: ${data.numpages}, Rendered pages: ${data.numrender}, Text length: ${data.text?.length || 0}`);
        
        // Check if we got substantial text (> 200 chars indicates successful extraction)
        // Lower threshold (50) was too lenient and could return partial/empty results
        if (data.text && data.text.trim().length > 200) {
          console.log(`Direct PDF text extraction successful. Extracted ${data.text.length} characters`);
          return data.text.trim();
        }
        
        // If we got some text but not enough, log it for debugging
        if (data.text && data.text.trim().length > 0) {
          console.log(`Direct PDF text extraction returned minimal text (${data.text.trim().length} chars): "${data.text.trim().substring(0, 100)}..." - trying OCR conversion...`);
        } else {
          console.log('Direct PDF text extraction returned empty text - PDF may be image-based or corrupted, trying OCR conversion...');
        }
      } catch (directError) {
        const errorMessage = directError instanceof Error ? directError.message : 'Unknown error';
        // Enhanced error logging based on documentation patterns
        if (errorMessage.includes('Invalid PDF') || errorMessage.includes('password')) {
          console.log(`Direct PDF text extraction failed (${errorMessage}), falling back to OCR conversion`);
        } else {
          console.log(`Direct PDF text extraction failed, falling back to OCR conversion: ${errorMessage}`);
        }
      }
      
      // Second try: Convert PDF to image using modern libraries (2024-2025 solutions)
      console.log('PDF processing: Converting PDF to images for OCR extraction...');
      
      // Try pdf-to-png-converter first (most reliable according to recent research)
      try {
        console.log('Attempting PDF conversion with pdf-to-png-converter...');
        const { pdfToPng } = await import('pdf-to-png-converter');
        
        // Process first 3 pages (most receipts are 1-3 pages, but some can be longer)
        // This balances performance with completeness for multi-page receipts
        const pngPages = await this.withTimeout(
          pdfToPng(buffer, {
            disableFontFace: false,
            useSystemFonts: false,
            pagesToProcess: [1, 2, 3], // Process first 3 pages for multi-page receipts
            viewportScale: 2.0
          }),
          90000, // Increased timeout for multiple pages
          'PDF to PNG conversion'
        );

        if (pngPages && pngPages.length > 0) {
          // Combine text from all converted pages for multi-page receipts
          let combinedText = '';
          for (const page of pngPages) {
            if (page.content) {
              console.log(`PDF conversion successful for page ${page.pageNumber}. Buffer size: ${page.content.length} bytes`);
              const pageText = await this.withTimeout(
                this.extractImageText(page.content),
                90000,
                `Image text extraction after pdf-to-png (page ${page.pageNumber})`
              );
              combinedText += (combinedText ? `\n\n--- Page ${page.pageNumber} ---\n\n` : '') + pageText;
            }
          }
          if (combinedText.trim().length > 0) {
            return combinedText;
          }
        }
      } catch (pngConverterError) {
        console.log('pdf-to-png-converter failed:', pngConverterError instanceof Error ? pngConverterError.message : 'Unknown error');
      }

      // Fallback: Try pdf2pic with enhanced settings
      try {
        console.log('Falling back to pdf2pic with enhanced options...');
        const { fromBuffer } = await import('pdf2pic');
        
        // Enhanced conversion settings based on research
        const conversionSettings = [
          { density: 300, format: "png", quality: 100, width: 2550, height: 3300 },
          { density: 200, format: "jpeg", quality: 95 },
          { density: 150, format: "png", quality: 90 }
        ];
        
        for (const settings of conversionSettings) {
          try {
            console.log(`Trying PDF conversion with enhanced settings:`, settings);
            
            const convert = fromBuffer(buffer, {
              ...settings,
              saveFilename: "receipt",
              savePath: "/tmp",
              preserveAspectRatio: true
            });
            
            const result = await this.withTimeout(
              convert(1, { responseType: "buffer" }),
              60000,
              'PDF conversion via pdf2pic'
            );
            
            if (result?.buffer && result.buffer.length > 10000) {
              console.log(`PDF conversion successful with ${settings.format}. Buffer size: ${result.buffer.length} bytes`);
              return await this.withTimeout(
                this.extractImageText(result.buffer),
                90000,
                'Image text extraction after pdf2pic'
              );
            } else {
              console.log(`Conversion with ${settings.format} produced small buffer: ${result?.buffer?.length || 0} bytes`);
            }
          } catch (conversionError) {
            const errorMessage = conversionError instanceof Error ? conversionError.message : 'Unknown error';
            console.log(`Conversion failed with ${settings.format}:`, errorMessage);
            continue;
          }
        }
      } catch (pdf2picError) {
        console.log('pdf2pic fallback failed:', pdf2picError instanceof Error ? pdf2picError.message : 'Unknown error');
      }
      
      return "PDF processing: Unable to extract text from this PDF. The enhanced Uber detection system works best with image receipts (PNG/JPG). For optimal results with Uber receipts, please upload as an image format, or enter the details manually for accurate AMEX matching.";
      
    } catch (error) {
      console.error('Error processing PDF:', error);
      return "PDF processing failed. For Uber receipts, try uploading as an image format (PNG/JPG) which works better with our enhanced transportation detection, or enter details manually.";
    }
  }

  /**
   * Extract text from image using Tesseract.js with enhanced buffer validation
   */
  private async extractImageText(buffer: Buffer): Promise<string> {
    try {
      // Enhanced buffer validation based on 2024-2025 best practices
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error('Invalid or empty image buffer');
      }
      
      // Additional validation for minimum viable image size
      if (buffer.length < 1000) {
        throw new Error('Image buffer too small to be valid');
      }
      
      const worker = await this.initTesseract();

      const result = await this.withTimeout(
        worker.recognize(buffer),
        120000,
        'Image text extraction'
      );
      const { data: { text } } = result as any;
      
      return text || '';
    } catch (error) {
      console.error('Error with text extraction:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to extract text from image: ${errorMessage}`);
    }
  }

  /**
   * Parse receipt information from OCR text
   */
  private parseReceiptData(text: string): ExtractedReceiptData {
    // Handle fallback guidance messages - don't try to parse them
    if (text.includes("manual entry") || 
        text.includes("text extraction failed") || 
        text.includes("minimal readable text") ||
        text.includes("PDF processing:") ||
        text.includes("PDF text extraction failed") ||
        text.includes("PDF processing failed") ||
        text.includes("Unable to convert PDF") ||
        text.includes("password-protected") ||
        text.includes("corrupted") ||
        text.length < 20) { // Very short text likely error messages
      return {
        items: []
        // Don't set merchant or other fields for guidance messages
      };
    }

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Check if this is an Uber receipt first
    const isUberReceipt = this.detectUberReceipt(text);
    
    if (isUberReceipt) {
      console.log('Uber receipt detected, using specialized extraction...');
      return this.extractUberData(text, lines);
    }
    
    const data: ExtractedReceiptData = {
      items: []
    };

    // Common merchant patterns - enhanced for PDF text
    const merchantPatterns = [
      /^([A-Z][A-Za-z\s&'.-]{2,40})/,
      /\b([A-Z][A-Za-z\s&'.-]{3,35})\b.*(?:restaurant|cafe|store|shop|market|pharmacy|gas|inc|llc|corp|ltd)/i,
      /(?:merchant|business|store|company):?\s*([A-Za-z\s&'.-]{3,35})/i,
      /^([A-Za-z\s&'.-]{3,35}(?:\s+(?:inc|llc|corp|ltd|restaurant|cafe|store|shop))?)/im,
    ];

    // Amount patterns (looking for totals) - enhanced for PDF text
    const amountPatterns = [
      /(?:total|amount due|balance|sum|grand total|final total):?\s*\$?(\d+\.?\d{0,2})/i,
      /\$(\d+\.\d{2})(?:\s|$|total)/,
      /(\d+\.\d{2})\s*(?:total|due|amount|usd|dollars?)/i,
      /(?:total amount|total cost|amount paid|total charge):?\s*\$?(\d+\.?\d{0,2})/i,
      /(?:^|\s)(\d+\.\d{2})\s*(?:$|\s)/m, // Standalone amounts
    ];

    // Date patterns - enhanced for PDF text
    const datePatterns = [
      /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
      /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})/i,
      /(?:date|on|transaction date|purchase date):?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /(\d{4}-\d{1,2}-\d{1,2})/,  // ISO date format
      /(?:date|on):?\s*(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*,?\s+\d{2,4})/i,
    ];

    // Category detection based on keywords
    const categoryKeywords = {
      'Meals': ['restaurant', 'cafe', 'food', 'dining', 'pizza', 'burger', 'kitchen', 'grill', 'bistro'],
      'Gas': ['gas', 'fuel', 'chevron', 'shell', 'exxon', 'bp', 'arco', 'mobil'],
      'Office Supplies': ['office', 'depot', 'staples', 'supplies', 'paper', 'printing'],
      'TAXI': ['uber', 'lyft', 'taxi', 'cab', 'rideshare', 'ride share'],
      'Travel': ['hotel', 'motel', 'airline', 'airport', 'rental'],
      'Entertainment': ['movie', 'theater', 'entertainment', 'show', 'concert'],
      'Retail': ['store', 'shop', 'market', 'walmart', 'target', 'costco', 'amazon'],
    };

    // Extract merchant (usually first meaningful line)
    for (const line of lines.slice(0, 5)) {
      for (const pattern of merchantPatterns) {
        const match = line.match(pattern);
        if (match && match[1] && match[1].length > 2) {
          data.merchant = match[1].trim();
          break;
        }
      }
      if (data.merchant) break;
    }

    // Extract amount
    for (const line of lines) {
      for (const pattern of amountPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const amount = parseFloat(match[1]);
          if (amount > 0 && amount < 10000) { // Reasonable range
            data.amount = amount.toFixed(2);
            break;
          }
        }
      }
      if (data.amount) break;
    }

    // Extract date
    for (const line of lines) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          try {
            const parsedDate = new Date(match[1]);
            if (!isNaN(parsedDate.getTime())) {
              data.date = parsedDate.toISOString().split('T')[0];
              break;
            }
          } catch (error) {
            // Continue to next pattern
          }
        }
      }
      if (data.date) break;
    }

    // Determine category
    const fullText = text.toLowerCase();
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => fullText.includes(keyword))) {
        data.category = category;
        break;
      }
    }

    // Extract line items (simple approach)
    for (const line of lines) {
      if (/\$\d+\.\d{2}/.test(line) && line.length < 100) {
        data.items?.push(line.trim());
      }
    }

    return data;
  }

  /**
   * Detect if the receipt is from Uber
   */
  private detectUberReceipt(text: string): boolean {
    const uberIndicators = [
      /\bUber\b/i,
      /Here's your receipt for your ride/i,
      /You rode with/i,
      /UberX|Uber Pool|Uber Black|Uber Select/i,
      /Trip fare/i,
      /Visit the trip page/i,
      /miles\s*\|\s*\d+\s*min/i
    ];

    return uberIndicators.some(pattern => pattern.test(text));
  }

  /**
   * Extract Uber-specific data from receipt text with OCR error handling
   */
  private extractUberData(text: string, lines: string[]): ExtractedReceiptData {
    const data: ExtractedReceiptData = {
      merchant: 'Uber',
      category: 'TAXI',
      items: []
    };

    // Clean up common OCR artifacts before processing
    const cleanedText = this.cleanOCRText(text);
    
    // Extract total amount - Uber shows "Total" prominently
    // Handle OCR artifacts where $ might be misread as S, 5, etc.
    const totalPatterns = [
      /Total[\s]*\$([0-9]+\.?[0-9]*)/i,
      /Total[\s]*S([0-9]+\.?[0-9]*)/i,  // $ misread as S
      /Total[\s]*5([0-9]+\.?[0-9]*)/i,  // $ misread as 5
      /Total[\s]*([0-9]+\.[0-9]{2})/i,  // Just the amount after Total
    ];
    
    for (const pattern of totalPatterns) {
      const totalMatch = cleanedText.match(pattern);
      if (totalMatch && totalMatch[1]) {
        const amount = parseFloat(totalMatch[1]);
        if (amount > 0 && amount < 1000) { // Reasonable range for Uber rides
          data.amount = amount.toFixed(2);
          data.total = amount.toFixed(2);
          console.log(`Uber amount extracted: $${data.amount}`);
          break;
        }
      }
    }

    // Extract date from header - enhanced for poor OCR quality
    // First try: Standard date patterns
    let dateMatch = text.match(/([A-Za-z]+\s+\d{1,2},?\s*\d{4})/);
    
    // Second try: Handle OCR artifacts like "Uber 000000" 
    if (!dateMatch || dateMatch[1].includes('000000')) {
      // Look for 4-digit years in the text
      const yearMatch = text.match(/(20\d{2})/);
      if (yearMatch) {
        // Try to find month names near the year
        const monthPattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{1,2}[,.]?\s*(20\d{2})/i;
        const fullDateMatch = text.match(monthPattern);
        if (fullDateMatch) {
          dateMatch = [fullDateMatch[0], fullDateMatch[0]];
        }
      }
    }
    
    if (dateMatch && !dateMatch[1].includes('000000')) {
      try {
        // Normalize the date string by ensuring space after comma
        const normalizedDate = dateMatch[1].replace(/,(\d)/, ', $1');
        const parsedDate = new Date(normalizedDate);
        if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 2020) {
          data.date = parsedDate.toISOString().split('T')[0];
          console.log(`Uber date extracted successfully: ${normalizedDate} -> ${data.date}`);
        }
      } catch (e) {
        console.log('Uber date parsing failed:', dateMatch[1]);
      }
    } else {
      console.log('No valid date found in OCR text, possibly due to poor PDF conversion quality');
    }

    // Extract trip distance and duration (multiple patterns)
    let tripInfoMatch = text.match(/([0-9.]+)\s*miles?\s*\|\s*([0-9]+)\s*min/i);
    if (!tripInfoMatch) {
      // Alternative pattern: "16.69 miles 41" (space separated)
      tripInfoMatch = text.match(/([0-9.]+)\s*miles?\s+([0-9]+)(?:\s|$)/i);
    }
    if (tripInfoMatch) {
      data.tripDistance = `${tripInfoMatch[1]} miles`;
      data.tripDuration = `${tripInfoMatch[2]} minutes`;
    }

    // Extract driver name (appears after "You rode with" or in receipt greeting)
    let driverMatch = text.match(/You rode with\s+([A-Za-z]+)/i);
    if (!driverMatch) {
      // Alternative: extract from greeting "Here's your receipt for your ride, Ernesto"
      driverMatch = text.match(/receipt for your ride,?\s+([A-Za-z]+)/i);
    }
    if (driverMatch) {
      data.driverName = driverMatch[1];
    }

    // Extract pickup and dropoff locations
    const locations = this.extractUberLocations(text, lines);
    if (locations.from) data.fromAddress = locations.from;
    if (locations.to) data.toAddress = locations.to;

    // Extract payment method
    const paymentMatch = text.match(/(?:EE\s+)?Marriott Amex.*?(\d{3,4})/i);
    if (paymentMatch) {
      data.paymentMethod = `Marriott Amex ****${paymentMatch[1]}`;
    }

    // Extract tip amount
    const tipMatch = text.match(/Tip fare[\s]*\$([0-9]+\.?[0-9]*)/i);
    if (tipMatch) {
      data.tipAmount = tipMatch[1];
    }

    // Extract subtotal
    const subtotalMatch = text.match(/Subtotal[\s]*\$([0-9]+\.?[0-9]*)/i);
    if (subtotalMatch) {
      data.subtotal = subtotalMatch[1];
    }

    // Extract fees (tolls, surcharges, etc.)
    const fees: string[] = [];
    const feePatterns = [
      /([A-Za-z\s]+(?:Toll|Fee|Surcharge|Benefits))[\s]*\$([0-9]+\.?[0-9]*)/gi
    ];

    feePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        fees.push(`${match[1]}: $${match[2]}`);
      }
    });

    if (fees.length > 0) {
      data.fees = fees;
    }

    console.log('Extracted Uber data:', data);
    return data;
  }

  /**
   * Clean OCR text to remove common artifacts from PDF conversion
   */
  private cleanOCRText(text: string): string {
    return text
      // Replace common OCR misreads
      .replace(/[O0]{3,}/g, '') // Remove sequences of 0s/Os
      .replace(/[C]{2,}/g, 'C') // Reduce multiple Cs
      .replace(/\b\d{6,}\b/g, '') // Remove long number sequences
      // Normalize spacing
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract pickup and dropoff locations from Uber receipt
   */
  private extractUberLocations(text: string, lines: string[]): { from?: string; to?: string } {
    const locations: { from?: string; to?: string } = {};

    // Look for time stamps with addresses (e.g., "4:13 AM | 9520 Airport Blvd, Los Angeles, CA 90045, US")
    const timeAddressPattern = /(\d{1,2}:\d{2}\s*(?:AM|PM))\s*\|\s*(.+)/gi;
    const matches = Array.from(text.matchAll(timeAddressPattern));

    if (matches.length >= 2) {
      // First match is pickup, second is dropoff
      locations.from = matches[0][2].trim();
      locations.to = matches[1][2].trim();
    } else if (matches.length === 1) {
      // If only one location found, try to determine if it's pickup or dropoff
      const location = matches[0][2].trim();
      if (text.indexOf(matches[0][0]) < text.length / 2) {
        locations.from = location;
      } else {
        locations.to = location;
      }
    }

    // Alternative pattern: look for addresses in specific sections
    if (!locations.from || !locations.to) {
      const addressPattern = /([0-9]+\s+[^|]+(?:Blvd|Ave|St|Road|Dr|Way|Lane)[^|]*)/gi;
      const addressMatches = Array.from(text.matchAll(addressPattern));
      
      if (addressMatches.length >= 2) {
        locations.from = addressMatches[0][1].trim();
        locations.to = addressMatches[1][1].trim();
      }
    }

    return locations;
  }

  /**
   * Determine MIME type from buffer and file extension
   */
  private getMimeType(buffer: Buffer, fileExtension?: string): string {
    // Check magic bytes for image types
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
    
    // Check for PDF
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'application/pdf';
    
    // Fallback to extension-based detection
    const ext = (fileExtension || '').toLowerCase();
    if (ext === 'pdf') return 'application/pdf';
    if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'gif') return 'image/gif';
    
    return 'image/jpeg'; // Default fallback
  }

  /**
   * Shared receipt extraction prompt for Claude
   */
  private getReceiptExtractionPrompt(isPdf: boolean = false): string {
    const pdfWarning = isPdf ? '' : `CRITICAL: If you see blank gray areas, placeholder boxes, or only a logo without text, this indicates a PDF rendering issue. In this case:
1. Report this clearly in your response
2. Extract whatever text IS visible (even if just merchant name from logo)
3. Set confidence to a low value (below 50)
4. Explain that the PDF conversion failed and the receipt needs to be uploaded as an image (PNG/JPG) for proper extraction

If the image shows FULL receipt content with visible text, proceed with the extraction:

`;

    return `You are an expert OCR system extracting data from a ${isPdf ? 'receipt PDF' : 'receipt image'}. 

${pdfWarning}STEP 1: COMPLETE TEXT TRANSCRIPTION (OCR)
Read EVERY character, word, number, and symbol visible on this receipt. This is the MOST IMPORTANT step.
- Read text from top to bottom, left to right
- Include ALL text: headers, addresses, names, dates, itemized charges, tables, totals, payment info, footers
- For TABLES (like itemized charges): Read each row completely, including dates, descriptions, and amounts
- Preserve line breaks and spacing to maintain structure
- Include numbers, currency symbols, dates in their exact format
- DO NOT skip any text, even if it seems like a label or header
- The ocrText field must contain EVERYTHING visible on the receipt
- If text appears blurry or partially obscured, do your best to read it, but note any uncertainty

STEP 2: STRUCTURED DATA EXTRACTION
Extract ACTUAL VALUES from the transcribed text (not field names or templates).

CRITICAL: Extract REAL DATA VALUES, not generic field names. For example:
- Restaurant: If you see "Joe's Pizza" as merchant, extract "Joe's Pizza" (not "Merchant Name:")
- Hotel: If you see "E. Chapa" as guest name, extract "E. Chapa" (not "Guest Name:")
- Retail: If you see "Room: 525" or "Item #: 12345", extract the actual value "525" or "12345"
- Date: If you see "27Oct25" or "10/27/2025", extract the actual date "2025-10-27"
- Amount: If you see "$45.67" or "Total: 45.67", extract the number 45.67
- If you see a table with charges, extract each row's actual data

For TABULAR DATA (itemized charges, line items):
- Extract each row as a separate item in the "items" array
- Include the full description, date (if present), and amount for each charge
- Format: ["DATE | DESCRIPTION | AMOUNT", ...] or ["DESCRIPTION | AMOUNT", ...] if no date
- Examples: 
  * Restaurant: ["Pizza Margherita | 18.50", "Caesar Salad | 12.00"]
  * Hotel: ["27Oct25 | Market Frozen Food | 5.00", "27Oct25 | Room Charge | 211.00"]
  * Retail: ["Widget A | 29.99", "Widget B | 15.50"]

Return ONLY valid JSON in this exact format:

{
  "merchant": "actual merchant name from receipt (e.g., 'Joe's Pizza', 'Residence Inn by Marriott', 'Target Store #1234')",
  "amount": total_amount_as_number,
  "date": "YYYY-MM-DD (transaction date, check-in date for hotels, trip date for transportation)",
  "category": "appropriate category (e.g., 'RESTAURANT', 'LODGING', 'RETAIL', 'TAXI', 'GAS')",
  "items": ["array of itemized charges/line items if present"],
  "paymentMethod": "actual payment method if visible (e.g., 'American Express')",
  "subtotal": subtotal_as_number_if_present,
  "tipAmount": tip_as_number_if_present,
  "fees": ["array of fee descriptions if present"],
  "fromAddress": "pickup/from address if applicable",
  "toAddress": "dropoff/to address if applicable",
  "tripDistance": "distance if applicable",
  "tripDuration": "duration if applicable",
  "driverName": "driver name if applicable",
  "vehicleInfo": "vehicle info if applicable",
  "ocrText": "COMPLETE transcription of ALL visible text, preserving structure",
  "confidence": confidence_score_0_to_100
}

EXTRACTION RULES:
- Extract ACTUAL VALUES only - never return field names like "Reference Number:", "Guest Name:", "Merchant Name:", etc.
- If a field is not present, omit it entirely (no null values)
- Dates: Convert to YYYY-MM-DD format (e.g., "27Oct25" → "2025-10-27", "10/27/2025" → "2025-10-27")
- Amounts: Extract as numbers (e.g., "$732.52" → 732.52, "Total: 45.67" → 45.67)
- For ALL receipt types: Extract merchant name, amount, date, and any itemized charges/line items
- For hotel receipts: Also extract guest name, room number, check-in/check-out dates if visible
- For transportation receipts: Also extract from/to addresses, trip distance/duration, driver name if visible
- For itemized charges tables: Extract EVERY row with date (if present), description, and amount
- ocrText: Must contain the COMPLETE text transcription from step 1
- confidence: Rate 0-100 based on text clarity, completeness of extraction, and data quality

IMPORTANT: The ocrText field is critical - it must contain ALL visible text from the receipt, especially tabular data.`;
  }

  /**
   * Shared model fallback list
   */
  private getClaudeModelNames(): string[] {
    return [
      'claude-sonnet-4-5-20250929',  // Claude Sonnet 4.5 - Smartest model for complex agents and coding
      'claude-sonnet-4-5',           // Alias for Claude Sonnet 4.5
      'claude-haiku-4-5-20251001',   // Claude Haiku 4.5 - Fastest model with near-frontier intelligence
      'claude-haiku-4-5',            // Alias for Claude Haiku 4.5
      'claude-opus-4-1-20250805',    // Claude Opus 4.1 - Exceptional for specialized reasoning
      'claude-opus-4-1',             // Alias for Claude Opus 4.1
      // Fallback to Claude 3.x models if 4.x are not available
      'claude-3-5-sonnet-20241022',  // Claude 3.5 Sonnet
      'claude-3-opus-20240229',      // Claude 3 Opus
      'claude-3-sonnet-20240229',    // Claude 3 Sonnet
      'claude-3-haiku-20240307',     // Claude 3 Haiku
    ];
  }

  /**
   * Shared response parsing logic
   */
  private parseClaudeResponse(textContent: string, source: 'files-api' | 'vision'): {
    extractedData: ExtractedReceiptData;
    ocrText: string;
    confidence?: number;
  } {
    // Parse JSON from response (handle markdown code blocks if present)
    let jsonText = textContent.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.includes('```')) {
      const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      } else {
        // Try to find JSON object without code blocks
        const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonText = jsonObjectMatch[0];
        }
      }
    } else {
      // Extract first complete JSON object
      const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        jsonText = jsonObjectMatch[0];
      }
    }

    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(jsonText);
    } catch (parseError) {
      console.error(`Failed to parse Claude ${source} JSON response:`, jsonText);
      throw new Error(`Invalid JSON response from Claude ${source}: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    // Extract OCR text and confidence from response
    let ocrText = parsedResponse.ocrText;
    
    // If ocrText is missing or too short, use the full textContent as fallback
    if (!ocrText || ocrText.trim().length < 50) {
      ocrText = textContent;
      console.warn(`OCR text from Claude JSON was ${parsedResponse.ocrText?.length || 0} chars, using full response (${textContent.length} chars) as fallback`);
    }
    
    const claudeConfidence = typeof parsedResponse.confidence === 'number' 
      ? Math.max(0, Math.min(100, parsedResponse.confidence)) 
      : undefined;

    // Remove ocrText and confidence from extractedData before validation
    const { ocrText: _, confidence: __, ...dataToValidate } = parsedResponse;

    // Validate and normalize extracted data
    const extractedData = this.validateAndNormalizeExtractedData(dataToValidate);

    console.log(`Claude ${source} extraction successful:`, extractedData);
    console.log(`OCR text length: ${ocrText?.length || 0} characters`);
    if (claudeConfidence !== undefined) {
      console.log(`Claude-provided confidence: ${claudeConfidence}%`);
    }

    // Ensure we always return meaningful OCR text
    const finalOcrText = ocrText && ocrText.trim().length >= 50 
      ? ocrText.trim()
      : (ocrText || `Extracted via Claude ${source}. Merchant: ${extractedData.merchant || 'N/A'}, Amount: ${extractedData.amount || 'N/A'}, Date: ${extractedData.date || 'N/A'}`);

    return {
      extractedData,
      ocrText: finalOcrText,
      confidence: claudeConfidence,
    };
  }

  /**
   * Unified Claude extraction method that handles both PDFs (via Files API) and images
   */
  private async extractWithClaudeUnified(
    contentBlocks: Array<{ type: string; [key: string]: any }>,
    isPdf: boolean = false
  ): Promise<{
    extractedData: ExtractedReceiptData;
    ocrText: string;
    confidence?: number;
  }> {
    if (!this.anthropicClient) {
      throw new Error('Claude API client not initialized. ANTHROPIC_API_KEY environment variable required.');
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable required.');
    }

    const prompt = this.getReceiptExtractionPrompt(isPdf);
    const modelNames = this.getClaudeModelNames();
    
    let lastError: Error | null = null;
    let textContent = '';

    // For PDFs (document type), use REST API since SDK may not support it
    // For images, use SDK
    const useRestAPI = isPdf;

    for (const modelName of modelNames) {
      try {
        console.log(`Trying Claude ${isPdf ? 'Files API' : 'Vision'} with model: ${modelName}`);
        
        if (useRestAPI) {
          // Use REST API for document type (Files API)
          const messageResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'anthropic-beta': 'files-api-2025-04-14',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: modelName,
              max_tokens: 4096,
              messages: [{
                role: 'user',
                content: [
                  ...contentBlocks,
                  {
                    type: 'text',
                    text: prompt,
                  },
                ],
              }],
            }),
          });

          if (!messageResponse.ok) {
            const errorText = await messageResponse.text();
            const error = new Error(`Messages API failed: ${messageResponse.status} ${messageResponse.statusText} - ${errorText}`);
            lastError = error;
            // If it's a model not found error, try next model
            if (messageResponse.status === 404 && errorText.includes('model')) {
              console.warn(`Model ${modelName} not available, trying next model...`);
              continue;
            }
            throw error;
          }

          const message = await messageResponse.json() as { content: Array<{ type: string; text?: string }> };
          textContent = message.content
            .filter((block) => block.type === 'text' && block.text)
            .map((block) => block.text!)
            .join('\n\n');
        } else {
          // Use SDK for image type
          const response = await this.withTimeout(
            this.anthropicClient.messages.create({
              model: modelName,
              max_tokens: 4096,
              temperature: 0.1,
              messages: [{
                role: 'user',
                content: [
                  ...contentBlocks,
                  {
                    type: 'text' as const,
                    text: prompt,
                  },
                ],
              }],
            }),
            45000,
            `Claude ${isPdf ? 'Files API' : 'Vision'} extraction`
          );

          // Extract text content from response
          if ('content' in response && Array.isArray(response.content)) {
            const textBlock = response.content.find((c: any) => c.type === 'text');
            textContent = textBlock && 'text' in textBlock ? textBlock.text : '';
          } else {
            throw new Error('Unexpected response type from Claude API');
          }
        }
        
        if (!textContent) {
          throw new Error(`Claude ${isPdf ? 'Files API' : 'Vision'} API returned empty response`);
        }
        
        // Success! Break out of the loop
        console.log(`✅ Successfully used Claude model: ${modelName}`);
        break;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Model ${modelName} failed: ${errorMessage}`);
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // If this is a 404 (model not found), try next model
        if (errorMessage.includes('404') || errorMessage.includes('not_found')) {
          continue; // Try next model
        }
        // For other errors, we might want to retry or fail, but let's try other models first
      }
    }
    
    if (!textContent) {
      throw new Error(`All Claude models failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    return this.parseClaudeResponse(textContent, isPdf ? 'files-api' : 'vision');
  }

  /**
   * Upload PDF to Claude Files API and extract using Messages API
   * This is the preferred method for PDFs as it avoids image conversion issues
   */
  private async extractWithClaudeFilesAPI(buffer: Buffer, filename: string): Promise<{
    extractedData: ExtractedReceiptData;
    ocrText: string;
    confidence?: number;
  }> {
    if (!this.anthropicClient) {
      throw new Error('Claude API client not initialized. ANTHROPIC_API_KEY environment variable required.');
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable required.');
    }

    try {
      console.log('Uploading PDF to Claude Files API...');
      
      // Step 1: Upload PDF to Files API
      const formData = new FormData();
      formData.append('file', buffer, {
        filename: filename,
        contentType: 'application/pdf',
      });

      const uploadResponse = await fetch('https://api.anthropic.com/v1/files', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'files-api-2025-04-14',
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Files API upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
      }

      const fileData = await uploadResponse.json() as { id: string; type: string; name: string; bytes: number; created_at: string };
      const fileId = fileData.id;
      
      console.log(`PDF uploaded successfully. File ID: ${fileId}, Size: ${fileData.bytes} bytes`);

      // Step 2: Use unified extraction method with document content block
      const result = await this.extractWithClaudeUnified(
        [
          {
            type: 'document',
            source: {
              type: 'file',
              file_id: fileId,
            },
          },
        ],
        true // isPdf
      );

      // Cleanup: Delete the uploaded file (optional, but good practice)
      try {
        await fetch(`https://api.anthropic.com/v1/files/${fileId}`, {
          method: 'DELETE',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
        });
        console.log(`Cleaned up uploaded file: ${fileId}`);
      } catch (cleanupError) {
        // Non-critical error, just log it
        console.warn(`Failed to cleanup uploaded file ${fileId}:`, cleanupError);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Claude Files API extraction failed:', errorMessage);
      throw error;
    }
  }

  /**
   * Extract receipt data using Claude Vision API
   */
  private async extractWithClaudeVision(buffer: Buffer, fileExtension?: string): Promise<{
    extractedData: ExtractedReceiptData;
    ocrText: string;
    confidence?: number;
  }> {
    if (!this.anthropicClient) {
      throw new Error('Claude Vision API client not initialized. ANTHROPIC_API_KEY environment variable required.');
    }

    try {
      let imageBuffer = buffer;
      let mimeType = this.getMimeType(buffer, fileExtension);
      
      // Check if Claude Vision supports PDFs directly (newer API versions)
      // If PDF conversion fails, we'll try sending PDF directly to Claude
      if (mimeType === 'application/pdf') {
        console.log('Converting PDF to image for Claude Vision...');
        let conversionSuccess = false;
        
        // Try multiple conversion strategies to ensure text renders properly
        // Strategy 1: pdf-to-png-converter with font rendering enabled
        try {
          console.log('Attempting PDF conversion with pdf-to-png-converter (with fonts)...');
          const { pdfToPng } = await import('pdf-to-png-converter');
          const pngPages = await this.withTimeout(
            pdfToPng(buffer, {
              disableFontFace: false,  // Enable font rendering
              useSystemFonts: true,    // Use system fonts as fallback
              pagesToProcess: [1, 2, 3], // Process first 3 pages for multi-page receipts
              viewportScale: 4.0       // Higher resolution for better text clarity
            }),
            30000,
            'PDF to PNG conversion for Claude Vision (with fonts)'
          );
          
          if (pngPages && pngPages.length > 0 && pngPages[0].content) {
            const convertedBuffer = pngPages[0].content;
            // Validate the converted image has reasonable size (not just blank)
            if (convertedBuffer.length > 50000) { // At least 50KB for a valid receipt image
              imageBuffer = convertedBuffer;
              mimeType = 'image/png';
              conversionSuccess = true;
              console.log(`PDF converted to PNG successfully (${convertedBuffer.length} bytes, high resolution with fonts)`);
            } else {
              console.warn(`PDF conversion produced suspiciously small image (${convertedBuffer.length} bytes), trying fallback`);
            }
          }
        } catch (pdfError) {
          const errorMessage = pdfError instanceof Error ? pdfError.message : 'Unknown error';
          console.warn(`PDF conversion attempt 1 failed: ${errorMessage}`);
        }
        
        // Strategy 2: Try with different font settings if first attempt failed or produced small image
        if (!conversionSuccess) {
          try {
            console.log('Attempting PDF conversion with pdf-to-png-converter (alternative font settings)...');
            const { pdfToPng } = await import('pdf-to-png-converter');
            const pngPages = await this.withTimeout(
              pdfToPng(buffer, {
                disableFontFace: false,
                useSystemFonts: false,  // Try without system fonts
                pagesToProcess: [1, 2, 3], // Process first 3 pages for multi-page receipts
                viewportScale: 4.0
              }),
              30000,
              'PDF to PNG conversion for Claude Vision (alternative settings)'
            );
            
            if (pngPages && pngPages.length > 0 && pngPages[0].content) {
              const convertedBuffer = pngPages[0].content;
              if (convertedBuffer.length > 50000) {
                imageBuffer = convertedBuffer;
                mimeType = 'image/png';
                conversionSuccess = true;
                console.log(`PDF converted to PNG successfully with alternative settings (${convertedBuffer.length} bytes)`);
              }
            }
          } catch (pdfError2) {
            console.warn(`PDF conversion attempt 2 failed: ${pdfError2 instanceof Error ? pdfError2.message : 'Unknown error'}`);
          }
        }
        
        // Strategy 3: Fallback to Puppeteer for PDF rendering (most reliable for complex PDFs)
        if (!conversionSuccess) {
          try {
            console.log('Attempting PDF conversion with Puppeteer (most reliable for complex PDFs)...');
            const puppeteer = await import('puppeteer');
            const browser = await puppeteer.default.launch({
              headless: true,
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
              ],
            });
            
            try {
              const page = await browser.newPage();
              
              // Create a data URL from the PDF buffer
              const base64Pdf = buffer.toString('base64');
              const dataUrl = `data:application/pdf;base64,${base64Pdf}`;
              
              // Navigate to PDF and wait for it to load
              await page.goto(dataUrl, { waitUntil: 'networkidle0', timeout: 30000 });
              
              // Wait a bit for fonts and content to render
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Take screenshot at high resolution
              const screenshot = await page.screenshot({
                type: 'png',
                fullPage: true,
                clip: { x: 0, y: 0, width: 1200, height: 1600 }, // Standard receipt size
              });
              
              if (screenshot && Buffer.isBuffer(screenshot) && screenshot.length > 50000) {
                imageBuffer = screenshot;
                mimeType = 'image/png';
                conversionSuccess = true;
                console.log(`PDF converted to PNG successfully with Puppeteer (${screenshot.length} bytes)`);
              }
            } finally {
              await browser.close();
            }
          } catch (puppeteerError) {
            console.warn(`PDF conversion with Puppeteer failed: ${puppeteerError instanceof Error ? puppeteerError.message : 'Unknown error'}`);
          }
        }
        
        // Strategy 4: Try with verbosityLevel for debugging and higher viewportScale
        if (!conversionSuccess) {
          try {
            console.log('Attempting PDF conversion with maximum quality settings and debugging...');
            const { pdfToPng } = await import('pdf-to-png-converter');
            const pngPages = await this.withTimeout(
              pdfToPng(buffer, {
                disableFontFace: false,  // Enable built-in font renderer
                useSystemFonts: true,   // Use system fonts as fallback
                pagesToProcess: [1, 2, 3], // Process first 3 pages for multi-page receipts
                viewportScale: 5.0,      // Even higher resolution (5x)
                verbosityLevel: 5        // Full logging to debug issues
              }),
              45000,  // Longer timeout for high-res conversion
              'PDF to PNG conversion for Claude Vision (maximum quality)'
            );
            
            if (pngPages && pngPages.length > 0 && pngPages[0].content) {
              const convertedBuffer = pngPages[0].content;
              if (convertedBuffer.length > 50000) {
                imageBuffer = convertedBuffer;
                mimeType = 'image/png';
                conversionSuccess = true;
                console.log(`PDF converted to PNG successfully with maximum quality settings (${convertedBuffer.length} bytes)`);
              } else {
                console.warn(`Maximum quality conversion still produced small image (${convertedBuffer.length} bytes) - PDF may have rendering issues`);
              }
            }
          } catch (pdfError3) {
            console.warn(`PDF conversion attempt 4 (max quality) failed: ${pdfError3 instanceof Error ? pdfError3.message : 'Unknown error'}`);
          }
        }
        
        if (!conversionSuccess) {
          const errorMessage = 'All PDF conversion strategies failed - PDF may be corrupted, use unsupported fonts, or have rendering issues';
          console.error(`PDF conversion failed for Claude Vision: ${errorMessage}`);
          throw new Error(`PDF conversion failed: ${errorMessage}. Try uploading as an image (PNG/JPG) for better results.`);
        }
      }
      
      // Convert to base64 for Claude Vision API
      const base64Image = imageBuffer.toString('base64');

      console.log(`Using Claude Vision API for extraction (MIME type: ${mimeType})`);

      // Use unified extraction method with image content block
      return await this.extractWithClaudeUnified(
        [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64Image,
            },
          },
        ],
        false // isPdf
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Claude Vision extraction failed:', errorMessage);
      throw new Error(`Claude Vision extraction failed: ${errorMessage}`);
    }
  }

  /**
   * Validate and normalize extracted data from Claude Vision
   */
  private validateAndNormalizeExtractedData(data: any): ExtractedReceiptData {
    const normalized: ExtractedReceiptData = {};

    // Validate merchant
    if (data.merchant && typeof data.merchant === 'string' && data.merchant.trim().length >= 2) {
      normalized.merchant = data.merchant.trim();
    }

    // Validate and normalize amount
    if (data.amount !== undefined && data.amount !== null) {
      const amount = typeof data.amount === 'number' ? data.amount : parseFloat(String(data.amount));
      if (!isNaN(amount) && amount > 0 && amount < 50000) {
        normalized.amount = amount.toFixed(2);
        normalized.total = amount.toFixed(2);
      }
    }

    // Validate and normalize date
    if (data.date) {
      try {
        const date = new Date(data.date);
        const today = new Date();
        const minDate = new Date('2020-01-01');
        
        if (!isNaN(date.getTime()) && date >= minDate && date <= today) {
          normalized.date = date.toISOString().split('T')[0];
        }
      } catch (e) {
        console.warn('Invalid date from Claude Vision:', data.date);
      }
    }

    // Validate category
    if (data.category && typeof data.category === 'string') {
      normalized.category = data.category.trim();
    }

    // Transportation fields
    if (data.fromAddress && typeof data.fromAddress === 'string') {
      normalized.fromAddress = data.fromAddress.trim();
    }
    if (data.toAddress && typeof data.toAddress === 'string') {
      normalized.toAddress = data.toAddress.trim();
    }
    if (data.tripDistance !== undefined && data.tripDistance !== null) {
      // Handle both number and string formats
      if (typeof data.tripDistance === 'number') {
        normalized.tripDistance = `${data.tripDistance} miles`;
      } else if (typeof data.tripDistance === 'string') {
        normalized.tripDistance = data.tripDistance.trim();
      }
    }
    if (data.tripDuration && typeof data.tripDuration === 'string') {
      normalized.tripDuration = String(data.tripDuration).trim();
    }
    if (data.driverName && typeof data.driverName === 'string') {
      normalized.driverName = data.driverName.trim();
    }
    if (data.vehicleInfo && typeof data.vehicleInfo === 'string') {
      normalized.vehicleInfo = data.vehicleInfo.trim();
    }

    // Payment fields
    if (data.paymentMethod && typeof data.paymentMethod === 'string') {
      normalized.paymentMethod = data.paymentMethod.trim();
    }
    if (data.subtotal !== undefined && data.subtotal !== null) {
      const subtotal = typeof data.subtotal === 'number' ? data.subtotal : parseFloat(String(data.subtotal));
      if (!isNaN(subtotal) && subtotal > 0) {
        normalized.subtotal = subtotal.toFixed(2);
      }
    }
    if (data.tipAmount !== undefined && data.tipAmount !== null) {
      const tipAmount = typeof data.tipAmount === 'number' ? data.tipAmount : parseFloat(String(data.tipAmount));
      if (!isNaN(tipAmount) && tipAmount >= 0) {
        normalized.tipAmount = tipAmount.toFixed(2);
      }
    }
    if (Array.isArray(data.fees)) {
      normalized.fees = data.fees.map((fee: any) => String(fee).trim()).filter((fee: string) => fee.length > 0);
    }

    // Validate items array (for itemized charges, line items)
    if (Array.isArray(data.items)) {
      normalized.items = data.items
        .map((item: any) => String(item).trim())
        .filter((item: string) => item.length > 0);
    }

    return normalized;
  }

  /**
   * Calculate confidence score (0-100) based on extracted data quality
   */
  private calculateConfidence(extractedData: ExtractedReceiptData, extractionMethod: 'claude' | 'tesseract'): number {
    let score = 0;
    const weights = {
      merchant: 25,
      amount: 30,
      date: 25,
      category: 10,
      transportation: 10, // Bonus for transportation-specific fields
    };

    // Base confidence boost for Claude Vision
    const methodBonus = extractionMethod === 'claude' ? 10 : 0;

    // Check merchant
    if (extractedData.merchant && extractedData.merchant.length >= 3) {
      score += weights.merchant;
    }

    // Check amount
    if (extractedData.amount) {
      const amount = parseFloat(extractedData.amount);
      if (!isNaN(amount) && amount > 0 && amount < 50000) {
        score += weights.amount;
      }
    }

    // Check date
    if (extractedData.date) {
      try {
        const date = new Date(extractedData.date);
        if (!isNaN(date.getTime())) {
          score += weights.date;
        }
      } catch (e) {
        // Invalid date, no points
      }
    }

    // Check category
    if (extractedData.category && extractedData.category.length > 0) {
      score += weights.category;
    }

    // Bonus for transportation fields (Uber, Lyft, etc.)
    const hasTransportationFields = 
      extractedData.fromAddress || 
      extractedData.toAddress || 
      extractedData.tripDistance || 
      extractedData.driverName;
    
    if (hasTransportationFields) {
      score += weights.transportation;
    }

    // Add method bonus
    score += methodBonus;

    // Cap at 100
    return Math.min(100, Math.round(score));
  }

  /**
   * Process a receipt file and extract information
   */
  async processReceipt(fileUrl: string, originalFileName?: string): Promise<ExtractionResult> {
    console.log(`Starting OCR processing for: ${fileUrl}`);

    try {
      // Get the file from object storage
      const objectFile = await this.objectStorage.getObjectEntityFile(fileUrl);

      // Download file buffer using the unified download() method
      const [buffer] = await objectFile.download();
      
      // Determine file type from URL first (most reliable), then fallback to original filename
      // Extract extension from URL (e.g., /objects/uploads/abc123.pdf -> pdf)
      let fileExtension = fileUrl.toLowerCase().split('.').pop();
      
      // If URL doesn't have extension, try originalFileName
      if (!fileExtension || fileExtension === fileUrl.toLowerCase() || fileExtension.length > 5) {
        const fileName = originalFileName || fileUrl;
        fileExtension = fileName.toLowerCase().split('.').pop();
      }
      
      // If still no valid extension, try to detect from buffer content
      if (!fileExtension || fileExtension.length > 5) {
        // Check PDF magic bytes
        if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
          fileExtension = 'pdf';
        } else if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
          fileExtension = 'jpg';
        } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
          fileExtension = 'png';
        }
      }
      
      const fileName = originalFileName || fileUrl;

      console.log(`Processing file: ${fileName} with extension: ${fileExtension}`);

      // For PDFs, prioritize Claude Files API (direct PDF processing, no conversion needed)
      // This is the best approach as it avoids image conversion issues
      if (fileExtension === 'pdf' && this.anthropicClient) {
        try {
          console.log('PDF detected - attempting Claude Files API (direct PDF processing)...');
          const { extractedData, ocrText, confidence: claudeConfidence } = await this.extractWithClaudeFilesAPI(buffer, fileName);
          
          const confidence = claudeConfidence !== undefined 
            ? claudeConfidence 
            : this.calculateConfidence(extractedData, 'claude');
          
          console.log(`Claude Files API extraction successful. Confidence: ${confidence}%`);
          
          return {
            ocrText,
            extractedData,
            extractionMethod: 'claude',
            confidence,
          };
        } catch (filesApiError) {
          const errorMessage = filesApiError instanceof Error ? filesApiError.message : 'Unknown error';
          console.warn(`Claude Files API failed, trying direct text extraction: ${errorMessage}`);
          // Continue to fallback methods
        }
      }

      // For PDFs, try direct text extraction as fallback (faster and more reliable than image conversion)
      if (fileExtension === 'pdf') {
        try {
          console.log('PDF detected - attempting direct text extraction first...');
          const directText = await this.extractPdfText(buffer);
          
          // Check if we got substantial text (> 200 chars indicates successful extraction)
          if (directText && directText.length > 200 && !directText.includes('Unable to extract text')) {
            console.log(`Direct PDF text extraction successful (${directText.length} chars) - using Tesseract for structured extraction`);
            
            // Extract structured data from the text
            const extractedData = this.parseReceiptData(directText);
            const confidence = this.calculateConfidence(extractedData, 'tesseract');
            
            return {
              ocrText: directText,
              extractedData,
              extractionMethod: 'tesseract',
              confidence,
            };
          } else {
            console.log(`Direct PDF extraction produced minimal text (${directText?.length || 0} chars) - falling back to Claude Vision with image conversion`);
          }
        } catch (pdfError) {
          console.warn(`Direct PDF text extraction failed, trying Claude Vision: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
        }
      }

      // Try Claude Vision if available (for images or PDFs that failed direct extraction)
      if (this.anthropicClient) {
        try {
          console.log('Attempting extraction with Claude Vision API...');
          const { extractedData, ocrText, confidence: claudeConfidence } = await this.extractWithClaudeVision(buffer, fileExtension);
          
          // Check if Claude Vision produced meaningful results
          // If confidence is very low (< 30) and OCR text is short (< 200 chars), it likely failed
          const hasGoodResults = (claudeConfidence !== undefined && claudeConfidence >= 30) || 
                                 (ocrText && ocrText.length > 200) ||
                                 (extractedData.merchant && extractedData.amount && extractedData.date);
          
          if (!hasGoodResults && fileExtension === 'pdf') {
            // For PDFs with poor Claude Vision results, try Tesseract fallback
            console.warn('Claude Vision produced poor results for PDF - trying Tesseract OCR fallback');
            throw new Error('Claude Vision extraction quality too low for PDF');
          }
          
          // Use Claude-provided confidence if available, otherwise calculate it
          const confidence = claudeConfidence !== undefined 
            ? claudeConfidence 
            : this.calculateConfidence(extractedData, 'claude');
          
          console.log(`Claude Vision extraction successful. Confidence: ${confidence}%`);

          return {
            ocrText,
            extractedData,
            extractionMethod: 'claude',
            confidence,
          };
        } catch (claudeError) {
          const errorMessage = claudeError instanceof Error ? claudeError.message : 'Unknown error';
          console.warn(`Claude Vision extraction failed, falling back to Tesseract: ${errorMessage}`);
          // Log the full error for debugging
          if (claudeError instanceof Error && claudeError.stack) {
            console.error('Claude Vision error details:', claudeError.stack);
          }
          // Continue to Tesseract fallback
        }
      }

      // Fallback to Tesseract OCR
      console.log('Using Tesseract OCR for extraction...');
      let ocrText: string;

      if (fileExtension === 'pdf') {
        console.log('Processing PDF file - converting to image then extracting text...');
        ocrText = await this.extractPdfText(buffer);
      } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'].includes(fileExtension || '')) {
        console.log('Processing image file...');
        ocrText = await this.extractImageText(buffer);
      } else {
        throw new Error(`Unsupported file type: ${fileExtension}`);
      }

      console.log(`Text extraction completed. Extracted ${ocrText.length} characters`);

      // Parse the extracted text
      const extractedData = this.parseReceiptData(ocrText);
      const confidence = this.calculateConfidence(extractedData, 'tesseract');
      
      console.log(`Tesseract extraction completed. Confidence: ${confidence}%`);
      console.log('Extracted data:', extractedData);

      return {
        ocrText,
        extractedData,
        extractionMethod: 'tesseract',
        confidence,
      };

    } catch (error) {
      console.error('Text extraction failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
      this.tesseractWorker = null;
    }
  }
}

export const ocrService = new OCRService();