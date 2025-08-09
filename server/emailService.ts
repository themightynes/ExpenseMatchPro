import { ConfidentialClientApplication } from '@azure/msal-node';
import axios from 'axios';
import { ObjectStorageService } from './objectStorage';
import { OCRService } from './ocrService';
import type { InsertReceipt } from '@shared/schema';

interface EmailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
}

interface EmailMessage {
  id: string;
  subject: string;
  body: string;
  sender: string;
  receivedDateTime: string;
  attachments: EmailAttachment[];
}

interface ProcessedReceipt {
  fileName: string;
  fileUrl: string;
  source: 'attachment' | 'email_body';
  emailSubject: string;
  emailDate: string;
}

export class EmailService {
  private msalClient: ConfidentialClientApplication | null = null;
  private objectStorage: ObjectStorageService;
  private ocrService: OCRService;
  private accessToken: string | null = null;

  constructor() {
    this.objectStorage = new ObjectStorageService();
    this.ocrService = new OCRService();
  }

  /**
   * Initialize Microsoft Graph API authentication
   */
  async initializeAuth(clientId: string, clientSecret: string, tenantId: string): Promise<void> {
    const clientConfig = {
      auth: {
        clientId,
        clientSecret,
        authority: `https://login.microsoftonline.com/${tenantId}`,
      },
    };

    this.msalClient = new ConfidentialClientApplication(clientConfig);
  }

  /**
   * Get access token for Microsoft Graph API
   */
  private async getAccessToken(): Promise<string> {
    if (!this.msalClient) {
      throw new Error('Email service not initialized. Call initializeAuth() first.');
    }

    try {
      const clientCredentialRequest = {
        scopes: ['https://graph.microsoft.com/.default'],
      };

      const response = await this.msalClient.acquireTokenByClientCredential(clientCredentialRequest);
      
      if (!response?.accessToken) {
        throw new Error('Failed to acquire access token');
      }

      this.accessToken = response.accessToken;
      return response.accessToken;
    } catch (error) {
      console.error('Error acquiring access token:', error);
      throw new Error('Failed to authenticate with Microsoft Graph API');
    }
  }

  /**
   * Search for emails containing receipts
   */
  async searchReceiptEmails(userEmail: string, daysBack: number = 30): Promise<EmailMessage[]> {
    const accessToken = await this.getAccessToken();
    
    // Calculate date filter
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startDateString = startDate.toISOString();

    // Search criteria for receipt-related emails
    const searchQuery = `(subject:receipt OR subject:invoice OR subject:bill OR subject:payment OR subject:order OR body:receipt OR body:invoice OR body:total OR body:amount) AND receivedDateTime ge ${startDateString}`;

    try {
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/users/${userEmail}/messages`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          params: {
            $search: searchQuery,
            $select: 'id,subject,body,sender,receivedDateTime,hasAttachments',
            $top: 100,
            $orderby: 'receivedDateTime desc',
          },
        }
      );

      const messages: EmailMessage[] = [];

      for (const message of response.data.value) {
        const attachments = message.hasAttachments 
          ? await this.getEmailAttachments(userEmail, message.id)
          : [];

        messages.push({
          id: message.id,
          subject: message.subject || '',
          body: message.body?.content || '',
          sender: message.sender?.emailAddress?.address || '',
          receivedDateTime: message.receivedDateTime,
          attachments,
        });
      }

      return messages;
    } catch (error) {
      console.error('Error searching receipt emails:', error);
      throw new Error('Failed to search emails');
    }
  }

  /**
   * Get attachments from an email
   */
  private async getEmailAttachments(userEmail: string, messageId: string): Promise<EmailAttachment[]> {
    const accessToken = this.accessToken || await this.getAccessToken();

    try {
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/users/${userEmail}/messages/${messageId}/attachments`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          params: {
            $select: 'id,name,contentType,size,isInline',
          },
        }
      );

