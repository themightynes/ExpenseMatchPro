import { createWorker } from 'tesseract.js';
import { ObjectStorageService } from './objectStorage';

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

export class OCRService {
  private objectStorage: ObjectStorageService;
  private tesseractWorker: any = null;

  constructor() {
    this.objectStorage = new ObjectStorageService();
  }

  /**
   * Initialize Tesseract worker for image OCR
   */
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
          max: 1, // Only parse first page for performance
          version: 'v1.10.100'
        };
        
        const data = await pdfParse(buffer, options);
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
      
      // Second try: Convert PDF to image and use OCR
      console.log('PDF processing: Converting PDF to images for OCR extraction...');
      
      const { fromBuffer } = await import('pdf2pic');
      
      // Try multiple conversion settings for better compatibility
      const conversionSettings = [
        { density: 300, format: "png", quality: 100 },
        { density: 200, format: "jpeg", quality: 95 },
        { density: 150, format: "png", quality: 90 }
      ];
      
      for (const settings of conversionSettings) {
        try {
          console.log(`Trying PDF conversion with settings:`, settings);
          
          const convert = fromBuffer(buffer, {
            ...settings,
            saveFilename: "receipt",
            savePath: "/tmp",
            preserveAspectRatio: true
          });
          
          const result = await convert(1, { responseType: "buffer" });
          
          if (result?.buffer && result.buffer.length > 10000) { // Increased threshold
            console.log(`PDF conversion successful with ${settings.format}. Buffer size: ${result.buffer.length} bytes`);
            return await this.extractImageText(result.buffer);
          } else {
            console.log(`Conversion with ${settings.format} produced small buffer: ${result?.buffer?.length || 0} bytes`);
          }
        } catch (conversionError) {
          const errorMessage = conversionError instanceof Error ? conversionError.message : 'Unknown error';
          console.log(`Conversion failed with ${settings.format}:`, errorMessage);
          continue;
        }
      }
      
      return "PDF processing: Unable to extract text from this PDF. The enhanced Uber detection system works best with image receipts (PNG/JPG). For optimal results with Uber receipts, please upload as an image format, or enter the details manually for accurate AMEX matching.";
      
    } catch (error) {
      console.error('Error processing PDF:', error);
      return "PDF processing failed. For Uber receipts, try uploading as an image format (PNG/JPG) which works better with our enhanced transportation detection, or enter details manually.";
    }
  }

  /**
   * Extract text from image using Tesseract.js
   */
  private async extractImageText(buffer: Buffer): Promise<string> {
    try {
      // Validate buffer before processing
      if (!buffer || buffer.length === 0) {
        throw new Error('Invalid or empty image buffer');
      }
      
      const worker = await this.initTesseract();
      
      // Add timeout to prevent hanging
      const extractionPromise = worker.recognize(buffer);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Text extraction timeout')), 120000) // 2 minute timeout
      );
      
      const result = await Promise.race([extractionPromise, timeoutPromise]);
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
   * Extract Uber-specific data from receipt text
   */
  private extractUberData(text: string, lines: string[]): ExtractedReceiptData {
    const data: ExtractedReceiptData = {
      merchant: 'Uber',
      category: 'TAXI',
      items: []
    };

    // Extract total amount - Uber shows "Total" prominently
    const totalMatch = text.match(/Total[\s]*\$([0-9]+\.?[0-9]*)/i);
    if (totalMatch) {
      data.amount = totalMatch[1];
      data.total = totalMatch[1];
    }

    // Extract date from header (e.g., "June 9, 2025" or "May 13, 2025")
    const dateMatch = text.match(/([A-Za-z]+\s+\d{1,2},\s+\d{4})/);
    if (dateMatch) {
      try {
        const parsedDate = new Date(dateMatch[1]);
        if (!isNaN(parsedDate.getTime())) {
          data.date = parsedDate.toISOString().split('T')[0];
        }
      } catch (e) {
        console.log('Uber date parsing failed:', dateMatch[1]);
      }
    }

    // Extract trip distance and duration
    const tripInfoMatch = text.match(/([0-9.]+)\s*miles?\s*\|\s*([0-9]+)\s*min/i);
    if (tripInfoMatch) {
      data.tripDistance = `${tripInfoMatch[1]} miles`;
      data.tripDuration = `${tripInfoMatch[2]} minutes`;
    }

    // Extract driver name (appears after "You rode with")
    const driverMatch = text.match(/You rode with\s+([A-Za-z]+)/i);
    if (driverMatch) {
      data.driverName = driverMatch[1];
    }

    // Extract pickup and dropoff locations
    const locations = this.extractUberLocations(text, lines);
    if (locations.from) data.fromAddress = locations.from;
    if (locations.to) data.toAddress = locations.to;

    // Extract payment method
    const paymentMatch = text.match(/Marriott Amex.*(\d{4})/);
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
   * Process a receipt file and extract information
   */
  async processReceipt(fileUrl: string, originalFileName?: string): Promise<{
    ocrText: string;
    extractedData: ExtractedReceiptData;
  }> {
    console.log(`Starting OCR processing for: ${fileUrl}`);
    
    try {
      // Get the file from object storage
      const objectFile = await this.objectStorage.getObjectEntityFile(fileUrl);
      
      // Download file buffer
      const chunks: Buffer[] = [];
      const stream = objectFile.createReadStream();
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      // Determine file type from original filename if available, otherwise from URL
      const fileName = originalFileName || fileUrl;
      const fileExtension = fileName.toLowerCase().split('.').pop();
      let ocrText: string;

      console.log(`Processing file: ${fileName} with extension: ${fileExtension}`);

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
      
      console.log('Extracted data:', extractedData);

      return {
        ocrText,
        extractedData
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