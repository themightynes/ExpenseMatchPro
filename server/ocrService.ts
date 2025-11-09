import { createWorker } from 'tesseract.js';
import { getStorage } from './storageFactory';
import type { IStorageService } from './storageFactory';
import Anthropic from '@anthropic-ai/sdk';

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
        const pdfParse = (await import('pdf-parse')).default;
        
        // Configure pdf-parse options to avoid test file issues
        const options = {
          max: 1 // Only parse first page for performance
        };
        
        const data = await this.withTimeout(pdfParse(buffer, options), 60000, 'PDF text extraction');
        console.log(`PDF parsed successfully. Pages: ${data.numpages}, Text length: ${data.text.length}`);
        
        if (data.text && data.text.length > 50) {
          console.log(`Direct PDF text extraction successful. Extracted ${data.text.length} characters`);
          return data.text;
        }
        
        console.log('Direct PDF text extraction returned minimal text, trying OCR conversion...');
      } catch (directError) {
        const errorMessage = directError instanceof Error ? directError.message : 'Unknown error';
        console.log('Direct PDF text extraction failed, falling back to OCR conversion:', errorMessage);
      }
      
      // Second try: Convert PDF to image using modern libraries (2024-2025 solutions)
      console.log('PDF processing: Converting PDF to images for OCR extraction...');
      
      // Try pdf-to-png-converter first (most reliable according to recent research)
      try {
        console.log('Attempting PDF conversion with pdf-to-png-converter...');
        const { pdfToPng } = await import('pdf-to-png-converter');
        
        const pngPages = await this.withTimeout(
          pdfToPng(buffer, {
            disableFontFace: false,
            useSystemFonts: false,
            pagesToProcess: [1],
            viewportScale: 2.0
          }),
          60000,
          'PDF to PNG conversion'
        );

        if (pngPages && pngPages.length > 0 && pngPages[0].content) {
          console.log(`PDF conversion successful with pdf-to-png-converter. Buffer size: ${pngPages[0].content.length} bytes`);
          return await this.withTimeout(
            this.extractImageText(pngPages[0].content),
            90000,
            'Image text extraction after pdf-to-png'
          );
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
      
      // Convert PDF to image first (Claude Vision doesn't support PDFs directly)
      if (mimeType === 'application/pdf') {
        console.log('Converting PDF to image for Claude Vision...');
        try {
          // Convert PDF first page to PNG using pdf-to-png-converter
          const { pdfToPng } = await import('pdf-to-png-converter');
          const pngPages = await this.withTimeout(
            pdfToPng(buffer, {
              disableFontFace: false,
              useSystemFonts: false,
              pagesToProcess: [1],
              viewportScale: 2.0
            }),
            30000,
            'PDF to PNG conversion for Claude Vision'
          );
          
          if (pngPages && pngPages.length > 0 && pngPages[0].content) {
            imageBuffer = pngPages[0].content;
            mimeType = 'image/png';
            console.log('PDF converted to PNG successfully for Claude Vision');
          } else {
            throw new Error('PDF to PNG conversion returned empty result');
          }
        } catch (pdfError) {
          const errorMessage = pdfError instanceof Error ? pdfError.message : 'Unknown error';
          console.warn(`PDF conversion failed for Claude Vision: ${errorMessage}`);
          throw new Error(`PDF conversion failed: ${errorMessage}`);
        }
      }
      
      const base64Image = imageBuffer.toString('base64');

      console.log(`Using Claude Vision API for extraction (MIME type: ${mimeType})`);

      const prompt = `Extract structured data from this receipt image. 

First, transcribe all visible text from the receipt exactly as it appears (this is the OCR text).

Then, extract structured data and return ONLY valid JSON in this exact format:

{
  "merchant": "string",
  "amount": "number",
  "date": "YYYY-MM-DD",
  "category": "string",
  "paymentMethod": "string (optional)",
  "subtotal": "number (optional)",
  "tipAmount": "number (optional)",
  "fees": ["array of strings (optional)"],
  "fromAddress": "string (optional)",
  "toAddress": "string (optional)",
  "tripDistance": "number (optional)",
  "tripDuration": "string (optional)",
  "driverName": "string (optional)",
  "vehicleInfo": "string (optional)",
  "ocrText": "string (all visible text from receipt)",
  "confidence": "number (0-100)"
}

RULES:
- Omit fields if not present (no null values)
- Dates: valid format, between 2020-01-01 and today
- Amounts: positive numbers only
- ocrText: Include all visible text from the receipt, preserving line breaks
- confidence: Estimate confidence score 0-100 based on text clarity and data completeness`;

      // Try multiple model names in order of preference
      // Using latest Claude 4.x models with fallback to older versions if needed
      const modelNames = [
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
      
      let lastError: Error | null = null;
      let textContent = '';
      
      for (const modelName of modelNames) {
        try {
          console.log(`Trying Claude model: ${modelName}`);
          const response = await this.withTimeout(
            this.anthropicClient.messages.create({
              model: modelName,
              max_tokens: 1024,
              temperature: 0.2,
              messages: [{
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                      data: base64Image,
                    },
                  },
                  {
                    type: 'text',
                    text: prompt,
                  },
                ],
              }],
            }),
            30000, // 30 second timeout for Claude API
            'Claude Vision API extraction'
          );

          // Type guard to ensure we have a Message response, not a Stream
          if ('content' in response && Array.isArray(response.content)) {
            const textBlock = response.content.find((c: any) => c.type === 'text');
            textContent = textBlock && 'text' in textBlock ? textBlock.text : '';
          } else {
            throw new Error('Unexpected response type from Claude API');
          }
          
          if (!textContent) {
            throw new Error('Claude Vision API returned empty response');
          }
          
          // Success! Break out of the loop
          console.log(`✅ Successfully used Claude model: ${modelName}`);
          break;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.warn(`Model ${modelName} failed: ${errorMessage}`);
          lastError = error instanceof Error ? error : new Error(String(error));
          
          // If this is a 404 (model not found), try next model
          // Otherwise, it might be a different error (rate limit, etc.) so we'll still try others
          if (errorMessage.includes('404') || errorMessage.includes('not_found')) {
            continue; // Try next model
          }
          // For other errors, we might want to retry or fail, but let's try other models first
        }
      }
      
      if (!textContent) {
        throw new Error(`All Claude models failed. Last error: ${lastError?.message || 'Unknown error'}`);
      }

      // Extract JSON from response (handle cases where it's wrapped in markdown code blocks or has trailing text)
      let jsonText = textContent.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
      }

      // Try to extract JSON object if there's trailing text after the JSON
      // Look for the first complete JSON object (starts with { and ends with })
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      // Parse JSON response
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('Failed to parse Claude Vision JSON response:', jsonText);
        throw new Error(`Invalid JSON response from Claude Vision: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      // Extract OCR text and confidence from response
      const ocrText = parsedResponse.ocrText || textContent; // Fallback to full text if ocrText not in JSON
      const claudeConfidence = typeof parsedResponse.confidence === 'number' 
        ? Math.max(0, Math.min(100, parsedResponse.confidence)) 
        : undefined;

      // Remove ocrText and confidence from extractedData before validation
      const { ocrText: _, confidence: __, ...dataToValidate } = parsedResponse;

      // Validate and normalize extracted data
      const extractedData = this.validateAndNormalizeExtractedData(dataToValidate);

      console.log('Claude Vision extraction successful:', extractedData);
      if (claudeConfidence !== undefined) {
        console.log(`Claude-provided confidence: ${claudeConfidence}%`);
      }

      return {
        extractedData,
        ocrText: ocrText || `Extracted via Claude Vision API. Merchant: ${extractedData.merchant || 'N/A'}, Amount: ${extractedData.amount || 'N/A'}, Date: ${extractedData.date || 'N/A'}`,
        confidence: claudeConfidence,
      };
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

      // Try Claude Vision first if available
      if (this.anthropicClient) {
        try {
          console.log('Attempting extraction with Claude Vision API...');
          const { extractedData, ocrText, confidence: claudeConfidence } = await this.extractWithClaudeVision(buffer, fileExtension);
          
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