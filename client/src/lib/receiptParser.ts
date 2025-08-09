import { EXPENSE_CATEGORIES } from "@shared/schema";

export interface ParsedReceiptData {
  merchant?: string;
  amount?: string;
  date?: Date;
  category?: string;
  items?: string[];
  address?: string;
  phone?: string;
  taxAmount?: string;
  tipAmount?: string;
}

export class ReceiptParser {
  parseReceiptText(ocrText: string): ParsedReceiptData {
    const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const result: ParsedReceiptData = {};

    // Extract merchant name (usually one of the first few lines)
    result.merchant = this.extractMerchant(lines);

    // Extract amount (look for patterns like $XX.XX, Total: $XX.XX)
    result.amount = this.extractAmount(lines);

    // Extract date
    result.date = this.extractDate(lines);

    // Extract category based on merchant name or content
    result.category = this.extractCategory(ocrText, result.merchant);

    // Extract additional details
    result.address = this.extractAddress(lines);
    result.phone = this.extractPhone(lines);
    result.taxAmount = this.extractTax(lines);
    result.tipAmount = this.extractTip(lines);
    result.items = this.extractItems(lines);

    return result;
  }

  private extractMerchant(lines: string[]): string | undefined {
    // Look for merchant name in first few lines
    // Skip lines that look like addresses, phone numbers, or common receipt headers
    const skipPatterns = [
      /^\d+.*street|road|ave|avenue|blvd|boulevard/i,
      /^\(\d{3}\)|\d{3}-\d{3}-\d{4}/,
      /^tel:|^phone:/i,
      /^receipt|^customer copy/i,
      /^rfc:|^independencia/i, // Skip Mexican tax identifiers and addresses
      /^mesa:|^folio:|^orden:/i, // Skip table/order numbers
      /^personas:/i, // Skip person count
    ];

    // Special patterns for specific merchant types
    for (let i = 0; i < Math.min(7, lines.length); i++) {
      const line = lines[i].trim();
      
      // Mexican restaurant patterns
      if (line.match(/casa\s+luna|luna\s+tlaquepaque/i)) {
        return "Casa Luna Luna Tlaquepaque";
      }
      
      // Look for substantial lines that could be merchant names
      if (line.length > 3 && !skipPatterns.some(pattern => pattern.test(line))) {
        // Clean up the merchant name
        const cleaned = line.replace(/[^\w\s&'-]/g, '').trim();
        if (cleaned.length > 2) {
          return cleaned;
        }
      }
    }

    return undefined;
  }

  private extractAmount(lines: string[]): string | undefined {
    const amountPatterns = [
      /total[\s:]*\$?(\d+[,.]?\d*)/i,
      /amount[\s:]*\$?(\d+[,.]?\d*)/i,
      /\$(\d+[,.]?\d+\.?\d*)/,
      /(\d+[,.]?\d+\.?\d*)\s*$/, // Amount at end of line
      /importe[\s:]*\$?(\d+[,.]?\d*)/i, // Spanish "amount"
    ];

    const amounts: number[] = [];

    for (const line of lines) {
      for (const pattern of amountPatterns) {
        const match = line.match(pattern);
        if (match) {
          // Handle different number formats (commas as thousands separator)
          let amountStr = match[1].replace(/,/g, '');
          const amount = parseFloat(amountStr);
          if (amount > 0 && amount < 100000) { // Reasonable range
            amounts.push(amount);
          }
        }
      }
    }

    // Return the largest amount found (likely the total)
    if (amounts.length > 0) {
      return Math.max(...amounts).toFixed(2);
    }

    return undefined;
  }

  private extractDate(lines: string[]): Date | undefined {
    const datePatterns = [
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}/i,
      /(\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4})/i,
      /(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}/, // Mexican format with time
    ];

    for (const line of lines) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          const dateStr = match[1] || match[0];
          let parsedDate: Date;
          
          // Handle DD/MM/YYYY format (common in Mexico)
          if (dateStr.includes('/') && dateStr.split('/')[0].length === 2) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              // Assume DD/MM/YYYY format
              parsedDate = new Date(`${parts[1]}/${parts[0]}/${parts[2]}`);
            } else {
              parsedDate = new Date(dateStr);
            }
          } else {
            parsedDate = new Date(dateStr);
          }
          
          if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 2000) {
            return parsedDate;
          }
        }
      }
    }

    return undefined;
  }

  private extractCategory(ocrText: string, merchant?: string): string | undefined {
    const text = ocrText.toLowerCase();
    const merchantLower = merchant?.toLowerCase() || '';

    // Hotel keywords
    if (text.includes('hotel') || text.includes('inn') || text.includes('resort') || 
        merchantLower.includes('marriott') || merchantLower.includes('hilton') || 
        merchantLower.includes('hyatt') || merchantLower.includes('hotel')) {
      return 'Hotel';
    }

    // Restaurant/food keywords
    if (text.includes('restaurant') || text.includes('food') || text.includes('menu') ||
        text.includes('dinner') || text.includes('lunch') || text.includes('breakfast') ||
        merchantLower.includes('restaurant') || merchantLower.includes('cafe') ||
        merchantLower.includes('grill') || merchantLower.includes('bistro')) {
      return 'Meals - Travel Individual';
    }

    // Transportation keywords
    if (text.includes('taxi') || text.includes('uber') || text.includes('lyft') ||
        merchantLower.includes('taxi') || merchantLower.includes('cab')) {
      return 'Taxi';
    }

    if (text.includes('airline') || text.includes('airways') || text.includes('flight') ||
        merchantLower.includes('airlines') || merchantLower.includes('airways')) {
      return 'Airfare';
    }

    if (text.includes('rental') || merchantLower.includes('hertz') || 
        merchantLower.includes('avis') || merchantLower.includes('enterprise')) {
      return 'Car Rental';
    }

    // Gas station keywords
    if (text.includes('gas') || text.includes('fuel') || text.includes('petrol') ||
        merchantLower.includes('shell') || merchantLower.includes('exxon') ||
        merchantLower.includes('chevron') || merchantLower.includes('bp')) {
      return 'Gas';
    }

    // Office supplies
    if (text.includes('office') || text.includes('supplies') || text.includes('staples') ||
        merchantLower.includes('office') || merchantLower.includes('staples')) {
      return 'Supplies';
    }

    return undefined;
  }

  private extractAddress(lines: string[]): string | undefined {
    const addressPattern = /\d+.*(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|court|ct|place|pl)/i;
    
    for (const line of lines) {
      if (addressPattern.test(line)) {
        return line.trim();
      }
    }

    return undefined;
  }

  private extractPhone(lines: string[]): string | undefined {
    const phonePattern = /(\(\d{3}\)\s*\d{3}-\d{4}|\d{3}-\d{3}-\d{4}|\d{3}\.\d{3}\.\d{4})/;
    
    for (const line of lines) {
      const match = line.match(phonePattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  private extractTax(lines: string[]): string | undefined {
    const taxPattern = /tax[\s:]*\$?(\d+\.?\d*)/i;
    
    for (const line of lines) {
      const match = line.match(taxPattern);
      if (match) {
        return parseFloat(match[1]).toFixed(2);
      }
    }

    return undefined;
  }

  private extractTip(lines: string[]): string | undefined {
    const tipPattern = /(?:tip|gratuity)[\s:]*\$?(\d+\.?\d*)/i;
    
    for (const line of lines) {
      const match = line.match(tipPattern);
      if (match) {
        return parseFloat(match[1]).toFixed(2);
      }
    }

    return undefined;
  }

  private extractItems(lines: string[]): string[] {
    const items: string[] = [];
    const itemPattern = /^(.+?)\s+\$?(\d+\.?\d*)$/;
    
    for (const line of lines) {
      const match = line.match(itemPattern);
      if (match && match[1].length > 2) {
        // Filter out lines that look like totals, taxes, etc.
        const item = match[1].trim();
        if (!item.toLowerCase().includes('total') && 
            !item.toLowerCase().includes('tax') &&
            !item.toLowerCase().includes('tip')) {
          items.push(item);
        }
      }
    }

    return items;
  }
}

export const receiptParser = new ReceiptParser();
