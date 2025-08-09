// One-time script to fix receipts with "PDF processing" merchant names
import { storage } from './storage.js';
import type { UpdateReceiptData } from '../shared/schema.js';

export async function fixReceiptsWithBadMerchants() {
  try {
    const receipts = await storage.getAllReceipts();
    let fixedCount = 0;
    
    for (const receipt of receipts) {
      // Check for any problematic merchant names from OCR errors
      const isBadMerchant = receipt.merchant && (
        receipt.merchant.includes('PDF processing') ||
        receipt.merchant.includes('text extraction failed') ||
        receipt.merchant.includes('manual entry') ||
        receipt.merchant.includes('PDF receipt detected') ||
        receipt.merchant.includes('OCR text') ||
        receipt.merchant.includes('corrupted') ||
        receipt.merchant.includes('password-protected') ||
        receipt.merchant.includes('Unable to convert') ||
        receipt.merchant.length < 3 // Very short merchant names are likely errors
      );
      
      if (isBadMerchant) {
        
        console.log(`Fixing receipt ${receipt.id} with bad merchant: "${receipt.merchant}"`);
        
        // Clear the bad merchant name and reset processing status
        const updateData: UpdateReceiptData = {
          merchant: null,
          processingStatus: 'pending'
        };
        await storage.updateReceipt(receipt.id, updateData);
        
        fixedCount++;
      }
    }
    
    console.log(`Fixed ${fixedCount} receipts with invalid merchant names`);
    return fixedCount;
  } catch (error) {
    console.error('Error fixing receipt data:', error);
    throw error;
  }
}