      return response.data.value.filter((attachment: any) => {
        // Filter for receipt-like attachments
        const name = attachment.name?.toLowerCase() || '';
        const contentType = attachment.contentType?.toLowerCase() || '';
        
        return (
          // PDF receipts
          contentType.includes('pdf') ||
          // Image receipts
          contentType.includes('image') ||
          // Receipt-like filenames
          name.includes('receipt') ||
          name.includes('invoice') ||
          name.includes('bill')
        );
      });
    } catch (error) {
      console.error('Error getting email attachments:', error);
      return [];
    }
  }

  /**
   * Download attachment content
   */
  private async downloadAttachment(userEmail: string, messageId: string, attachmentId: string): Promise<Buffer> {
    const accessToken = this.accessToken || await this.getAccessToken();

    try {
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/users/${userEmail}/messages/${messageId}/attachments/${attachmentId}/$value`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          responseType: 'arraybuffer',
        }
      );

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      throw new Error('Failed to download attachment');
    }
  }

  /**
   * Extract receipt information from email body
   */
  private extractReceiptFromEmailBody(emailBody: string): {
    merchant?: string;
    amount?: string;
    date?: string;
    items?: string[];
  } | null {
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
      return { merchant, amount, date };
    }

    return null;
  }

  /**
   * Process emails and extract receipts
   */
  async processEmailsForReceipts(userEmail: string, daysBack: number = 30): Promise<ProcessedReceipt[]> {
    console.log(`Processing emails for receipts from ${userEmail} (last ${daysBack} days)`);
    
    const emails = await this.searchReceiptEmails(userEmail, daysBack);
    const processedReceipts: ProcessedReceipt[] = [];

    for (const email of emails) {
      console.log(`Processing email: ${email.subject}`);

      // Process attachments
      for (const attachment of email.attachments) {
        try {
          console.log(`Downloading attachment: ${attachment.name}`);
          const attachmentBuffer = await this.downloadAttachment(userEmail, email.id, attachment.id);
          
          // Upload to object storage
          const uploadUrl = await this.objectStorage.getObjectEntityUploadURL();
          
          // Upload the file
          const uploadResponse = await axios.put(uploadUrl, attachmentBuffer, {
            headers: {
              'Content-Type': attachment.contentType,
            },
          });

          if (uploadResponse.status === 200) {
            const fileUrl = this.objectStorage.normalizeObjectEntityPath(uploadUrl);
            
            processedReceipts.push({
              fileName: attachment.name,
              fileUrl,
              source: 'attachment',
              emailSubject: email.subject,
              emailDate: email.receivedDateTime,
            });

            console.log(`Successfully processed attachment: ${attachment.name}`);
          }
        } catch (error) {
          console.error(`Error processing attachment ${attachment.name}:`, error);
        }
      }

      // Process email body for embedded receipt information
      const bodyReceiptInfo = this.extractReceiptFromEmailBody(email.body);
      if (bodyReceiptInfo) {
        // Create a text-based receipt record
        const textReceiptData = {
          subject: email.subject,
          body: email.body,
          extractedInfo: bodyReceiptInfo,
          sender: email.sender,
          date: email.receivedDateTime,
        };

        // Convert to a simple text file and upload
        const textContent = `Email Receipt
Subject: ${email.subject}
From: ${email.sender}
Date: ${email.receivedDateTime}

Extracted Information:
Merchant: ${bodyReceiptInfo.merchant || 'Unknown'}
Amount: ${bodyReceiptInfo.amount || 'Unknown'}
Date: ${bodyReceiptInfo.date || 'Unknown'}

Original Email Body:
${email.body}`;

        try {
          const uploadUrl = await this.objectStorage.getObjectEntityUploadURL();
          const textBuffer = Buffer.from(textContent, 'utf-8');
          
          const uploadResponse = await axios.put(uploadUrl, textBuffer, {
            headers: {
              'Content-Type': 'text/plain',
            },
          });

          if (uploadResponse.status === 200) {
            const fileUrl = this.objectStorage.normalizeObjectEntityPath(uploadUrl);
            
            processedReceipts.push({
              fileName: `${email.subject.replace(/[^a-zA-Z0-9]/g, '_')}_email_receipt.txt`,
              fileUrl,
              source: 'email_body',
              emailSubject: email.subject,
              emailDate: email.receivedDateTime,
            });

            console.log(`Successfully processed email body receipt: ${email.subject}`);
          }
        } catch (error) {
          console.error(`Error processing email body receipt:`, error);
        }
      }
    }

    console.log(`Processed ${processedReceipts.length} receipts from ${emails.length} emails`);
    return processedReceipts;
  }

  /**
   * Import receipts from processed emails into the database
   */
  async importEmailReceipts(
    userEmail: string, 
    storage: any, 
    daysBack: number = 30
  ): Promise<{ imported: number; errors: string[] }> {
    const processedReceipts = await this.processEmailsForReceipts(userEmail, daysBack);
    const errors: string[] = [];
    let imported = 0;

    for (const receipt of processedReceipts) {
      try {
        // Create receipt record
        const receiptData: InsertReceipt = {
          fileName: receipt.fileName,
          originalFileName: receipt.fileName,
          fileUrl: receipt.fileUrl,
          processingStatus: 'processing',
          ocrText: 'Processing...',
        };

        const createdReceipt = await storage.createReceipt(receiptData);

        // Start OCR processing for attachments
        if (receipt.source === 'attachment') {
          this.ocrService.processReceipt(receipt.fileUrl, receipt.fileName)
            .then(async ({ ocrText, extractedData }) => {
              const updates: any = {
                ocrText,
                extractedData,
                processingStatus: 'completed'
              };

              // Auto-populate fields if extracted
              if (extractedData.merchant && !createdReceipt.merchant) {
                updates.merchant = extractedData.merchant;
              }
              if (extractedData.amount && !createdReceipt.amount) {
                updates.amount = extractedData.amount;
              }
              if (extractedData.date && !createdReceipt.date) {
                updates.date = extractedData.date;
              }
              if (extractedData.category && !createdReceipt.category) {
                updates.category = extractedData.category;
              }

              await storage.updateReceipt(createdReceipt.id, updates);

              // Try auto-assignment and matching
              const updatedReceipt = await storage.autoAssignReceiptToStatement(createdReceipt.id);
              if (updatedReceipt?.statementId) {
                await storage.attemptAutoMatch?.(createdReceipt.id);
              }
            })
            .catch((error) => {
              console.error(`OCR failed for ${receipt.fileName}:`, error);
              storage.updateReceipt(createdReceipt.id, {
                ocrText: 'OCR failed - manual entry required',
                processingStatus: 'completed',
                extractedData: null
              });
            });
        } else {
          // For email body receipts, mark as completed
          await storage.updateReceipt(createdReceipt.id, {
            ocrText: 'Email body receipt - extracted information available',
            processingStatus: 'completed',
          });
        }

        imported++;
        console.log(`Imported receipt: ${receipt.fileName}`);
      } catch (error) {
        const errorMsg = `Failed to import ${receipt.fileName}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return { imported, errors };
  }
}