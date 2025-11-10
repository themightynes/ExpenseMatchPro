import PDFDocument from 'pdfkit';
import puppeteer from 'puppeteer';
import { logger } from './logger';

/**
 * PDF generation service for email content
 * Handles HTML and plain text email conversion to PDF
 */
export class PDFGenerator {
  /**
   * Convert HTML email body to PDF using Puppeteer
   */
  async htmlToPdf(html: string, options?: { subject?: string; sender?: string; date?: string }): Promise<Buffer> {
    const { subject, sender, date } = options || {};
    
    logger.debug('Starting HTML to PDF conversion', {
      operation: 'htmlToPdf',
      htmlLength: html.length,
      hasSubject: !!subject,
    });

    let browser;
    try {
      // Launch headless browser
      // Use system Chromium if available (for Docker/production)
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
      
      browser = await puppeteer.launch({
        headless: true,
        executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-software-rasterizer',
        ],
      });

      const page = await browser.newPage();
      
      // Set viewport for consistent rendering
      await page.setViewport({ width: 1200, height: 1600 });

      // Wrap HTML with proper structure if needed
      const wrappedHtml = this.wrapHtmlContent(html, subject, sender, date);

      // Set content and wait for any images/fonts to load
      await page.setContent(wrappedHtml, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      });

      logger.info('Successfully converted HTML to PDF', {
        operation: 'htmlToPdf',
        pdfSize: pdfBuffer.length,
        subject,
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      logger.error('Failed to convert HTML to PDF', {
        operation: 'htmlToPdf',
        htmlLength: html.length,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Convert plain text email body to PDF using PDFKit
   */
  async textToPdf(text: string, options?: { subject?: string; sender?: string; date?: string }): Promise<Buffer> {
    const { subject, sender, date } = options || {};
    
    logger.debug('Starting text to PDF conversion', {
      operation: 'textToPdf',
      textLength: text.length,
      hasSubject: !!subject,
    });

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: {
            top: 50,
            bottom: 50,
            left: 50,
            right: 50,
          },
        });

        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          logger.info('Successfully converted text to PDF', {
            operation: 'textToPdf',
            pdfSize: pdfBuffer.length,
            subject,
          });
          resolve(pdfBuffer);
        });
        doc.on('error', (error) => {
          logger.error('PDFKit error during text conversion', {
            operation: 'textToPdf',
            error: error.message,
          });
          reject(error);
        });

        // Add email metadata header
        if (subject || sender || date) {
          doc.fontSize(10).fillColor('#666666');
          if (subject) {
            doc.text(`Subject: ${subject}`, { align: 'left' });
          }
          if (sender) {
            doc.text(`From: ${sender}`, { align: 'left' });
          }
          if (date) {
            doc.text(`Date: ${date}`, { align: 'left' });
          }
          doc.moveDown(1);
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown(1);
        }

        // Add email body content
        doc.fontSize(11).fillColor('#000000');
        doc.text(text, {
          align: 'left',
          lineGap: 5,
        });

        // Finalize document
        // Note: Footer addition removed due to PDFKit page switching issues
        // The footer can be added during content generation if needed in the future
        doc.end();
      } catch (error) {
        logger.error('Failed to convert text to PDF', {
          operation: 'textToPdf',
          textLength: text.length,
          error: error instanceof Error ? error.message : String(error),
        });
        reject(error);
      }
    });
  }

  /**
   * Wrap HTML content with proper structure and styling
   */
  private wrapHtmlContent(html: string, subject?: string, sender?: string, date?: string): string {
    // Check if HTML already has proper structure
    if (html.trim().toLowerCase().startsWith('<!doctype') || html.trim().toLowerCase().startsWith('<html')) {
      return html;
    }

    // Wrap with proper HTML structure
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .email-header {
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .email-header p {
      margin: 5px 0;
      color: #666;
      font-size: 14px;
    }
    .email-body {
      margin-top: 20px;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 15px 0;
    }
    table td, table th {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    table th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
  </style>
</head>
<body>
  ${subject || sender || date ? `
    <div class="email-header">
      ${subject ? `<p><strong>Subject:</strong> ${this.escapeHtml(subject)}</p>` : ''}
      ${sender ? `<p><strong>From:</strong> ${this.escapeHtml(sender)}</p>` : ''}
      ${date ? `<p><strong>Date:</strong> ${this.escapeHtml(date)}</p>` : ''}
    </div>
  ` : ''}
  <div class="email-body">
    ${html}
  </div>
</body>
</html>`;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

export const pdfGenerator = new PDFGenerator();

