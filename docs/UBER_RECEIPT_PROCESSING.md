# Uber Receipt Processing Documentation

## Overview
The expense management system includes intelligent Uber receipt detection and specialized field extraction for transportation expenses. The system automatically identifies Uber receipts and extracts comprehensive trip data for Oracle iExpense integration.

## Supported Formats

### Image Receipts (Recommended)
- **Formats**: PNG, JPG, JPEG, GIF, BMP, TIFF
- **Processing**: Tesseract.js OCR with intelligent pattern recognition
- **Performance**: Fast and accurate extraction of all transportation fields

### PDF Receipts
- **Processing**: Two-stage approach
  1. Direct text extraction using pdf-parse
  2. Fallback to PDF-to-image conversion with OCR
- **Note**: For best results with Uber receipts, upload as images (PNG/JPG)

## Extracted Fields

### Standard Receipt Fields
- **Merchant**: Automatically set to "Uber" when detected
- **Amount**: Final charge amount including all fees
- **Date**: Trip date from receipt
- **Category**: Automatically set to "TAXI" for transportation expenses

### Transportation-Specific Fields
- **From Address** (fromAddress): Pickup location with full address
- **To Address** (toAddress): Dropoff location with full address  
- **Trip Distance** (tripDistance): Distance traveled (e.g., "1.76 miles")
- **Trip Duration** (tripDuration): Time of trip (e.g., "5 minutes")
- **Driver Name** (driverName): Name of the driver
- **Vehicle Info** (vehicleInfo): Vehicle details when available
- **Payment Method**: Credit card or payment method used
- **Fees Breakdown**: Individual fees and surcharges

## Detection Patterns

The system uses multiple indicators to identify Uber receipts:

1. **Header Detection**: "Uber" in the first few lines
2. **Receipt Format**: "Here's your receipt for your ride"
3. **Structure Patterns**: 
   - Trip fare section
   - Subtotal line items
   - Payment section
4. **Location Format**: Time stamps with addresses (e.g., "4:13 AM | Address")
5. **Driver Pattern**: "You rode with [Name]"
6. **Distance/Duration**: "X miles | Y min" format

## User Interface

### Receipt Viewer
When a receipt is categorized as TAXI:
- Displays standard receipt fields (merchant, amount, date)
- Shows dedicated "Trip Details" section with:
  - Pickup and dropoff locations
  - Trip distance and duration
  - Driver information
  - Vehicle details (when available)

### Editing Transportation Receipts
- Edit form includes all transportation fields
- Fields appear when TAXI category is selected
- Pre-populated with extracted data from OCR

### OCR Results Display
- "Extracted Text" section shows raw OCR text
- "Parsed Data" section displays structured fields
- Transportation fields clearly labeled and formatted

## Processing Workflow

### New Receipt Upload
1. User uploads Uber receipt (image or PDF)
2. System processes with OCR
3. Automatic Uber detection triggers
4. Transportation fields extracted
5. Category set to TAXI
6. Data displayed in specialized UI

### Reprocessing Existing Receipts
1. Open any receipt in viewer
2. Click "Re-extract Text" button
3. Enhanced Uber detection runs
4. Transportation fields updated
5. Category changed to TAXI if Uber detected

## Oracle iExpense Integration

Transportation receipts include comprehensive location and trip data for accurate expense reporting:

### Export Fields
- Standard expense fields (date, amount, merchant)
- Pickup/dropoff locations for mileage tracking
- Trip details for policy compliance
- Payment method for reimbursement processing

### Naming Convention
Uber receipts follow Oracle-friendly naming:
```
DATE_UBER_$AMOUNT_RECEIPT.ext
```
Example: `2025-06-09_UBER_$23.92_RECEIPT.png`

## Best Practices

### For Users
1. **Upload as Images**: PNG/JPG format works best for Uber receipts
2. **Clear Photos**: Ensure text is readable in uploaded images
3. **Complete Receipts**: Include all receipt sections in image
4. **Use Re-extract**: Reprocess older receipts for enhanced detection

### For Developers
1. **Pattern Updates**: Add new detection patterns in `ocrService.ts`
2. **Field Mapping**: Update `extractUberData()` for new fields
3. **UI Components**: Extend `ReceiptViewer.tsx` for additional fields
4. **Database Schema**: Add fields to `receipts` table as needed

## Troubleshooting

### Common Issues

**PDF Processing Fails**
- Solution: Upload receipt as PNG/JPG image instead
- Cause: Complex PDF format or missing system dependencies

**Missing Transportation Fields**
- Solution: Click "Re-extract Text" to reprocess
- Cause: Receipt uploaded before enhanced detection

**Incorrect Field Extraction**
- Solution: Manually edit fields in receipt viewer
- Cause: Non-standard receipt format or OCR quality

### Debug Information
Check server logs for:
- "Uber receipt detected" confirmation
- "Extracted Uber data" with field values
- OCR processing status and errors

## Technical Implementation

### Key Files
- `server/ocrService.ts`: OCR processing and Uber detection logic
- `shared/schema.ts`: Database schema with transportation fields
- `client/src/components/ReceiptViewer.tsx`: UI for displaying trip details
- `client/src/components/FileUploadZone.tsx`: Upload interface

### Database Fields
```typescript
// Transportation-specific fields in receipts table
fromAddress: text('from_address'),
toAddress: text('to_address'),  
tripDistance: text('trip_distance'),
tripDuration: text('trip_duration'),
driverName: text('driver_name'),
vehicleInfo: text('vehicle_info')
```

### Detection Algorithm
1. Text extraction via OCR
2. Pattern matching for Uber indicators
3. Location extraction from time-stamped addresses
4. Fee parsing and summation
5. Driver and vehicle info extraction
6. Category assignment and field population

## Future Enhancements

- [ ] Support for Lyft receipts
- [ ] Multi-page PDF processing
- [ ] Automatic currency conversion
- [ ] Integration with expense policies
- [ ] Batch processing for multiple receipts
- [ ] ML-based field extraction improvement