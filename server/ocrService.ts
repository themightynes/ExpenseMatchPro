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
   * Extract text from PDF by providing user guidance
   */
  private async extractPdfText(buffer: Buffer): Promise<string> {
    // For PDF files, Tesseract.js cannot directly process them
    // In a production environment, you would:
    // 1. Convert PDF to images using pdf2pic or similar
    // 2. Run OCR on each image
    // 3. Combine the results
    
    console.log('PDF processing: Providing manual entry guidance');
    return "PDF receipt detected. OCR text extraction from PDFs is complex - please enter the receipt details manually. Key information needed: merchant name, amount, date, and category.";
  }

  /**
   * Extract text from image using Tesseract.js
   */
  private async extractImageText(buffer: Buffer): Promise<string> {
    try {
      const worker = await this.initTesseract();
      const { data: { text } } = await worker.recognize(buffer);
      return text;
    } catch (error) {
      console.error('Error with OCR:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  /**
   * Parse receipt information from OCR text
   */
  private parseReceiptData(text: string): ExtractedReceiptData {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const data: ExtractedReceiptData = {
      items: []
    };

    // Common merchant patterns
    const merchantPatterns = [
      /^([A-Z][A-Za-z\s&'.-]{2,30})/,
      /\b([A-Z][A-Za-z\s&'.-]{3,25})\b.*(?:restaurant|cafe|store|shop|market|pharmacy|gas)/i,
    ];

    // Amount patterns (looking for totals)
    const amountPatterns = [
      /(?:total|amount due|balance|sum):?\s*\$?(\d+\.?\d{0,2})/i,
      /\$(\d+\.\d{2})(?:\s|$)/,
      /(\d+\.\d{2})\s*(?:total|due|amount)/i,
    ];

    // Date patterns
    const datePatterns = [
      /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
      /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})/i,
      /(?:date|on):?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
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
        console.log('Processing PDF file...');
        ocrText = await this.extractPdfText(buffer);
      } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'].includes(fileExtension || '')) {
        console.log('Processing image file...');
        ocrText = await this.extractImageText(buffer);
      } else {
        throw new Error(`Unsupported file type: ${fileExtension}`);
      }

      console.log(`OCR completed. Extracted ${ocrText.length} characters`);

      // Parse the extracted text
      const extractedData = this.parseReceiptData(ocrText);
      
      console.log('Extracted data:', extractedData);

      return {
        ocrText,
        extractedData
      };

    } catch (error) {
      console.error('OCR processing failed:', error);
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