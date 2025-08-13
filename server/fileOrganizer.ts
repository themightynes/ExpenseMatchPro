import { ObjectStorageService } from "./objectStorage";
import { storage } from "./storage";
import type { Receipt } from "@shared/schema";

export class FileOrganizer {
  private objectStorage: ObjectStorageService;

  constructor() {
    this.objectStorage = new ObjectStorageService();
  }

  /**
   * Reorganizes a receipt file when it gets matched or updated
   */
  async organizeReceipt(receipt: Receipt): Promise<string> {
    try {
      if (!receipt.fileUrl) return receipt.fileUrl;

      const newPath = storage.getOrganizedPath(receipt);
      
      // If already organized or same path, return current path
      if (receipt.organizedPath === newPath || receipt.fileUrl === newPath) {
        return newPath;
      }

      // Move the file in object storage to the new organized location
      try {
        await this.objectStorage.moveObject(receipt.fileUrl, newPath);
        
        // Update both the organized path and the actual file URL to the new location
        await storage.updateReceipt(receipt.id, { 
          organizedPath: newPath,
          fileUrl: newPath 
        });
        
        console.log(`Receipt file moved from ${receipt.fileUrl} to ${newPath}`);
      } catch (moveError) {
        console.error("Error moving file in object storage:", moveError);
        
        // Still update the organized path for tracking, but keep original fileUrl
        await storage.updateReceiptPath(receipt.id, newPath);
        console.log(`Updated organized path to ${newPath}, but file remains at ${receipt.fileUrl}`);
      }
      
      return newPath;
    } catch (error) {
      console.error("Error organizing receipt file:", error);
      return receipt.fileUrl; // Return original on error
    }
  }

  /**
   * Auto-assigns a receipt to the appropriate statement based on date
   */
  async autoAssignToStatement(receiptId: string): Promise<Receipt | undefined> {
    try {
      const receipt = await storage.autoAssignReceiptToStatement(receiptId);
      
      if (receipt?.statementId) {
        // Reorganize file after assignment
        await this.organizeReceipt(receipt);
      }
      
      return receipt;
    } catch (error) {
      console.error("Error auto-assigning receipt to statement:", error);
      return undefined;
    }
  }

  /**
   * Automatically matches a receipt to a charge if confidence is high enough
   */
  async attemptAutoMatch(receiptId: string): Promise<{
    matched: boolean;
    matchedCharge?: any;
    confidence?: number;
    reason?: string;
  }> {
    try {
      const receipt = await storage.getReceipt(receiptId);
      if (!receipt) {
        return { matched: false };
      }

      const suggestions = await this.suggestMatching(receiptId);
      
      if (suggestions.suggestions.length === 0) {
        return { matched: false };
      }

      const bestMatch = suggestions.suggestions[0];
      
      // Progressive matching: lower threshold for early matching, but require higher confidence for fewer fields
      const requiredConfidence = this.calculateRequiredConfidence(receipt);
      if (bestMatch.confidence >= requiredConfidence) {
        console.log(`Auto-matching receipt ${receiptId} to charge ${bestMatch.charge.id} with ${bestMatch.confidence}% confidence (required: ${requiredConfidence}%): ${bestMatch.reason}`);
        
        // Update receipt as matched
        await storage.updateReceipt(receiptId, { 
          isMatched: true,
          matchedChargeId: bestMatch.charge.id
        });

        // Update charge as matched
        await storage.updateAmexCharge(bestMatch.charge.id, { 
          isMatched: true,
          receiptId: receiptId 
        });

        // Reorganize the receipt file
        const receipt = await storage.getReceipt(receiptId);
        if (receipt) {
          await this.organizeReceipt(receipt);
        }

        return {
          matched: true,
          matchedCharge: bestMatch.charge,
          confidence: bestMatch.confidence,
          reason: bestMatch.reason
        };
      }

      return { matched: false };
    } catch (error) {
      console.error("Error attempting auto-match:", error);
      return { matched: false };
    }
  }

  /**
   * Calculate required confidence threshold based on available data
   * More data = lower threshold, less data = higher threshold
   */
  private calculateRequiredConfidence(receipt: any): number {
    const hasAmount = Boolean(receipt.amount);
    const hasDate = Boolean(receipt.date);
    const hasMerchant = Boolean(receipt.merchant);
    
    const fieldCount = [hasAmount, hasDate, hasMerchant].filter(Boolean).length;
    
    switch (fieldCount) {
      case 3: return 75; // All fields: lower threshold
      case 2: return 85; // Two fields: moderate threshold
      case 1: return 95; // One field: high threshold (exact match needed)
      default: return 100; // No fields: impossible to match
    }
  }

