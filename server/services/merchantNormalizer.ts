import * as stringSimilarity from 'string-similarity';

interface MerchantAlias {
  pattern: string;
  normalized: string;
  isRegex?: boolean;
}

// Merchant normalization service
export class MerchantNormalizer {
  private aliases: MerchantAlias[] = [
    // Common abbreviations
    { pattern: 'AMZN', normalized: 'Amazon' },
    { pattern: 'AMAZN', normalized: 'Amazon' },
    { pattern: 'AMAZON.COM', normalized: 'Amazon' },
    { pattern: 'AMAZON MKTP', normalized: 'Amazon' },
    { pattern: 'AMZN MKTP', normalized: 'Amazon' },
    
    // Starbucks variations
    { pattern: 'SBX', normalized: 'Starbucks' },
    { pattern: 'SBUX', normalized: 'Starbucks' },
    { pattern: 'STARBUCKS CORP', normalized: 'Starbucks' },
    { pattern: 'STARBUCKS STORE', normalized: 'Starbucks' },
    
    // Uber variations
    { pattern: 'UBER *EATS', normalized: 'Uber Eats' },
    { pattern: 'UBER*EATS', normalized: 'Uber Eats' },
    { pattern: 'UBEREATS', normalized: 'Uber Eats' },
    { pattern: 'UBER * TRIP', normalized: 'Uber' },
    { pattern: 'UBER*TRIP', normalized: 'Uber' },
    
    // McDonald's variations
    { pattern: 'MCD', normalized: "McDonald's" },
    { pattern: 'MCDONALDS', normalized: "McDonald's" },
    { pattern: 'MC DONALDS', normalized: "McDonald's" },
    
    // Walmart variations
    { pattern: 'WMT', normalized: 'Walmart' },
    { pattern: 'WAL-MART', normalized: 'Walmart' },
    { pattern: 'WAL MART', normalized: 'Walmart' },
    { pattern: 'WALMART.COM', normalized: 'Walmart' },
    
    // Target variations
    { pattern: 'TGT', normalized: 'Target' },
    { pattern: 'TARGET.COM', normalized: 'Target' },
    
    // Gas stations
    { pattern: 'CHEVRON', normalized: 'Chevron' },
    { pattern: 'SHELL OIL', normalized: 'Shell' },
    { pattern: 'EXXONMOBIL', normalized: 'ExxonMobil' },
    { pattern: 'EXXON MOBIL', normalized: 'ExxonMobil' },
    
    // Airlines
    { pattern: 'AA', normalized: 'American Airlines' },
    { pattern: 'AMERICAN AIR', normalized: 'American Airlines' },
    { pattern: 'UNITED AIR', normalized: 'United Airlines' },
    { pattern: 'UA', normalized: 'United Airlines' },
    { pattern: 'SOUTHWEST AIR', normalized: 'Southwest Airlines' },
    { pattern: 'WN', normalized: 'Southwest Airlines' },
    { pattern: 'DELTA AIR', normalized: 'Delta Airlines' },
    { pattern: 'DL', normalized: 'Delta Airlines' },
    
    // Hotels
    { pattern: 'MARRIOTT', normalized: 'Marriott' },
    { pattern: 'HILTON', normalized: 'Hilton' },
    { pattern: 'HYATT', normalized: 'Hyatt' },
    { pattern: 'IHG', normalized: 'InterContinental Hotels' },
    
    // Streaming services
    { pattern: 'NETFLIX', normalized: 'Netflix' },
    { pattern: 'HULU', normalized: 'Hulu' },
    { pattern: 'DISNEY+', normalized: 'Disney Plus' },
    { pattern: 'DISNEY PLUS', normalized: 'Disney Plus' },
    { pattern: 'HBO MAX', normalized: 'HBO Max' },
    { pattern: 'HBOMAX', normalized: 'HBO Max' },
    
    // Food delivery
    { pattern: 'DOORDASH', normalized: 'DoorDash' },
    { pattern: 'DD', normalized: 'DoorDash' },
    { pattern: 'GRUBHUB', normalized: 'Grubhub' },
    { pattern: 'GH', normalized: 'Grubhub' },
    { pattern: 'POSTMATES', normalized: 'Postmates' },
    
    // Payment processors (often appear in descriptions)
    { pattern: 'SQ *', normalized: 'Square -' },
    { pattern: 'SQU*', normalized: 'Square -' },
    { pattern: 'PAYPAL *', normalized: 'PayPal -' },
    { pattern: 'PP*', normalized: 'PayPal -' },
    { pattern: 'VENMO', normalized: 'Venmo' },
    
    // Regex patterns for more complex matching
    { pattern: '^TST\\*', normalized: 'Toast -', isRegex: true },
    { pattern: '^SP\\s+', normalized: 'Service Provider -', isRegex: true },
    { pattern: '\\s+#\\d+$', normalized: '', isRegex: true }, // Remove store numbers
    { pattern: '\\s+\\d{4,}$', normalized: '', isRegex: true }, // Remove trailing numbers
  ];

