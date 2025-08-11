# Oracle iExpense Integration

Complete integration with Oracle iExpense system including file naming conventions, export templates, metadata management, and comprehensive receipt download packages (Updated August 2025).

## Overview

The Oracle iExpense integration ensures seamless compatibility with enterprise expense reporting systems by implementing Oracle-specific naming conventions, export formats, and comprehensive receipt packaging. The system now includes advanced ZIP download functionality with standardized file naming, complete CSV exports, and smart data validation.

### Key Features (August 2025 Update)
- **ZIP Package Downloads**: Complete receipt packages with standardized naming
- **Dual Export System**: Both individual CSV exports and comprehensive ZIP packages
- **Smart Validation**: Assignment controls to ensure data completeness
- **File Naming Consistency**: Standardized [Date][Merchant][Amount] convention
- **Non-AMEX Support**: Clear identification of virtual charges with NON_AMEX suffix

## File Naming Convention

### Updated File Naming Format (August 2025)
**Pattern**: `[YYYYMMDD]_[Merchant]_[Amount]_NON_AMEX.ext` (for non-AMEX) or `[YYYYMMDD]_[Merchant]_[Amount].ext` (for AMEX)

**Components**:
- `Date`: YYYYMMDD format (20250806 for August 6, 2025)
- `Merchant`: Sanitized merchant name (alphanumeric only, max 20 chars)
- `Amount`: Dollar amount without decimal (1479 for $14.79)
- `NON_AMEX`: Suffix for virtual charges from non-AMEX business expenses
- `ext`: Original file extension (jpg, png, pdf)

### Examples
```
20250306_CafeLandwer_1479.jpg
20250809_OfficeSupplies_4523_NON_AMEX.pdf
20250715_Uber_2850.png
20250620_HotelBooking_35000_NON_AMEX.pdf
```

### Merchant Name Processing
1. **Remove Special Characters**: Strip non-alphanumeric characters
2. **Preserve Case**: Maintain original capitalization for readability
3. **Remove Spaces**: Convert spaces to empty string (no underscores)
4. **Length Limitation**: Truncate to 20 characters for consistency
5. **Fallback Values**: Use "Unknown" when merchant data missing

### Amount Formatting
- **Decimal Removal**: Remove decimal point (14.79 → 1479)
- **Zero Padding**: Natural formatting without padding
- **No Currency Symbol**: Amount only in filename
- **Fallback Values**: Use "000" when amount missing

### Non-AMEX Identification
- **NON_AMEX Suffix**: Added to distinguish virtual charges created from receipts
- **Visual Distinction**: Clear identification in ZIP downloads and file listings
- **Oracle Compatibility**: Maintains Oracle iExpense import compatibility

## Intelligent Fallback System

### Missing Data Handling
When receipt data is incomplete, the system uses intelligent fallbacks:

```javascript
// Fallback logic
const dateStr = receipt.date ? 
  receipt.date.toISOString().split('T')[0] : 
  'UNKNOWN_DATE';

const merchant = receipt.merchant ? 
  receipt.merchant.replace(/[^a-zA-Z0-9\s]/g, '')
                  .replace(/\s+/g, '_')
                  .toUpperCase()
                  .substring(0, 25) : 
  'UNKNOWN_MERCHANT';

const amount = receipt.amount ? 
  receipt.amount.replace(/\./g, 'DOT') : 
  'UNKNOWN_AMOUNT';
```

### Data Completion from AMEX
When receipts are matched to AMEX charges, missing data is automatically populated:
- **Merchant**: Uses AMEX charge description
- **Amount**: Uses exact charge amount
- **Date**: Uses charge transaction date

## Folder Organization

### Statement-Based Structure
```
/objects/statements/
├── {statement-id-1}/
│   ├── Matched/
│   │   ├── 2025-03-06_CAFE_LANDWER_$14DOT79_RECEIPT.JPG
│   │   ├── 2025-03-07_OFFICE_DEPOT_$25DOT50_RECEIPT.PDF
│   │   └── 2025-03-08_UBER_$18DOT25_RECEIPT.PNG
│   └── Unmatched/
│       ├── 2025-03-09_UNKNOWN_MERCHANT_$45DOT00_RECEIPT.JPG
│       └── 2025-03-10_LOCAL_CAFE_$12DOT75_RECEIPT.PDF
├── {statement-id-2}/
│   ├── Matched/
│   └── Unmatched/
└── Inbox_New/
    └── [unprocessed receipts with original names]
```

### Automatic Reorganization
- **Statement Assignment**: Receipts moved to appropriate statement folders
- **Match Status**: Separated into Matched/Unmatched subfolders
- **Name Updates**: Filenames updated to Oracle format
- **Path Tracking**: Database maintains both original and organized paths

## Export Templates

