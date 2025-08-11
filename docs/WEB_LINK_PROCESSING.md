# Web Link Processing Guide

## Overview

The Receipt Manager now supports processing web links alongside traditional file uploads. This feature enables users to paste URLs from Gmail attachments, Google Drive shares, and other web sources to automatically download and process receipt content.

## Supported URL Types

### Gmail Attachments
- **Format**: `https://mail.google.com/mail/...` or `https://mail-attachment.googleusercontent.com/...`
- **Processing**: Automatically downloads attachment content, uploads to secure storage, and runs OCR
- **Authentication**: Uses browser session cookies for access

### Google Drive Links
- **Format**: `https://drive.google.com/...`
- **Processing**: Attempts to download shared content if publicly accessible
- **Fallback**: Creates placeholder for manual data entry if access restricted

### Generic Web URLs
- **Format**: Any valid HTTP/HTTPS URL
- **Processing**: Attempts content download for image/PDF files
- **Fallback**: Creates receipt record with URL reference for manual entry

## User Interface

### Upload Receipt Section
The main upload interface now includes three methods:

1. **File Upload**: Traditional drag-and-drop or click-to-select file uploads
2. **Web Link Processing**: New URL input field with processing button
3. **Email Integration**: Existing email forwarding and integration options

### Web Link Input Features
- **Smart URL Validation**: Validates URL format before processing
- **Service Detection**: Automatically detects Gmail, Google Drive, and generic URLs
- **Processing Indicators**: Real-time status updates during download and OCR
- **Error Handling**: Clear feedback for failed downloads or processing

## Technical Implementation

### Frontend Components
- **FileUploadZone.tsx**: Enhanced with URL input field and processing logic
- **URL State Management**: Dedicated state for URL input and processing status
- **API Integration**: New mutation for URL processing endpoint

### Backend Processing
- **Endpoint**: `POST /api/receipts/process-url`
- **Authentication**: Requires valid user session
- **Content Download**: Fetches file content from accessible URLs
- **Storage Integration**: Uploads downloaded content to Google Cloud Storage
- **OCR Processing**: Runs Tesseract.js on downloaded images and PDFs

### Processing Flow
1. **URL Validation**: Checks URL format and accessibility
2. **Content Detection**: Identifies file type from response headers
3. **Download**: Fetches file content as binary buffer
4. **Upload**: Stores in secure object storage with proper ACL
5. **OCR Processing**: Extracts text and data from downloaded content
6. **Receipt Creation**: Creates receipt record with extracted information
7. **Auto-Assignment**: Attempts statement assignment and charge matching

## Security Considerations

### Access Control
- **Authentication Required**: All URL processing requires valid user session
- **Secure Storage**: Downloaded content stored with private ACL policies
- **URL Validation**: Input sanitization and format validation

### Privacy Protection
- **No URL Storage**: Original URLs not permanently stored in database
- **Content Isolation**: Downloaded files isolated per user session
- **Secure Transmission**: All uploads use HTTPS with proper headers

## Usage Examples

### Gmail Attachment Processing
```
1. User copies Gmail attachment URL
2. Pastes into web link input field
3. System downloads attachment content
4. Processes with OCR for text extraction
5. Creates receipt with extracted data
6. Auto-matches to AMEX charges if possible
```

### Google Drive File Processing
```
1. User shares Google Drive file link
2. System attempts content download
3. If successful, processes file normally
4. If restricted, creates placeholder for manual entry
5. User can manually add receipt details
```

## Error Handling

### Common Issues
- **403 Forbidden**: URL requires authentication or is private
- **404 Not Found**: Invalid or expired URL
- **Network Errors**: Connection timeouts or service unavailable
- **File Type**: Unsupported content type for OCR processing

### User Feedback
- **Success Messages**: Clear confirmation of successful processing
- **Error Messages**: Specific guidance for different failure types
- **Fallback Options**: Manual entry when automatic processing fails
- **Status Indicators**: Real-time processing status updates

## Future Enhancements

### Planned Features
- **Enhanced Authentication**: Direct Gmail API integration for private attachments
- **Batch Processing**: Support for multiple URLs in single operation
- **Cloud Storage Integration**: Direct OneDrive and Dropbox support
- **Advanced OCR**: Improved text extraction for complex receipt formats

### Performance Optimizations
- **Caching**: Temporary content caching for repeated URL access
- **Background Processing**: Improved async handling for large files
- **Error Recovery**: Automatic retry logic for transient failures
- **Rate Limiting**: Protection against abuse and excessive requests

## API Reference

### Process URL Endpoint
```typescript
POST /api/receipts/process-url
Authorization: Required (session-based)

Request Body:
{
  url: string // Valid HTTP/HTTPS URL
}

Response:
{
  id: string,
  fileName: string,
  processingStatus: 'processing' | 'completed' | 'failed',
  message: string
}
```

### Error Responses
```typescript
400 Bad Request: Invalid URL format
401 Unauthorized: Authentication required
403 Forbidden: Access denied to URL content
500 Internal Server Error: Processing failure
```

## Integration Notes

### Mobile Compatibility
- **Responsive Design**: URL input optimized for mobile devices
- **Touch-Friendly**: Large input fields and processing buttons
- **Network Handling**: Graceful handling of mobile network conditions

### Desktop Features
- **Keyboard Shortcuts**: Enter key submits URL for processing
- **Drag-and-Drop**: URL can be dragged from browser address bar
- **Context Menu**: Right-click paste for URL input

### Accessibility
- **Screen Reader Support**: Proper ARIA labels for URL input
- **Keyboard Navigation**: Full keyboard accessibility
- **Status Announcements**: Processing status announced to assistive technology

## Troubleshooting

### Common Solutions
1. **URL Access Issues**: Ensure URL is publicly accessible or user is logged into service
2. **Processing Failures**: Check file format compatibility (PDF, JPG, PNG supported)
3. **Network Errors**: Verify internet connection and URL validity
4. **Authentication Problems**: Refresh page and re-login if session expired

### Debug Information
- **Console Logs**: Detailed processing logs available in browser console
- **Server Logs**: Backend processing status logged for troubleshooting
- **Error Tracking**: Comprehensive error reporting for failed operations