# Features Documentation

This document provides detailed information about all features available in the Receipt Manager application.

## 📋 Table of Contents

1. [Receipt Management](#receipt-management)
2. [OCR Processing](#ocr-processing)
3. [AMEX Integration](#amex-integration)
4. [Smart Matching](#smart-matching)
5. [File Organization](#file-organization)
6. [Email Integration](#email-integration)
7. [Dashboard & Analytics](#dashboard--analytics)
8. [Export & Templates](#export--templates)

## 📄 Receipt Management

### Multi-File Upload
**Purpose**: Upload multiple receipts simultaneously for efficient batch processing.

**Features**:
- Support for up to 10 files per upload session
- Drag-and-drop interface with progress tracking
- File validation and size limits
- Real-time upload status indicators

**Supported Formats**:
- **Images**: JPEG, PNG, GIF, BMP, TIFF
- **Documents**: PDF files
- **Maximum Size**: 10MB per file

**How to Use**:
1. Navigate to the Upload page
2. Drag files into the upload area or click to select
3. Monitor upload progress in real-time
4. Review uploaded receipts in the confirmation dialog

### Manual Data Entry
**Purpose**: Quick receipt data entry when automatic processing isn't needed.

**Fields**:
- **Merchant**: Store or vendor name
- **Amount**: Transaction total (automatically formatted)
- **Date**: Transaction date (date picker included)
- **Category**: Expense category (dropdown with common options)
- **Notes**: Additional information or comments

**Smart Features**:
- Auto-formatting for currency amounts
- Date validation and calendar picker
- Category suggestions based on merchant
- Real-time form validation

### Receipt Viewer
**Purpose**: Comprehensive receipt viewing with multiple display options.

**Image Display**:
- Full-size image viewer with zoom capabilities
- Rotation controls for poorly oriented images
- Download original file option
- Thumbnail preview in lists

**PDF Preview**:
- Compact inline PDF viewer
- "Open in New Tab" for full document view
- Page navigation for multi-page documents
- Download functionality

**Data Summary**:
- Key information display (merchant, amount, date)
- Processing status indicators
- Matching information when linked to charges
- Edit options for manual corrections

## 🔍 OCR Processing

### Automatic Text Extraction
**Purpose**: Extract receipt information from uploaded images using advanced OCR technology.

**Technology**:
- **Engine**: Tesseract.js (WebAssembly-based)
- **Processing**: Client-side for privacy and performance
- **Languages**: English (primary), configurable for others
- **Accuracy**: Optimized for receipt formats and common layouts

**Extracted Information**:
- **Merchant Names**: Store and vendor identification
- **Transaction Amounts**: Total costs and subtotals
- **Dates**: Transaction timestamps
- **Items**: Individual line items when clearly readable
- **Tax Information**: Sales tax and fees when present

### Manual OCR Trigger
**Purpose**: On-demand text extraction for receipts that need reprocessing.

**Features**:
- "Extract Text" button on receipt details page
- Progress indicator during processing
- Results preview before saving
- Option to edit extracted data before confirmation

**Use Cases**:
- Initial OCR processing failed or was incomplete
- Receipt image quality improved after upload
- Need to reprocess after image rotation or enhancement
- Manual verification of automatic extraction results

### PDF Handling
**Purpose**: Smart handling of PDF receipts with appropriate processing guidance.

**Approach**:
- **Recognition**: Automatic PDF format detection
- **Guidance**: Clear instructions for manual data entry
- **Recommendations**: Suggestions for optimal processing methods
- **Fallback**: Manual entry form pre-populated when possible

**User Experience**:
- Informative messages about PDF processing limitations
- Clear call-to-action for manual entry
- Option to save PDF for later processing
- Integration with manual data entry workflow

## 💳 AMEX Integration

### CSV Import
**Purpose**: Direct import of AMEX statement data for comprehensive expense tracking.

**Process**:
1. **File Upload**: Standard AMEX CSV export files
2. **Data Validation**: Automatic format verification
3. **Period Detection**: Smart date range identification
4. **Charge Import**: Individual transaction processing
5. **Duplicate Check**: Prevention of overlapping statement imports

**Supported Data**:
- **Transaction Details**: Date, amount, description, card member
- **Merchant Information**: Business names and locations
- **Account Details**: Card numbers and account references
- **Extended Data**: Categories, reference numbers, addresses

### Statement Management
**Purpose**: Organize and manage AMEX statement periods for better expense tracking.

**Features**:
- **Period Creation**: Automatic statement period generation
- **Date Range Detection**: Smart start/end date calculation
- **Folder Organization**: Automatic folder creation for each period
- **Status Tracking**: Import progress and completion status

### Individual Statement Detail Pages
**Purpose**: Comprehensive view of statement data with modern financial app interface design and optimized vertical card layout.

**Vertical Card Layout** (Current):
- **Three-Row Structure**: Optimized information hierarchy for improved readability
  - Row 1: Date and description with extended details
  - Row 2: Amount, category, and card member information  
  - Row 3: Match status, personal/business toggle, and notes functionality
- **Direct Receipt Links**: "View Receipt" buttons for matched expenses
- **Expandable Notes**: Smooth transitions for charge-specific annotations
- **Mobile Optimization**: Eliminates horizontal scrolling for better mobile experience
- **Enhanced Interactivity**: Hover effects and visual feedback

**Visual Statistics Dashboard**: Color-coded metrics for total charges, matched amounts, unmatched counts, and personal expenses
- **Real-Time Search**: Filter across descriptions, amounts, and categories with instant results
- **Business/Personal Filtering**: Toggle between expense types with dedicated view modes

**Enhanced Management Features**:
- **Individual Charge Notes**: Expandable sections for detailed charge annotations
- **Personal Expense Tracking**: Quick toggle functionality with visual indicators
- **Status Indicators**: Color-coded badges for matched/unmatched charges and charges with notes
- **Mobile-Responsive Design**: Optimized table layout with horizontal scrolling support
- **Export Integration**: Direct Oracle iExpense template generation from detail view

**Statement Information**:
- Period name (e.g., "March 2025", "Q1 2025")
- Start and end dates
- Total transaction count
- Total amount for the period
- Import timestamp and status

### Duplicate Prevention
**Purpose**: Prevent duplicate statement imports and overlapping data.

**Detection Methods**:
- **Date Range Overlap**: Check for conflicting statement periods
- **Transaction Similarity**: Identify potentially duplicate charges
- **Amount Matching**: Cross-reference transaction totals
- **Merchant Patterns**: Recognize recurring charge patterns

**User Experience**:
- Clear warnings before duplicate imports
- Detailed conflict information
- Options to merge or skip duplicates
- Audit trail of import decisions

## 🔗 Smart Matching

### Receipt-to-Charge Matching
**Purpose**: Intelligent algorithm to match uploaded receipts with AMEX charge records.

**Matching Criteria**:
- **Amount Similarity**: Exact or near-exact amount matches (within $0.01)
- **Date Proximity**: Transactions within 7-day window
- **Merchant Recognition**: Name similarity using fuzzy matching
- **Confidence Scoring**: Combined score for match quality

**Algorithm Features**:
- **Cross-Statement Matching**: Receipts can match charges across all periods
- **Fuzzy Logic**: Handles variations in merchant names
- **Learning System**: Improves matching based on user confirmations
- **Fallback Methods**: Multiple matching strategies for edge cases

### Manual Matching Interface
**Purpose**: User-controlled matching for cases requiring human judgment.

**Interface Elements**:
- **Side-by-Side Comparison**: Receipt and charge information displayed together
- **Confidence Indicators**: Visual confidence levels for suggested matches
- **Quick Actions**: One-click confirm/reject buttons
- **Bulk Operations**: Select and process multiple matches at once

**Data Completion**:
- **Auto-Population**: Missing receipt data filled from matched charges
- **Smart Suggestions**: Recommended data based on charge information
- **Validation**: Consistency checks between receipt and charge data
- **Audit Trail**: Track all matching decisions and changes

### Cross-Statement Capability
**Purpose**: Match receipts to charges regardless of statement period assignment.

**Benefits**:
- **Flexibility**: Handle receipts that span multiple statement periods
- **Accuracy**: Ensure all receipts find appropriate matches
- **Completeness**: Maximize matching rate across the entire dataset
- **Efficiency**: Reduce manual review time for edge cases

## 📁 File Organization

### Oracle iExpense Naming
**Purpose**: Automatic file renaming using Oracle-compatible naming conventions.

**Naming Pattern**: `DATE_MERCHANT_$AMOUNT_RECEIPT.ext`

**Examples**:
- `2025-03-15_STARBUCKS_$4.75_RECEIPT.pdf`
- `2025-03-20_UBER_$23.45_RECEIPT.jpg`
- `2025-03-22_HOTEL_$150.00_RECEIPT.png`

**Smart Features**:
- **Data Sanitization**: Remove special characters and spaces
- **Fallback Logic**: Use "UNKNOWN_*" for missing information
- **Extension Preservation**: Maintain original file extensions
- **Uniqueness**: Ensure no naming conflicts with timestamps

### Intelligent Fallbacks
**Purpose**: Handle missing receipt data gracefully during organization.

**Fallback Patterns**:
- **Missing Date**: `UNKNOWN_DATE_MERCHANT_$AMOUNT_RECEIPT.ext`
- **Missing Merchant**: `DATE_UNKNOWN_MERCHANT_$AMOUNT_RECEIPT.ext`
- **Missing Amount**: `DATE_MERCHANT_$UNKNOWN_AMOUNT_RECEIPT.ext`
- **Multiple Missing**: `UNKNOWN_DATA_RECEIPT_TIMESTAMP.ext`

**Auto-Completion**:
- **From Charges**: Use matched AMEX charge data to fill gaps
- **From OCR**: Leverage extracted text for missing fields
- **From Context**: Infer information from similar receipts
- **User History**: Apply patterns from previous user entries

### Folder Structure
**Purpose**: Organize receipts into logical folder hierarchies for easy navigation.

**Organization Levels**:
1. **Statement Periods**: Top-level folders by AMEX statement
2. **Categories**: Subfolders by expense type (Meals, Travel, etc.)
3. **Monthly**: Further subdivision by month when needed
4. **Status**: Separate folders for matched/unmatched receipts

**Path Examples**:
- `/March_2025_Statement/Meals/2025-03-15_STARBUCKS_$4.75_RECEIPT.pdf`
- `/Q1_2025_Statement/Travel/2025-01-20_UBER_$23.45_RECEIPT.jpg`
- `/Unmatched_Receipts/UNKNOWN_DATE_RESTAURANT_$45.00_RECEIPT.png`

## 📧 Email Integration

### Copy-Paste Method
**Purpose**: Manual email content processing for secure corporate environments.

**Process**:
1. **Email Content**: Copy complete email text from secure email client
2. **Form Entry**: Paste into structured form with metadata fields
3. **Extraction**: Automatic parsing of receipt information from content
4. **Validation**: Review and confirm extracted data
5. **Storage**: Save as receipt record with email context

**Supported Email Types**:
- **Receipt Confirmations**: E-commerce and retail receipts
- **Service Invoices**: Digital service confirmations
- **Booking Confirmations**: Travel and accommodation receipts
- **Subscription Notifications**: Recurring service charges

### Email Forwarding Setup
**Purpose**: Automatic processing of forwarded receipt emails.

**Configuration**:
- **Forward Address**: `receipts+import@[your-domain]`
- **Processing Rules**: Automatic detection and extraction
- **Security**: Server-side email parsing with validation
- **Integration**: Direct creation of receipt records

**Alternative Methods**:
- **EML File Upload**: Save emails as .eml files and upload
- **Screenshot Processing**: Take screenshots and upload as images
- **Manual Transcription**: Type email content into manual entry form

### Content Extraction
**Purpose**: Intelligent parsing of email content to extract receipt information.

**Extraction Patterns**:
- **Amount Recognition**: Multiple currency and decimal formats
- **Merchant Identification**: From/At/@ patterns and sender analysis
- **Date Detection**: Various date formats and relative timestamps
- **Item Lists**: Line item extraction from structured email content

**Accuracy Features**:
- **Context Analysis**: Use subject line and sender for validation
- **Pattern Learning**: Improve extraction based on successful matches
- **Fallback Options**: Manual review when automatic extraction is uncertain
- **Validation Rules**: Cross-check extracted data for consistency

## 📊 Dashboard & Analytics

### Processing Statistics
**Purpose**: Real-time overview of receipt processing status and system performance.

**Key Metrics**:
- **Total Receipts**: Complete count of all uploaded receipts
- **Processing Status**: Breakdown by completed/pending/failed
- **Matching Rate**: Percentage of receipts matched to charges
- **Organization Status**: Number of organized vs. unorganized receipts

**Visual Elements**:
- **Progress Bars**: Visual representation of completion rates
- **Status Icons**: Clear indicators for different processing states
- **Trend Charts**: Historical processing performance
- **Quick Actions**: Direct links to address pending items

### Financial Overview
**Purpose**: Comprehensive financial summary of expense data.

**Financial Metrics**:
- **Total Statement Amount**: Sum of all AMEX charges
- **Matched Expenses**: Total value of matched receipts
- **Unmatched Amounts**: Value of unprocessed transactions
- **Category Breakdown**: Spending by expense category

**Insights**:
- **Matching Efficiency**: Percentage of expenses with receipt backup
- **Category Trends**: Spending patterns by type
- **Period Comparisons**: Month-over-month or quarter-over-quarter analysis
- **Outstanding Items**: Transactions requiring attention

### Activity Monitoring
**Purpose**: Track system activity and user interactions for audit and optimization.

**Activity Types**:
- **Upload Events**: File uploads with timestamps and status
- **Processing Completion**: OCR and extraction results
- **Matching Decisions**: User confirmations and rejections
- **Organization Actions**: File moves and renaming operations

**Audit Trail**:
- **User Actions**: Complete log of user interactions
- **System Events**: Automated processing and background tasks
- **Error Tracking**: Failed operations with detailed error information
- **Performance Metrics**: Processing times and system performance data

## 📤 Export & Templates

### Oracle iExpense Integration
**Purpose**: Generate templates compatible with Oracle iExpense for seamless enterprise integration.

**Export Formats**:
- **CSV Templates**: Structured data for bulk import
- **XML Files**: Full Oracle iExpense format compatibility
- **Excel Spreadsheets**: Human-readable format with formulas
- **PDF Reports**: Formatted summaries for reporting

**Template Fields**:
- **Employee Information**: User details and cost center assignments
- **Expense Details**: Date, amount, category, and description
- **Receipt References**: Links to organized receipt files
- **Approval Workflow**: Manager and department information

### Batch Processing
**Purpose**: Efficient processing of multiple receipts and exports for large-scale operations.

**Batch Operations**:
- **Bulk Upload**: Process multiple files simultaneously
- **Mass Organization**: Apply naming conventions to entire folders
- **Batch Matching**: Run matching algorithms across all receipts
- **Group Export**: Generate templates for multiple statement periods

**Performance Optimization**:
- **Parallel Processing**: Concurrent operations for faster completion
- **Progress Tracking**: Real-time status for long-running operations
- **Error Handling**: Graceful handling of failed items in batches
- **Resume Capability**: Continue interrupted batch operations

### Custom Templates
**Purpose**: Flexible template generation for different enterprise requirements.

**Customization Options**:
- **Field Mapping**: Configure which data fields to include
- **Format Selection**: Choose output format and structure
- **Category Mapping**: Map receipt categories to expense codes
- **Approval Routing**: Set up workflow and approval paths

**Template Management**:
- **Save Templates**: Store custom configurations for reuse
- **Template Sharing**: Export/import template configurations
- **Version Control**: Track template changes and updates
- **Default Settings**: Set organization-wide template defaults

---

This comprehensive feature documentation provides detailed information about all capabilities available in the Receipt Manager application. Each feature is designed to work together seamlessly to provide a complete expense management workflow from receipt capture to enterprise system integration.