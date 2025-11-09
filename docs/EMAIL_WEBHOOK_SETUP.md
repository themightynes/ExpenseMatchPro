# Email Webhook Integration Setup Guide

## Overview

The email webhook integration allows users to forward receipt emails directly to the application. The system automatically processes emails, extracts receipt information, and creates receipt records.

## Architecture

```
User forwards email → CloudMailin → POST /api/webhooks/email → Process → Create Receipt
```

## Components

### 1. Webhook Endpoint
- **Route**: `POST /api/webhooks/email`
- **Location**: `server/routes.ts`
- **Authentication**: Sender whitelist validation
- **Response**: Immediate 200 OK (processing happens asynchronously)

### 2. Email Processing Service
- **File**: `server/emailWebhookService.ts`
- **Responsibilities**:
  - Parse CloudMailin payload
  - Validate sender against whitelist
  - Process attachments (PDFs, images)
  - Convert HTML/plain text emails to PDFs
  - Create receipt records
  - Trigger OCR processing

### 3. PDF Generation Service
- **File**: `server/pdfGenerator.ts`
- **Tools**:
  - **Puppeteer**: HTML → PDF conversion
  - **PDFKit**: Plain text → PDF conversion

## Installation

### 1. Install Dependencies

```bash
npm install puppeteer pdfkit
npm install --save-dev @types/pdfkit
```

### 2. Environment Variables

No additional environment variables required. The system uses existing:
- `R2_*` variables for object storage (or falls back to local storage)
- `DATABASE_URL` for database connection

### 3. CloudMailin Configuration

1. Sign up for CloudMailin account
2. Create a new webhook endpoint
3. Set webhook URL to: `https://your-domain.com/api/webhooks/email`
4. Configure format: **Multipart - Normalized**
5. Add forwarding address to CloudMailin

## Sender Whitelist

Currently hardcoded in `server/emailWebhookService.ts`:

```typescript
const ALLOWED_SENDERS = [
  'ernesto.chapa@gmail.com',
  'ernesto_chapa@tjx.com',
];
```

**To add more senders**: Edit the `ALLOWED_SENDERS` array in `emailWebhookService.ts`.

## Processing Flow

### 1. Email Received
- CloudMailin sends POST request with parsed email data
- Webhook endpoint validates payload structure
- Sender is checked against whitelist

### 2. Receipt Type Detection
Priority order:
1. **PDF/Image Attachments** → Process directly
2. **HTML Email Body** → Convert to PDF with Puppeteer
3. **Plain Text Email Body** → Convert to PDF with PDFKit

### 3. File Processing
- Attachments: Decode base64 → Upload to object storage
- HTML emails: Render HTML → Generate PDF → Upload
- Plain text: Format text → Generate PDF → Upload

### 4. Receipt Creation
- Create receipt record in database
- Set `processingStatus` to `'processing'`
- Trigger OCR processing asynchronously
- Attempt auto-assignment to statements
- Attempt auto-matching to charges

## CloudMailin Payload Format

```json
{
  "envelope": {
    "to": "webhook-address@cloudmailin.net",
    "from": "sender@example.com"
  },
  "headers": {
    "Subject": "Receipt from Amazon",
    "Date": "Mon, 9 Jan 2025 10:30:00 -0800"
  },
  "plain": "Plain text email body...",
  "html": "<html>HTML email body...</html>",
  "attachments": [
    {
      "file_name": "receipt.pdf",
      "content_type": "application/pdf",
      "size": 12345,
      "content": "base64-encoded-data..."
    }
  ]
}
```

## Testing

### Test Payload Example

```bash
curl -X POST http://localhost:3000/api/webhooks/email \
  -H "Content-Type: application/json" \
  -d '{
    "envelope": {
      "to": "test@cloudmailin.net",
      "from": "ernesto.chapa@gmail.com"
    },
    "headers": {
      "Subject": "Test Receipt",
      "Date": "Mon, 9 Jan 2025 10:30:00 -0800"
    },
    "plain": "Thank you for your purchase!\n\nTotal: $25.50\nMerchant: Test Store\nDate: 2025-01-09",
    "html": "<html><body><h1>Receipt</h1><p>Total: $25.50</p></body></html>"
  }'
```

### Expected Response

```json
{
  "success": true,
  "message": "Email received and processing started"
}
```

### Testing with PDF Attachment

```bash
# Create base64 encoded PDF (example)
PDF_BASE64=$(base64 -i test-receipt.pdf)

curl -X POST http://localhost:3000/api/webhooks/email \
  -H "Content-Type: application/json" \
  -d "{
    \"envelope\": {
      \"to\": \"test@cloudmailin.net\",
      \"from\": \"ernesto.chapa@gmail.com\"
    },
    \"headers\": {
      \"Subject\": \"Receipt Attachment\",
      \"Date\": \"Mon, 9 Jan 2025 10:30:00 -0800\"
    },
    \"plain\": \"Please find attached receipt.\",
    \"attachments\": [
      {
        \"file_name\": \"receipt.pdf\",
        \"content_type\": \"application/pdf\",
        \"size\": $(wc -c < test-receipt.pdf),
        \"content\": \"$PDF_BASE64\"
      }
    ]
  }"
```

## Error Handling

### Unauthorized Sender (403)
```json
{
  "error": "Unauthorized sender",
  "message": "Email from unauthorized@example.com is not authorized"
}
```

### Invalid Payload (400)
```json
{
  "error": "Invalid payload: missing envelope.from"
}
```

### Processing Errors
- Errors are logged but don't block webhook response
- Processing happens asynchronously
- Check server logs for detailed error information

## Logging

All operations are logged with structured metadata:

```typescript
logger.info('Processing webhook payload', {
  operation: 'processWebhookPayload',
  sender: 'user@example.com',
  subject: 'Receipt from Store',
  attachmentCount: 1,
  hasHtml: true,
  hasPlain: false,
});
```

## File Naming Convention

- **Attachments**: `email-attachment-{timestamp}-{original-filename}`
- **HTML PDFs**: `email-html-{timestamp}-{sanitized-subject}.pdf`
- **Text PDFs**: `email-text-{timestamp}-{sanitized-subject}.pdf`

## Performance Considerations

- **Puppeteer**: ~5MB dependency, requires headless Chrome
- **PDFKit**: ~1MB dependency, lightweight
- **Processing**: Asynchronous (webhook responds immediately)
- **OCR**: Triggered in background after receipt creation

## Security

1. **Sender Whitelist**: Only authorized emails are processed
2. **Payload Validation**: All CloudMailin data is validated
3. **Error Messages**: Don't expose sensitive information
4. **Rate Limiting**: Consider adding rate limiting for production

## Troubleshooting

### Puppeteer Installation Issues

If Puppeteer fails to install Chrome:
```bash
# Linux
sudo apt-get install -y chromium-browser

# macOS
brew install chromium

# Or use system Chrome
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

### PDF Generation Fails

- Check Puppeteer/PDFKit logs
- Verify HTML/text content is valid
- Check object storage permissions
- Review server logs for detailed errors

### Receipts Not Created

- Verify sender is in whitelist
- Check database connection
- Review OCR service logs
- Verify object storage upload succeeded

## Next Steps

1. **Add Webhook Signature Validation**: Validate CloudMailin signatures
2. **Rate Limiting**: Add rate limiting middleware
3. **Email Parsing Enhancement**: Use `mailparser` for better email parsing
4. **Retry Logic**: Add retry mechanism for failed processing
5. **Monitoring**: Add metrics and alerting for webhook health

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify CloudMailin webhook configuration
3. Test with sample payloads
4. Review error handling in code

