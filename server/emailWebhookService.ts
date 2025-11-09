import { logger } from './logger';
import { getStorage } from './storageFactory';
import { pdfGenerator } from './pdfGenerator';
import { ocrService } from './ocrService';
import { storage } from './storage';
import type { InsertReceipt } from '@shared/schema';

/**
 * Whitelist of allowed email senders
 * Only emails from these addresses will be processed
 */
const ALLOWED_SENDERS = [
  'ernesto.chapa@gmail.com',
  'ernesto_chapa@tjx.com',
].map(email => email.toLowerCase());

/**
 * CloudMailin webhook payload structure
 */
interface CloudMailinAttachment {
  file_name: string;
  content_type: string;
  size: number;
  content: string; // base64 encoded
}

interface CloudMailinPayload {
  envelope: {
    to: string;
    from: string;
  };
  headers: {
    Subject?: string;
    Date?: string;
    [key: string]: string | undefined;
  };
  plain?: string;
  html?: string;
  attachments?: CloudMailinAttachment[];
}

/**
 * Processed receipt result
 */
interface ProcessedReceipt {
  fileName: string;
  fileUrl: string;
  contentType: string;
  source: 'attachment' | 'html_pdf' | 'text_pdf';
}

/**
 * Email webhook processing service
 * Handles CloudMailin webhook payloads and processes receipts
 */
export class EmailWebhookService {
  private objectStorage = getStorage();

  /**
   * Extract email address from "Name <email@domain.com>" format
   */
  extractEmail(from: string): string {
    // Handle "Name <email@domain.com>" format
    const match = from.match(/<(.+?)>/);
    if (match) {
      return match[1].toLowerCase().trim();
    }
    // Handle simple email format
    return from.toLowerCase().trim();
  }

  /**
   * Extract sender email from payload - tries multiple possible locations
   */
  extractSenderEmail(payload: any): string {
    // Try multiple possible locations for sender email
    const senderEmail = 
      payload.envelope?.from || 
      payload.envelope?.sender || 
      payload.from || 
      payload.headers?.From ||
      payload.headers?.from;

    if (!senderEmail) {
      logger.error('Failed to extract sender email from payload', {
        operation: 'extractSenderEmail',
        payloadKeys: Object.keys(payload),
        envelopeKeys: payload.envelope ? Object.keys(payload.envelope) : [],
        headersKeys: payload.headers ? Object.keys(payload.headers) : [],
      });
      throw new Error('Invalid payload: missing sender email');
    }

    // Extract clean email address
    const cleanEmail = this.extractEmail(senderEmail);
    
    logger.debug('Extracted sender email', {
      operation: 'extractSenderEmail',
      original: senderEmail,
      extracted: cleanEmail,
    });

    return cleanEmail;
  }

  /**
   * Validate sender against whitelist
   */
  validateSender(senderEmail: string): boolean {
    const normalizedSender = senderEmail.toLowerCase().trim();
    const isAllowed = ALLOWED_SENDERS.includes(normalizedSender);
    
    if (!isAllowed) {
      logger.warn('Unauthorized email sender attempted webhook', {
        operation: 'validateSender',
        senderEmail: normalizedSender,
        allowedSenders: ALLOWED_SENDERS,
      });
    } else {
      logger.info('Sender authorized', {
        operation: 'validateSender',
        senderEmail: normalizedSender,
      });
    }
    
    return isAllowed;
  }

  /**
   * Parse and validate CloudMailin payload - flexible structure handling
   */
  parsePayload(body: any): any {
    if (!body || typeof body !== 'object') {
      logger.error('Invalid payload: empty or not an object', {
        operation: 'parsePayload',
        bodyType: typeof body,
        bodyValue: body,
      });
      throw new Error('Invalid payload: must be an object');
    }

    // Log full payload structure for debugging
    logger.debug('Parsing CloudMailin payload', {
      operation: 'parsePayload',
      payloadKeys: Object.keys(body),
      hasEnvelope: !!body.envelope,
      hasHeaders: !!body.headers,
      envelopeKeys: body.envelope ? Object.keys(body.envelope) : [],
      headersKeys: body.headers ? Object.keys(body.headers) : [],
    });

    // Extract sender email (will throw if not found)
    const senderEmail = this.extractSenderEmail(body);

    // Validate sender
    if (!this.validateSender(senderEmail)) {
      throw new Error(`Unauthorized sender: ${senderEmail}`);
    }

    // Headers are optional but preferred
    if (!body.headers) {
      logger.warn('Payload missing headers, using defaults', {
        operation: 'parsePayload',
      });
      body.headers = {};
    }

    return body;
  }

