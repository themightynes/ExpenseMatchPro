import { createWorker } from 'tesseract.js';
import { ObjectStorageService } from './objectStorage';

interface ExtractedReceiptData {
  merchant?: string;
  amount?: string;
  date?: string;
  category?: string;
  total?: string;
  items?: string[];
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
   * Extract text from PDF by converting to images and using OCR
   */
  private async extractPdfText(buffer: Buffer): Promise<string> {
    try {
      console.log('PDF processing: Converting PDF to images for text extraction...');
      
      // Dynamic import to avoid module loading issues
      const { fromBuffer } = await import('pdf2pic');
      
      // Convert PDF to images (first page only for performance)
      const convert = fromBuffer(buffer, {
        density: 200,           // Higher DPI for better text quality
        saveFilename: "receipt",
        savePath: "/tmp",
        format: "png",          // PNG for better text quality
        quality: 100,           // Maximum quality
        preserveAspectRatio: true
      });
      
      console.log('Converting PDF page 1 to image...');
      const result = await convert(1, { responseType: "buffer" });
      
      if (!result || !result.buffer) {
        console.log('PDF to image conversion failed');
        return "PDF processing: Unable to convert PDF to image for text extraction. This might be a complex or password-protected PDF. Please enter the receipt details manually.";
      }
      
      console.log('PDF converted to image, starting text extraction...');
      
      // Validate the image buffer before processing
      if (result.buffer.length < 5000) { // Increased threshold for better validation
        console.log('Converted image appears to be too small or corrupted, buffer size:', result.buffer.length);
        
        // Try alternative conversion settings
        console.log('Attempting PDF conversion with alternative settings...');
        try {
          const fallbackConvert = fromBuffer(buffer, {
            density: 150,
            format: "jpeg",
            quality: 90
          });
          const fallbackResult = await fallbackConvert(1, { responseType: "buffer" });
          
          if (fallbackResult?.buffer && fallbackResult.buffer.length > 5000) {
            console.log('Fallback conversion successful, buffer size:', fallbackResult.buffer.length, 'bytes');
            return await this.extractImageText(fallbackResult.buffer);
          }
        } catch (fallbackError) {
          console.error('Fallback conversion also failed:', fallbackError);
        }
        
        return "PDF processing: Unable to convert PDF to readable image. This might be a password-protected, scanned, or complex PDF format. Please enter the receipt details manually for accurate AMEX matching.";
      }
      
      console.log('PDF conversion successful, image buffer size:', result.buffer.length, 'bytes');
      
      // Use existing image OCR processing with error handling
      try {
        return await this.extractImageText(result.buffer);
      } catch (ocrError) {
        console.error('OCR failed on converted PDF image:', ocrError);
        return "PDF text extraction failed during OCR processing. This might be a scanned PDF with poor image quality. Please enter the receipt details manually for accurate matching.";
      }
      
    } catch (error) {
      console.error('Error processing PDF:', error);
      return "PDF processing failed. This might be a password-protected, corrupted, or complex PDF. Please enter the receipt details manually to enable automatic matching with AMEX charges.";
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
      'Travel': ['hotel', 'motel', 'airline', 'airport', 'rental', 'uber', 'lyft', 'taxi'],
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