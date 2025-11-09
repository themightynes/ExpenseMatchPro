import { logger, createError } from './logger';

/**
 * Email service for manual email content processing
 * Handles receipt extraction from email body content
 */
export class EmailService {
  /**
   * Extract receipt information from email body
   * Used by the manual copy-paste email processing endpoint
   */
  extractReceiptFromEmailBody(emailBody: string, subject?: string, sender?: string): {
    merchant?: string;
    amount?: string;
    date?: string;
    items?: string[];
  } | null {
    try {
      // Remove HTML tags if present
      const cheerio = require('cheerio');
      const $ = cheerio.load(emailBody);
      const text = $.text();

      // Common patterns for receipt information in email bodies
      const amountPatterns = [
        /(?:total|amount|subtotal|sum):?\s*\$?(\d+\.?\d{0,2})/i,
        /\$(\d+\.\d{2})/,
        /(\d+\.\d{2})\s*(?:USD|usd|\$)/,
      ];

      const merchantPatterns = [
        /(?:from|at|@)\s+([A-Za-z\s&'.-]{3,30})/i,
        /^([A-Za-z][A-Za-z\s&'.-]{3,25})/m,
      ];

      const datePatterns = [
        /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
        /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})/i,
      ];

      let merchant: string | undefined;
      let amount: string | undefined;
      let date: string | undefined;

      // Extract amount
      for (const pattern of amountPatterns) {
        const match = text.match(pattern);
        if (match) {
          amount = match[1];
          break;
        }
      }

      // Extract merchant
      for (const pattern of merchantPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          merchant = match[1].trim();
          break;
        }
      }

      // Extract date
      for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
          date = match[1];
          break;
        }
      }

      // Only return if we found meaningful information
      if (merchant || amount || date) {
        logger.debug('Successfully extracted receipt data from email', {
          operation: 'extractReceiptFromEmailBody',
          emailSubject: subject,
          hasMerchant: !!merchant,
          hasAmount: !!amount,
          hasDate: !!date,
        });
        return { merchant, amount, date };
      }

      logger.debug('No receipt information found in email body', {
        operation: 'extractReceiptFromEmailBody',
        emailSubject: subject,
        contentLength: emailBody.length,
        textLength: text.length,
      });
      return null;
    } catch (error) {
      logger.error('Failed to extract receipt data from email body', {
        operation: 'extractReceiptFromEmailBody',
        emailSubject: subject,
        sender: sender || 'unknown',
        contentLength: emailBody?.length || 0,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Re-throw with context preserved
      throw createError(
        `Failed to extract receipt data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
        {
          operation: 'extractReceiptFromEmailBody',
          emailSubject: subject,
        }
      );
    }
  }
}