### Oracle CSV Format
```csv
Date,Merchant,Amount,Receipt_File,Category,Notes
2025-03-06,CAFE LANDWER,14.79,2025-03-06_CAFE_LANDWER_$14DOT79_RECEIPT.JPG,Meals,Business meal
2025-03-07,OFFICE DEPOT,25.50,2025-03-07_OFFICE_DEPOT_$25DOT50_RECEIPT.PDF,Supplies,Office supplies
```

### Metadata Preservation
- **Original Filename**: Maintained for reference
- **Upload Date**: Timestamp of initial upload
- **Processing History**: Complete audit trail
- **Matching Information**: Associated AMEX charge details

## Integration Workflow

### Automatic Processing
1. **Receipt Upload**: Initial file storage with original name
2. **Data Entry**: Manual or automatic data population
3. **Statement Assignment**: Association with AMEX statement (if matched)
4. **Name Generation**: Oracle-friendly filename creation
5. **File Reorganization**: Move to appropriate folder structure
6. **Database Update**: Update organized path and metadata

### Manual Corrections
- **Edit Receipt Data**: Update merchant, amount, or date
- **Trigger Reorganization**: Automatic rename and folder move
- **Maintain History**: Preserve original information
- **Update References**: Ensure all links remain valid

## Quality Assurance

### Validation Rules
- **Date Format**: Must be valid ISO 8601 date
- **Amount Format**: Must be valid decimal number
- **Merchant Length**: Cannot exceed 25 characters after processing
- **File Extension**: Must be preserved from original

### Error Prevention
- **Character Sanitization**: Remove problematic characters for Oracle
- **Path Length Limits**: Ensure total path length compliance
- **Duplicate Handling**: Prevent filename conflicts
- **Invalid Data**: Graceful handling of corrupted or missing data

## Performance Considerations

### Batch Operations
- **Bulk Reorganization**: Process multiple receipts efficiently
- **Progress Tracking**: Real-time status updates for large operations
- **Error Isolation**: Continue processing despite individual failures
- **Memory Management**: Efficient handling of large file sets

### Caching Strategy
- **Path Resolution**: Cache frequently accessed path calculations
- **Template Generation**: Pre-compute common export formats
- **Validation Results**: Cache validation outcomes
- **Metadata Queries**: Optimize database queries for file information

## Oracle Compliance

### Naming Standards
- **Length Limits**: Respect Oracle filesystem limitations
- **Character Set**: Use only Oracle-compatible characters
- **Case Sensitivity**: Handle case-insensitive filesystems
- **Reserved Words**: Avoid Oracle reserved keywords in names

### Data Integrity
- **Referential Integrity**: Maintain links between files and records
- **Audit Trail**: Complete history of all file operations
- **Backup Strategy**: Ensure file recoverability
- **Version Control**: Track file modifications and moves

## Troubleshooting

### Common Issues
- **Long Merchant Names**: Automatic truncation to 25 characters
- **Special Characters**: Automatic sanitization and replacement
- **Missing Data**: Intelligent fallback values used
- **Duplicate Names**: Automatic suffix addition for uniqueness

### Resolution Strategies
- **Manual Override**: Allow user correction of generated names
- **Bulk Correction**: Fix issues across multiple receipts
- **History Preservation**: Maintain record of all naming decisions
- **Validation Feedback**: Clear error messages for invalid data

## API Integration

### File Organization Endpoints
- `POST /api/receipts/fix-and-reorganize`: Bulk reorganization operation
- `PUT /api/receipts/:id/organize`: Single receipt reorganization
- `GET /api/receipts/:id/oracle-name`: Preview Oracle filename
- `POST /api/export/oracle`: Generate Oracle export package

### Response Format
```javascript
{
  "organizedPath": "/objects/statements/uuid/Matched/2025-03-06_CAFE_LANDWER_$14DOT79_RECEIPT.JPG",
  "oracleName": "2025-03-06_CAFE_LANDWER_$14DOT79_RECEIPT.JPG",
  "status": "organized",
  "metadata": {
    "originalName": "IMG_1234.JPG",
    "merchant": "CAFE LANDWER",
    "amount": "14.79",
    "date": "2025-03-06"
  }
}
```

## Future Enhancements

### Advanced Features
- **Custom Templates**: User-configurable naming templates
- **Category Integration**: Include expense categories in filenames
- **Project Codes**: Support for project-specific naming
- **Multi-format Export**: Support for various Oracle import formats

### Integration Improvements
- **Direct Oracle API**: Real-time integration with Oracle systems
- **Validation Service**: Pre-upload validation against Oracle rules
- **Bulk Upload**: Direct upload to Oracle from application
- **Synchronization**: Two-way sync with Oracle expense systems

See [Pending Features](./pending-features.md) for detailed roadmap of Oracle integration enhancements.