  /**
   * Suggests a matching charge based on amount, date, and merchant
   */
  async suggestMatching(receiptId: string): Promise<{
    suggestions: Array<{
      charge: any;
      confidence: number;
      reason: string;
    }>;
  }> {
    try {
      const receipt = await storage.getReceipt(receiptId);
      if (!receipt || !receipt.statementId) {
        return { suggestions: [] };
      }

      const charges = await storage.getUnmatchedCharges(receipt.statementId);
      const suggestions = [];

      for (const charge of charges) {
        let confidence = 0;
        const reasons = [];

        // Amount matching (exact match = high confidence)
        if (receipt.amount && charge.amount) {
          const receiptAmount = parseFloat(receipt.amount);
          const chargeAmount = Math.abs(parseFloat(charge.amount));
          const amountDiff = Math.abs(receiptAmount - chargeAmount);
          
          if (amountDiff < 0.01) {
            confidence += 70;
            reasons.push("Exact amount match");
          } else if (amountDiff < 1.0) {
            confidence += 50;
            reasons.push("Close amount match");
          } else if (amountDiff < 5.0) {
            confidence += 25;
            reasons.push("Similar amount");
          }
        }

        // Date matching (same day = high confidence)
        if (receipt.date && charge.date) {
          const receiptDate = new Date(receipt.date).toDateString();
          const chargeDate = new Date(charge.date).toDateString();
          
          if (receiptDate === chargeDate) {
            confidence += 35;
            reasons.push("Same date");
          } else {
            // Check within 3 days
            const daysDiff = Math.abs(
              (new Date(receipt.date).getTime() - new Date(charge.date).getTime()) / 
              (1000 * 60 * 60 * 24)
            );
            
            if (daysDiff <= 1) {
              confidence += 25;
              reasons.push("Within 1 day");
            } else if (daysDiff <= 3) {
              confidence += 15;
              reasons.push("Within 3 days");
            }
          }
        }

        // Merchant matching (fuzzy match using string similarity)
        if (receipt.merchant && charge.description) {
          const stringSimilarity = require('string-similarity');
          const merchantLower = receipt.merchant.toLowerCase().trim();
          const descriptionLower = charge.description.toLowerCase().trim();
          
          // Calculate similarity score
          const similarity = stringSimilarity.compareTwoStrings(merchantLower, descriptionLower);
          
          if (similarity >= 0.8) {
            confidence += 25;
            reasons.push("High similarity merchant match");
          } else if (similarity >= 0.6) {
            confidence += 20;
            reasons.push("Good similarity merchant match");
          } else if (similarity >= 0.4) {
            confidence += 15;
            reasons.push("Moderate similarity merchant match");
          } else if (descriptionLower.includes(merchantLower) || merchantLower.includes(descriptionLower)) {
            confidence += 25;
            reasons.push("Merchant name match");
          } else {
            // Check for partial matches and common abbreviations
            const merchantWords = merchantLower.split(/\s+/);
            const matchingWords = merchantWords.filter(word => 
              word.length > 3 && descriptionLower.includes(word)
            );
            
            // Handle common merchant abbreviations (e.g., "AMZN" for "Amazon")
            const commonAbbreviations: Record<string, string[]> = {
              'amazon': ['amzn', 'amzn mktp'],
              'walmart': ['wal-mart', 'wmt'],
              'starbucks': ['sbux', 'sbk'],
              'mcdonalds': ['mcd', 'mcdonald'],
              'target': ['tgt'],
              'costco': ['costco wholesale'],
              'home depot': ['homedepot', 'home depot'],
              'best buy': ['bestbuy', 'bby']
            };
            
            for (const [fullName, abbrevs] of Object.entries(commonAbbreviations)) {
              if (merchantLower.includes(fullName) && abbrevs.some(abbrev => descriptionLower.includes(abbrev))) {
                confidence += 20;
                reasons.push(`Merchant abbreviation match (${fullName})`);
                break;
              }
              if (abbrevs.some(abbrev => merchantLower.includes(abbrev)) && descriptionLower.includes(fullName)) {
                confidence += 20;
                reasons.push(`Merchant abbreviation match (${fullName})`);
                break;
              }
            }
            
            if (matchingWords.length > 0) {
              confidence += 15;
              reasons.push(`Partial merchant match (${matchingWords.join(', ')})`);
            }
          }
        }

        if (confidence > 25) { // Include moderate-confidence matches for progressive matching
          suggestions.push({
            charge,
            confidence,
            reason: reasons.join(", ")
          });
        }
      }

      // Sort by confidence descending
      suggestions.sort((a, b) => b.confidence - a.confidence);

      return { suggestions: suggestions.slice(0, 3) }; // Top 3 suggestions
    } catch (error) {
      console.error("Error suggesting matches:", error);
      return { suggestions: [] };
    }
  }
}

export const fileOrganizer = new FileOrganizer();