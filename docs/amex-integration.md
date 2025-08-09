# AMEX Integration System

Complete integration with American Express statement processing, including CSV import, charge management, and automatic organization.

## Overview

The AMEX integration system processes statement CSV files, creates statement periods, imports charges, and provides intelligent matching capabilities with receipt data.

## CSV Import Process

### File Format Support
- **Standard AMEX CSV Export**: Direct download from AMEX online portal
- **Column Recognition**: Automatic header detection and mapping
- **Date Format**: MM/DD/YYYY format processing
- **Encoding**: UTF-8 support with proper character handling

### Duplicate Prevention
- **Overlap Detection**: Checks for existing statements with overlapping date ranges
- **Charge Comparison**: Analyzes charge amounts and descriptions for potential duplicates
- **Warning System**: Returns 409 status with detailed duplicate information
- **User Override**: Option to proceed with import after reviewing warnings

### Import Workflow

1. **File Validation**
   - CSV format verification
   - Header column mapping
   - Required field validation

2. **Duplicate Check**
   - Compare date ranges with existing statements
   - Analyze charge patterns for overlaps
   - Generate warnings for user review

3. **Statement Creation**
   - Auto-generate statement period name
   - Calculate date range from charge data
   - Create statement folder structure

4. **Charge Processing**
   - Parse individual charge records
   - Skip payments and credits (AUTOPAY, PAYMENT)
   - Validate amounts and dates
   - Create charge records in database

5. **Receipt Auto-Assignment**
   - Attempt matching with existing unassigned receipts
   - Update receipt statement assignments
   - Trigger automatic reorganization

## Statement Management

### Automatic Period Detection
- **Date Range Calculation**: Determined from earliest and latest charge dates
- **Period Naming**: Format: "YYYY - MonthName Statement" (e.g., "2025 - August Statement")
- **Charge Count Tracking**: Total charges imported per statement
- **Status Management**: Active/inactive statement designation

### Statement Structure
```javascript
{
  id: "uuid",
  periodName: "2025 - August Statement",
  startDate: "2025-07-04T00:00:00.000Z",
  endDate: "2025-07-23T00:00:00.000Z",
  isActive: true,
  chargeCount: 27,
  receiptCount: 1,
  matchedCount: 1
}
```

## Charge Processing

### Data Extraction
- **Date**: MM/DD/YYYY format conversion to ISO dates
- **Description**: Merchant name and transaction details
- **Amount**: Decimal formatting and validation
- **Card Member**: Cardholder identification
- **Category**: AMEX-provided expense categories

### Filtering Rules
- **Exclude Payments**: Auto-skip AUTOPAY and PAYMENT transactions
- **Exclude Credits**: Filter out negative amounts and refunds
- **Date Validation**: Ensure valid date ranges and formats
- **Amount Validation**: Verify numeric amounts and formatting

### Charge Data Model
```javascript
{
  id: "uuid",
  date: Date,
  description: "CAFE LANDWER",
  amount: "14.79",
  category: "Restaurant",
  cardMember: "JOHN DOE",
  statementId: "statement-uuid",
  isMatched: false,
  receiptId: null,
  isPersonalExpense: false
}
```

## Personal Expense Management

### Personal Flagging
- **Toggle Interface**: Mark charges as personal vs. business expenses
- **Reporting Exclusion**: Personal expenses excluded from business reports
- **Visual Indicators**: Clear badges and styling for personal charges
- **Bulk Operations**: Mass update capabilities for efficiency

### Business vs Personal Split
- **Financial Reports**: Separate totals for business and personal amounts
- **Matching Logic**: Personal expenses can still be matched to receipts
- **Export Options**: Filter personal expenses from Oracle exports

## Matching Integration

### Automatic Matching Attempts
- **Date Range Matching**: Compare receipt dates with charge dates (±3 days)
- **Amount Matching**: Exact amount comparisons with tolerance
- **Merchant Similarity**: Text similarity scoring for merchant names
- **Cross-Statement Support**: Match receipts to charges across all periods

### Smart Data Population
- **Missing Merchant**: Populate from charge description
- **Missing Amount**: Use charge amount
- **Missing Date**: Use charge date
- **Statement Assignment**: Auto-assign receipt to charge's statement

## Error Handling

### Import Errors
- **Invalid Date Formats**: Skip rows with unparseable dates
- **Missing Required Fields**: Log errors and continue processing
- **Duplicate Charges**: Prevent duplicate imports within same statement
- **File Corruption**: Graceful handling of malformed CSV data

### Recovery Mechanisms
- **Partial Imports**: Complete processing of valid records
- **Error Reporting**: Detailed logs of skipped records and reasons
- **Retry Options**: Re-process failed imports
- **Manual Correction**: Edit imported charges after import

## API Endpoints

### Statement Management
- `GET /api/statements` - List all statement periods
- `POST /api/charges/import-csv` - Import AMEX CSV file
- `GET /api/statements/:id` - Get specific statement details
- `PUT /api/statements/:id` - Update statement information

### Charge Management
- `GET /api/amex-charges` - List all charges with filtering
- `PUT /api/amex-charges/:id` - Update charge details
- `POST /api/amex-charges/:id/toggle-personal` - Toggle personal expense flag

## Integration Benefits

### Automated Workflow
- **One-Click Import**: Single CSV upload creates complete statement
- **Automatic Organization**: Charges immediately available for matching
- **Smart Defaults**: Intelligent categorization and processing
- **Error Prevention**: Duplicate detection prevents data issues

### Business Intelligence
- **Spending Analysis**: Detailed charge categorization and reporting
- **Matching Rates**: Track receipt-to-charge matching efficiency
- **Period Comparison**: Compare spending across statement periods
- **Personal vs Business**: Clear separation for tax and accounting purposes

## Security Considerations

### Data Protection
- **User Isolation**: Each user's charges are completely isolated
- **Session Security**: All operations require valid authentication
- **Audit Trail**: Complete logging of import and modification activities
- **Secure Storage**: Encrypted database storage for sensitive financial data

### Compliance
- **Data Retention**: Configurable retention policies for financial records
- **Access Logging**: Complete audit trail of data access
- **Export Controls**: Secure export mechanisms for compliance reporting

## Future Enhancements

See [Pending Features](./pending-features.md) for planned AMEX integration improvements.