  /**
   * Decode base64 attachment content
   */
  decodeAttachment(attachment: CloudMailinAttachment): Buffer {
    try {
      const buffer = Buffer.from(attachment.content, 'base64');
      
      if (buffer.length !== attachment.size) {
        logger.warn('Attachment size mismatch', {
          operation: 'decodeAttachment',
          fileName: attachment.file_name,
          expectedSize: attachment.size,
          actualSize: buffer.length,
        });
      }

      return buffer;
    } catch (error) {
      logger.error('Failed to decode attachment', {
        operation: 'decodeAttachment',
        fileName: attachment.file_name,
        contentType: attachment.content_type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to decode attachment ${attachment.file_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process email attachments (PDFs and images)
   */
  async processAttachments(attachments: CloudMailinAttachment[]): Promise<ProcessedReceipt[]> {
    const processedReceipts: ProcessedReceipt[] = [];

    for (const attachment of attachments) {
      try {
        // Filter for receipt-like attachments
        const contentType = attachment.content_type.toLowerCase();
        const fileNameLower = attachment.file_name.toLowerCase();
        
        const isReceiptFile = 
          contentType.includes('pdf') ||
          contentType.includes('image') ||
          fileNameLower.includes('receipt') ||
          fileNameLower.includes('invoice') ||
          fileNameLower.includes('bill');

        if (!isReceiptFile) {
          logger.debug('Skipping non-receipt attachment', {
            operation: 'processAttachments',
            fileName: attachment.file_name,
            contentType: attachment.content_type,
          });
          continue;
        }

        logger.info('Processing attachment', {
          operation: 'processAttachments',
          fileName: attachment.file_name,
          contentType: attachment.content_type,
          size: attachment.size,
        });

        // Decode base64 content
        const buffer = this.decodeAttachment(attachment);

        // Generate safe filename
        const timestamp = Date.now();
        const sanitizedFileName = attachment.file_name
          .replace(/[^a-zA-Z0-9.-]/g, '_')
          .substring(0, 200);
        const fileName = `email-attachment-${timestamp}-${sanitizedFileName}`;

        // Upload to object storage
        const fileUrl = await this.objectStorage.uploadFile(
          buffer,
          fileName,
          attachment.content_type
        );

        processedReceipts.push({
          fileName,
          fileUrl,
          contentType: attachment.content_type,
          source: 'attachment',
        });

        logger.info('Successfully processed attachment', {
          operation: 'processAttachments',
          fileName: attachment.file_name,
          fileUrl,
        });
      } catch (error) {
        logger.error('Failed to process attachment', {
          operation: 'processAttachments',
          fileName: attachment.file_name,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue processing other attachments
      }
    }

    return processedReceipts;
  }

  /**
   * Process HTML email body by converting to PDF
   */
  async processHtmlEmail(html: string, subject?: string, sender?: string, date?: string): Promise<ProcessedReceipt | null> {
    try {
      logger.info('Processing HTML email body', {
        operation: 'processHtmlEmail',
        htmlLength: html.length,
        subject,
      });

      // Convert HTML to PDF
      const pdfBuffer = await pdfGenerator.htmlToPdf(html, { subject, sender, date });

      // Generate filename
      const timestamp = Date.now();
      const sanitizedSubject = (subject || 'email-receipt')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 100);
      const fileName = `email-html-${timestamp}-${sanitizedSubject}.pdf`;

      // Upload to object storage
      const fileUrl = await this.objectStorage.uploadFile(
        pdfBuffer,
        fileName,
        'application/pdf'
      );

      logger.info('Successfully processed HTML email', {
        operation: 'processHtmlEmail',
        fileName,
        fileUrl,
      });

      return {
        fileName,
        fileUrl,
        contentType: 'application/pdf',
        source: 'html_pdf',
      };
    } catch (error) {
      logger.error('Failed to process HTML email', {
        operation: 'processHtmlEmail',
        htmlLength: html.length,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Process plain text email body by converting to PDF
   */
  async processTextEmail(text: string, subject?: string, sender?: string, date?: string): Promise<ProcessedReceipt | null> {
    try {
      logger.info('Processing plain text email body', {
        operation: 'processTextEmail',
        textLength: text.length,
        subject,
      });

      // Convert text to PDF
      const pdfBuffer = await pdfGenerator.textToPdf(text, { subject, sender, date });

      // Generate filename
      const timestamp = Date.now();
      const sanitizedSubject = (subject || 'email-receipt')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 100);
      const fileName = `email-text-${timestamp}-${sanitizedSubject}.pdf`;

      // Upload to object storage
      const fileUrl = await this.objectStorage.uploadFile(
        pdfBuffer,
        fileName,
        'application/pdf'
      );

      logger.info('Successfully processed plain text email', {
        operation: 'processTextEmail',
        fileName,
        fileUrl,
      });

      return {
        fileName,
        fileUrl,
        contentType: 'application/pdf',
        source: 'text_pdf',
      };
    } catch (error) {
      logger.error('Failed to process plain text email', {
        operation: 'processTextEmail',
        textLength: text.length,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Create receipt record and trigger OCR processing
   */
  async createReceiptRecord(
    processedReceipt: ProcessedReceipt,
    emailSubject?: string,
    emailSender?: string,
    emailDate?: string
  ): Promise<any> {
    try {
      logger.info('Creating receipt record', {
        operation: 'createReceiptRecord',
        fileName: processedReceipt.fileName,
        source: processedReceipt.source,
      });

      // Create receipt data
      const receiptData: InsertReceipt = {
        fileName: processedReceipt.fileName,
        originalFileName: emailSubject 
          ? `Email Receipt - ${emailSubject}` 
          : processedReceipt.fileName,
        fileUrl: processedReceipt.fileUrl,
        processingStatus: 'processing',
        ocrText: 'Processing...',
      };

      // Create receipt record
      const receipt = await storage.createReceipt(receiptData);

      // Trigger OCR processing asynchronously
      ocrService.processReceipt(receipt.fileUrl, receipt.originalFileName)
        .then(async ({ ocrText, extractedData, extractionMethod, confidence }) => {
          logger.info('OCR processing completed', {
            operation: 'createReceiptRecord',
            receiptId: receipt.id,
            extractionMethod,
            confidence,
          });

          const updates: any = {
            ocrText,
            extractedData: {
              ...extractedData,
              extractionMethod,
              confidence,
              emailSource: processedReceipt.source,
              emailSubject,
              emailSender,
              emailDate,
            },
            processingStatus: 'completed',
          };

          // Auto-populate fields if extracted
          if (extractedData.merchant && !receipt.merchant) {
            updates.merchant = extractedData.merchant;
          }
          if (extractedData.amount && !receipt.amount) {
            updates.amount = extractedData.amount;
          }
          if (extractedData.date && !receipt.date) {
            updates.date = extractedData.date;
          }
          if (extractedData.category && !receipt.category) {
            updates.category = extractedData.category;
          }

          await storage.updateReceipt(receipt.id, updates);

          // Try auto-assignment and matching
          const updatedReceipt = await storage.autoAssignReceiptToStatement(receipt.id);
          if (updatedReceipt?.statementId) {
            await storage.attemptAutoMatch?.(receipt.id);
          }

          logger.info('Receipt processing completed', {
            operation: 'createReceiptRecord',
            receiptId: receipt.id,
            isMatched: updatedReceipt?.isMatched || false,
          });
        })
        .catch((error) => {
          logger.error('OCR processing failed', {
            operation: 'createReceiptRecord',
            receiptId: receipt.id,
            error: error instanceof Error ? error.message : String(error),
          });

          storage.updateReceipt(receipt.id, {
            ocrText: 'OCR failed - manual entry required',
            processingStatus: 'completed',
            extractedData: {
              emailSource: processedReceipt.source,
              emailSubject,
              emailSender,
              emailDate,
            },
          });
        });

      return receipt;
    } catch (error) {
      logger.error('Failed to create receipt record', {
        operation: 'createReceiptRecord',
        fileName: processedReceipt.fileName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process CloudMailin webhook payload
   * Main entry point for email processing
   */
  async processWebhookPayload(payload: any): Promise<{
    receiptsCreated: number;
    receipts: any[];
    errors: string[];
  }> {
    const receipts: any[] = [];
    const errors: string[] = [];

    try {
      // Extract sender email (already validated in parsePayload)
      const sender = this.extractSenderEmail(payload);
      
      // Extract email metadata - try multiple locations
      const subject = 
        payload.headers?.Subject || 
        payload.headers?.subject || 
        payload.subject || 
        'No Subject';
      
      const emailDate = 
        payload.headers?.Date || 
        payload.headers?.date || 
        payload.date || 
        new Date().toISOString();
      
      const attachments = payload.attachments || [];
      const hasHtml = !!payload.html;
      const hasPlain = !!payload.plain;

      logger.info('Processing webhook payload', {
        operation: 'processWebhookPayload',
        sender,
        subject,
        attachmentCount: attachments.length,
        hasHtml,
        hasPlain,
      });

      // Process attachments first (highest priority)
      if (attachments.length > 0) {
        const processedAttachments = await this.processAttachments(attachments);
        
        for (const attachment of processedAttachments) {
          try {
            const receipt = await this.createReceiptRecord(attachment, subject, sender, emailDate);
            receipts.push(receipt);
          } catch (error) {
            const errorMsg = `Failed to create receipt for attachment ${attachment.fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            logger.error(errorMsg, {
              operation: 'processWebhookPayload',
              fileName: attachment.fileName,
            });
          }
        }
      }

      // Process email body (only if no attachments or attachments don't contain receipts)
      if (receipts.length === 0) {
        let bodyProcessed = false;

        // Prefer HTML over plain text
        if (hasHtml) {
          const htmlReceipt = await this.processHtmlEmail(payload.html!, subject, sender, emailDate);
          if (htmlReceipt) {
            try {
              const receipt = await this.createReceiptRecord(htmlReceipt, subject, sender, emailDate);
              receipts.push(receipt);
              bodyProcessed = true;
            } catch (error) {
              const errorMsg = `Failed to create receipt for HTML email: ${error instanceof Error ? error.message : 'Unknown error'}`;
              errors.push(errorMsg);
              logger.error(errorMsg, {
                operation: 'processWebhookPayload',
              });
            }
          }
        }

        // Fallback to plain text if HTML processing failed or not available
        if (!bodyProcessed && hasPlain) {
          const textReceipt = await this.processTextEmail(payload.plain!, subject, sender, emailDate);
          if (textReceipt) {
            try {
              const receipt = await this.createReceiptRecord(textReceipt, subject, sender, emailDate);
              receipts.push(receipt);
            } catch (error) {
              const errorMsg = `Failed to create receipt for plain text email: ${error instanceof Error ? error.message : 'Unknown error'}`;
              errors.push(errorMsg);
              logger.error(errorMsg, {
                operation: 'processWebhookPayload',
              });
            }
          }
        }
      }

      logger.info('Webhook processing completed', {
        operation: 'processWebhookPayload',
        receiptsCreated: receipts.length,
        errorsCount: errors.length,
      });

      return {
        receiptsCreated: receipts.length,
        receipts,
        errors,
      };
    } catch (error) {
      logger.error('Failed to process webhook payload', {
        operation: 'processWebhookPayload',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}

export const emailWebhookService = new EmailWebhookService();

