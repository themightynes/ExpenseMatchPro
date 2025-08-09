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

      // TODO: Implement file moving in object storage
      // For now, we'll update the database path but keep the original file
      // In a full implementation, you'd move the file in the storage bucket
      
      await storage.updateReceiptPath(receipt.id, newPath);
      
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
            confidence += 60;
            reasons.push("Exact amount match");
          } else if (amountDiff < 1.0) {
            confidence += 40;
            reasons.push("Close amount match");
          } else if (amountDiff < 5.0) {
            confidence += 20;
            reasons.push("Similar amount");
          }
        }

        // Date matching (same day = high confidence)
        if (receipt.date && charge.date) {
          const receiptDate = new Date(receipt.date).toDateString();
          const chargeDate = new Date(charge.date).toDateString();
          
          if (receiptDate === chargeDate) {
            confidence += 30;
            reasons.push("Same date");
          } else {
            // Check within 3 days
            const daysDiff = Math.abs(
              (new Date(receipt.date).getTime() - new Date(charge.date).getTime()) / 
              (1000 * 60 * 60 * 24)
            );
            
            if (daysDiff <= 1) {
              confidence += 20;
              reasons.push("Within 1 day");
            } else if (daysDiff <= 3) {
              confidence += 10;
              reasons.push("Within 3 days");
            }
          }
        }

        // Merchant matching (fuzzy match)
        if (receipt.merchant && charge.description) {
          const merchantLower = receipt.merchant.toLowerCase();
          const descriptionLower = charge.description.toLowerCase();
          
          if (descriptionLower.includes(merchantLower)) {
            confidence += 25;
            reasons.push("Merchant name match");
          } else {
            // Check for partial matches
            const merchantWords = merchantLower.split(/\s+/);
            const matchingWords = merchantWords.filter(word => 
              word.length > 3 && descriptionLower.includes(word)
            );
            
            if (matchingWords.length > 0) {
              confidence += 15;
              reasons.push(`Partial merchant match (${matchingWords.join(', ')})`);
            }
          }
        }

        if (confidence > 30) { // Only include high-confidence matches
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