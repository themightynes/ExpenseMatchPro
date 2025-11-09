import { getStorage } from "./storageFactory";
import type { IStorageService } from "./storageFactory";
import { storage } from "./storage";
import { confidenceModel } from "./services/confidenceModel";
import { merchantNormalizer } from "./services/merchantNormalizer";
import type { Receipt } from "@shared/schema";

export class FileOrganizer {
  private objectStorage: IStorageService;

  constructor() {
    this.objectStorage = getStorage();
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
      
      // Use adaptive ML threshold instead of static calculation
      const adaptiveThreshold = await confidenceModel.getAdaptiveThreshold();
      const requiredConfidence = Math.min(adaptiveThreshold, this.calculateRequiredConfidence(receipt));
      
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
        // Calculate amount difference
        const receiptAmount = receipt.amount ? parseFloat(receipt.amount) : null;
        const chargeAmount = charge.amount ? Math.abs(parseFloat(charge.amount)) : null;
        const amountDiff = receiptAmount !== null && chargeAmount !== null
          ? Math.abs(receiptAmount - chargeAmount)
          : 999;
        const isExactAmount = amountDiff < 0.01; // Within 1 cent

        // Calculate date difference
        const dateDiff = receipt.date && charge.date
          ? Math.abs((new Date(receipt.date).getTime() - new Date(charge.date).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        // Check for exact merchant match (normalized, case-insensitive)
        const normalizedReceiptMerchant = receipt.merchant
          ? receipt.merchant.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
          : '';
        const normalizedChargeDesc = charge.description
          ? charge.description.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
          : '';
        const isExactMerchant = normalizedReceiptMerchant && normalizedChargeDesc
          && normalizedReceiptMerchant === normalizedChargeDesc;

        let confidence = 0;
        const reasons = [];

        // PRIORITY 1: Exact amount match gets highest confidence (95-100%)
        if (isExactAmount) {
          confidence = 95; // Base confidence for exact amount
          reasons.push("Exact amount match");
          
          // Add small bonus for exact merchant match
          if (isExactMerchant) {
            confidence += 5;
            reasons.push("Exact merchant match");
          }
        } else {
          // PRIORITY 2: Balance amount and date (60% amount, 40% date)
          
          // Calculate amount score (0-70 based on difference)
          let amountScore = 0;
          if (receiptAmount !== null && chargeAmount !== null) {
            if (amountDiff < 1.0) {
              amountScore = 70 - (amountDiff * 10); // Linear scale: $0.01 = 69.9, $1.00 = 60
              reasons.push(`Close amount match ($${amountDiff.toFixed(2)} difference)`);
            } else if (amountDiff < 5.0) {
              amountScore = 60 - ((amountDiff - 1.0) * 8); // $1.00 = 60, $5.00 = 28
              reasons.push(`Similar amount ($${amountDiff.toFixed(2)} difference)`);
            } else if (amountDiff < 10.0) {
              amountScore = 20 - ((amountDiff - 5.0) * 2); // $5.00 = 20, $10.00 = 10
              reasons.push(`Moderate amount difference ($${amountDiff.toFixed(2)})`);
            } else {
              amountScore = Math.max(0, 10 - (amountDiff - 10.0) * 0.5); // Diminishing returns
            }
            amountScore = Math.max(0, Math.min(70, amountScore)); // Clamp to 0-70
          }

          // Calculate date score (0-40 based on days difference)
          let dateScore = 0;
          if (receipt.date && charge.date) {
            if (dateDiff === 0) {
              dateScore = 40;
              reasons.push("Same date");
            } else if (dateDiff <= 1) {
              dateScore = 35;
              reasons.push("Within 1 day");
            } else if (dateDiff <= 3) {
              dateScore = 25;
              reasons.push("Within 3 days");
            } else if (dateDiff <= 7) {
              dateScore = 15;
              reasons.push("Within 1 week");
            } else if (dateDiff <= 14) {
              dateScore = 5;
              reasons.push("Within 2 weeks");
            }
          }

          // Combined: 60% amount, 40% date
          confidence = Math.round((amountScore * 0.6) + (dateScore * 0.4));

          // Add small bonus for exact merchant match (only if not exact amount)
          if (isExactMerchant) {
            confidence += 10;
            reasons.push("Exact merchant match");
          }
        }

        // Only include matches with reasonable confidence
        if (confidence > 25) {
          suggestions.push({
            charge,
            confidence: Math.min(100, confidence), // Cap at 100%
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