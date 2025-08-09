# Receipt Processing System

The receipt processing system handles multi-file uploads, manual data entry, and automatic organization with intelligent fallbacks.

## Overview

The system prioritizes speed and user control over automated processing, providing instant receipt uploads with manual data entry capabilities.

## Key Features

### Multi-File Upload
- **Batch Processing**: Upload up to 10 receipts simultaneously
- **Progress Tracking**: Real-time upload progress with individual file status
- **Format Support**: Images (JPG, PNG) and PDF documents
- **Size Limits**: 10MB per file maximum
- **Direct Cloud Upload**: Files upload directly to Google Cloud Storage via presigned URLs

### Manual Data Entry
- **Instant Processing**: No waiting for OCR processing (disabled due to 30+ minute processing times)
- **Required Fields**: Merchant, amount, date, and category
- **Smart Validation**: Real-time form validation with helpful error messages
- **Batch Operations**: Process multiple receipts efficiently

### Processing Workflow

1. **Upload Phase**
   - Files uploaded to temporary storage location
   - Initial metadata extracted (filename, size, type)
   - Receipt records created with "pending" status

2. **Manual Entry Phase**
   - User provides essential receipt data
   - System validates input formats
   - Receipt status updated to "completed"

3. **Organization Phase**
   - Automatic folder assignment based on matching status
   - Oracle-friendly filename generation
   - Statement period association (if matched)

## Status Management

### Processing States
- `pending` - Uploaded but needs manual data entry
- `completed` - All required data provided
- `matched` - Linked to an AMEX charge
- `organized` - Filed in appropriate folder structure

### Status Indicators
- **Yellow Badge**: "Needs Entry" - Manual data required
- **Green Badge**: "Matched" - Successfully linked to AMEX charge
- **Blue Badge**: "Completed" - All data provided

## Data Requirements

### Essential Fields
- **Merchant**: Business name or description
- **Amount**: Dollar amount (formatted as XX.XX)
- **Date**: Transaction date (MM/DD/YYYY format)
- **Category**: Expense category for reporting

### Optional Fields
- **Notes**: Additional description or comments
- **Project Code**: For project-specific expense tracking
- **Personal Flag**: Mark as personal expense (excluded from business reports)

## File Organization

### Automatic Folder Structure
```
/objects/
├── Inbox_New/           # Unprocessed receipts
├── statements/
│   ├── {statement-id}/
│   │   ├── Matched/     # Receipts linked to AMEX charges
│   │   └── Unmatched/   # Receipts without AMEX matches
```

### Oracle iExpense Naming Convention
Format: `DATE_MERCHANT_$AMOUNT_RECEIPT.ext`

Examples:
- `2025-03-06_CAFE_LANDWER_$14DOT79_RECEIPT.JPG`
- `2025-08-09_OFFICE_SUPPLIES_$45DOT23_RECEIPT.PDF`

### Intelligent Fallbacks
When data is missing, the system uses fallback values:
- Missing date: `UNKNOWN_DATE`
- Missing merchant: `UNKNOWN_MERCHANT`
- Missing amount: `UNKNOWN_AMOUNT`

## Integration Points

### AMEX Matching
- Receipts automatically attempt matching with imported AMEX charges
- Successful matches populate missing receipt data from charge information
- Cross-statement matching allows receipts to match charges from any period

### Oracle iExpense Export
- Properly formatted filenames for direct Oracle import
- Metadata preserved for expense report generation
- Category mapping for Oracle expense types

## Error Handling

### Common Issues
- **File Too Large**: Split large files or compress before upload
- **Invalid Format**: Convert to supported formats (JPG, PNG, PDF)
- **Missing Data**: Complete manual entry form before proceeding
- **Upload Failures**: Retry upload or check network connection

### Recovery Options
- **Re-upload**: Replace failed uploads
- **Edit Data**: Modify receipt information after initial entry
- **Delete**: Remove unwanted or duplicate receipts
- **Reorganize**: Force reorganization with updated data

## Performance Considerations

### OCR Disabled
- Traditional OCR processing took 30+ minutes per receipt
- Manual entry provides instant completion
- Users maintain full control over data accuracy

### Batch Processing
- Multiple receipts processed in parallel
- Progress tracking prevents user confusion
- Error isolation prevents batch failures

## Security Features

### Access Control
- User-specific receipt access via authentication
- Object-level permissions in cloud storage
- Session-based security for all operations

### Data Privacy
- Receipts stored with user-specific ACL policies
- No cross-user access to receipt data
- Secure deletion with proper cleanup

## Future Enhancements

See [Pending Features](./pending-features.md) for planned improvements to the receipt processing system.