  // Normalize a merchant name
  public normalize(merchantName: string): string {
    if (!merchantName) return '';
    
    let normalized = merchantName.toUpperCase().trim();
    
    // Remove common prefixes/suffixes
    normalized = this.removeCommonAffixes(normalized);
    
    // Apply alias mappings
    for (const alias of this.aliases) {
      if (alias.isRegex) {
        const regex = new RegExp(alias.pattern, 'gi');
        normalized = normalized.replace(regex, alias.normalized);
      } else {
        // Check for exact match or substring match
        if (normalized === alias.pattern || normalized.includes(alias.pattern)) {
          normalized = normalized.replace(alias.pattern, alias.normalized);
        }
      }
    }
    
    // Clean up the result
    normalized = this.cleanMerchantName(normalized);
    
    return normalized;
  }

  // Remove common prefixes and suffixes
  private removeCommonAffixes(name: string): string {
    // Remove common credit card processor prefixes
    const prefixes = ['TST*', 'SQ *', 'SQU*', 'PAYPAL *', 'PP*', 'SP '];
    for (const prefix of prefixes) {
      if (name.startsWith(prefix)) {
        name = name.substring(prefix.length);
      }
    }
    
    // Remove location indicators
    name = name.replace(/\s+(STORE|LOCATION|BRANCH)\s*#?\d+/gi, '');
    
    // Remove trailing transaction/reference numbers
    name = name.replace(/\s+\d{6,}$/, '');
    
    // Remove common suffixes
    const suffixes = [' INC', ' LLC', ' CORP', ' CO', ' LTD', ' COMPANY'];
    for (const suffix of suffixes) {
      if (name.endsWith(suffix)) {
        name = name.substring(0, name.length - suffix.length);
      }
    }
    
    return name;
  }

  // Clean up merchant name
  private cleanMerchantName(name: string): string {
    // Remove extra spaces
    name = name.replace(/\s+/g, ' ').trim();
    
    // Remove special characters at the beginning or end
    name = name.replace(/^[*\-\s]+|[*\-\s]+$/g, '');
    
    // Proper case formatting
    name = name.split(' ')
      .map(word => {
        if (word.length <= 2) return word; // Keep short words as-is (like "AT")
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
    
    return name;
  }

  // Calculate similarity between two merchant names with normalization
  public calculateSimilarity(merchant1: string, merchant2: string): number {
    const normalized1 = this.normalize(merchant1);
    const normalized2 = this.normalize(merchant2);
    
    // If normalized names are identical, return perfect match
    if (normalized1 === normalized2 && normalized1 !== '') {
      return 1.0;
    }
    
    // Use string-similarity library for fuzzy matching
    const similarity = stringSimilarity.compareTwoStrings(normalized1, normalized2);
    
    // Boost similarity if key words match
    const boost = this.calculateKeywordBoost(normalized1, normalized2);
    
    return Math.min(1.0, similarity + boost);
  }

  // Calculate bonus for matching key words
  private calculateKeywordBoost(name1: string, name2: string): number {
    const keywords1 = new Set(name1.split(' ').filter(w => w.length > 2));
    const keywords2 = new Set(name2.split(' ').filter(w => w.length > 2));
    
    if (keywords1.size === 0 || keywords2.size === 0) return 0;
    
    let matchingKeywords = 0;
    for (const keyword of keywords1) {
      if (keywords2.has(keyword)) {
        matchingKeywords++;
      }
    }
    
    // Calculate boost based on percentage of matching keywords
    const matchPercentage = matchingKeywords / Math.max(keywords1.size, keywords2.size);
    return matchPercentage * 0.2; // Max boost of 0.2
  }

  // Add a new alias
  public addAlias(pattern: string, normalized: string, isRegex: boolean = false): void {
    this.aliases.push({ pattern, normalized, isRegex });
  }

  // Get all aliases (for admin UI)
  public getAliases(): MerchantAlias[] {
    return [...this.aliases];
  }

  // Update aliases from configuration
  public updateAliases(newAliases: MerchantAlias[]): void {
    this.aliases = newAliases;
  }

  // Load aliases from database or configuration file
  public async loadAliases(): Promise<void> {
    try {
      // In production, this would load from database or config file
      // For now, we're using the hardcoded list above
      console.log(`Loaded ${this.aliases.length} merchant aliases`);
    } catch (error) {
      console.error('Error loading merchant aliases:', error);
    }
  }

  // Save aliases to database or configuration file
  public async saveAliases(): Promise<void> {
    try {
      // In production, this would save to database or config file
      console.log('Merchant aliases saved');
    } catch (error) {
      console.error('Error saving merchant aliases:', error);
    }
  }
}

// Singleton instance
export const merchantNormalizer = new MerchantNormalizer();