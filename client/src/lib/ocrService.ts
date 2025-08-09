import Tesseract from 'tesseract.js';

export class OCRService {
  async extractText(file: File): Promise<string> {
    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: m => console.log(m)
      });
      return result.data.text;
    } catch (error) {
      console.error('OCR extraction failed:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  async extractTextFromUrl(imageUrl: string): Promise<string> {
    try {
      const result = await Tesseract.recognize(imageUrl, 'eng', {
        logger: m => console.log(m)
      });
      return result.data.text;
    } catch (error) {
      console.error('OCR extraction failed:', error);
      throw new Error('Failed to extract text from image');
    }
  }
}

export const ocrService = new OCRService();
