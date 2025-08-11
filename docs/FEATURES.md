# Features Documentation

This document provides detailed information about all features available in the Receipt Manager application.

## 📋 Table of Contents

1. [Receipt Management](#receipt-management)
2. [Web Link Processing](#web-link-processing)
3. [OCR Processing](#ocr-processing)
4. [AMEX Integration](#amex-integration)
5. [Smart Matching](#smart-matching)
6. [File Organization](#file-organization)
7. [Email Integration](#email-integration)
8. [Dashboard & Analytics](#dashboard--analytics)
9. [Export & Templates](#export--templates)
10. [Bulk Receipt Downloads](#bulk-receipt-downloads)

## 📄 Receipt Management

### Multi-File Upload
**Purpose**: Upload multiple receipts simultaneously for efficient batch processing with intelligent device-specific optimization.

**Smart Upload Architecture**:
- **Desktop Devices**: Advanced Uppy-based interface with direct-to-storage uploads using presigned URLs
- **Mobile Devices**: Streamlined server-upload interface optimized for touch interactions
- **Automatic Detection**: System automatically detects device capabilities and chooses optimal upload method
- **Authentication Integration**: All uploads require authentication with pre-upload verification

**Features**:
- Support for up to 10 files per upload session
- Drag-and-drop interface with progress tracking (desktop)
- File validation and size limits (10MB per file)
- Real-time upload status indicators
- Background processing with immediate feedback
- Comprehensive error handling and recovery

**Supported Formats**:
- **Images**: JPEG, PNG, GIF, BMP, TIFF
- **Documents**: PDF files (with automatic OCR processing)
- **Maximum Size**: 10MB per file
- **Processing**: Automatic OCR extraction for all supported formats

**Upload Workflow**:
1. **File Selection**: Drag-and-drop (desktop) or file picker (mobile)
2. **Authentication Check**: System verifies user session before upload
3. **Immediate Upload**: Files uploaded with real-time progress tracking
4. **Background Processing**: OCR and data extraction runs asynchronously
5. **Auto-Organization**: Receipts automatically assigned to statements when possible
6. **Smart Matching**: System attempts automatic matching to AMEX charges

**Device-Specific Features**:
- **Desktop**: Modal upload interface with file management dashboard
- **Mobile**: Inline progress tracking with optimized touch interface
- **Cross-Platform**: Consistent experience across all devices

## 🔗 Web Link Processing

### URL Import Support
**Purpose**: Process receipts directly from web links including Gmail attachments and Google Drive files without manual download steps.

**Supported URL Types**:
- **Gmail Attachments**: `https://mail.google.com/mail/...` and `https://mail-attachment.googleusercontent.com/...`
- **Google Drive Files**: `https://drive.google.com/...` (publicly accessible)
- **Generic Web URLs**: Any HTTP/HTTPS URL containing image or PDF content
- **Authentication**: Uses browser session cookies for private content access

**Processing Features**:
- **Automatic Download**: Fetches file content from accessible URLs
- **Smart Detection**: Identifies file types and content from response headers
- **Secure Storage**: Downloads stored with proper access controls and encryption
- **OCR Integration**: Full text extraction using Tesseract.js for downloaded content
- **Error Handling**: Graceful fallback to manual entry when URL access fails

**User Interface**:
- **Dedicated Input**: Separate URL input field with validation
- **Real-time Status**: Processing indicators and progress updates
- **Error Feedback**: Clear messages for different failure types
- **Mobile Optimized**: Responsive design for all device types

**Processing Workflow**:
1. **URL Validation**: Checks format and basic accessibility
2. **Content Download**: Fetches file content using proper headers
3. **Storage Upload**: Securely stores downloaded content in object storage
4. **OCR Processing**: Extracts text and data from downloaded files
5. **Receipt Creation**: Creates receipt record with extracted information
6. **Auto-Assignment**: Attempts statement assignment and charge matching

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
**Purpose**: Comprehensive receipt viewing with advanced zoom, pan, and navigation capabilities.

**Image Display**:
- Full-size image viewer with advanced zoom capabilities (0.5x to 3x)
- Pan functionality when zoomed in for detailed inspection
- Touch gestures: pinch-to-zoom and drag-to-pan on mobile devices
- Mouse controls: click and drag to pan when zoomed, scroll wheel zoom
- Rotation controls for poorly oriented images
- Visual zoom percentage indicator
- Reset controls to return to original view
- Download original file option
- Thumbnail preview in lists

**PDF Preview**:
- Advanced inline PDF viewer powered by PDF.js
- Interactive zoom controls (0.5x to 3x) with smooth scaling
- True pan functionality - click and drag to navigate zoomed PDFs
- Full multi-page support with accurate page detection and navigation
- Touch gestures: drag to pan, pinch-to-zoom on mobile devices
- Canvas-based rendering for high-quality display
- "Open in New Tab" and download functionality
- Intelligent fallback system for compatibility

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

### Enhanced PDF Processing (August 2025)
**Purpose**: Modern PDF processing with reliable text extraction using 2024-2025 solutions.

**Technology Stack**:
- **Primary**: pdf-to-png-converter (most reliable for Node.js environments)
- **Fallback**: Enhanced pdf2pic with optimized settings
- **Validation**: Comprehensive buffer checking and error handling
- **Cleaning**: OCR artifact removal for improved text quality

**Processing Flow**:
- **Stage 1**: Direct PDF text extraction using pdf-parse
- **Stage 2**: Progressive image conversion with multiple library fallbacks
- **Stage 3**: Enhanced OCR with artifact cleaning and pattern recognition
- **Stage 4**: Intelligent error messages with clear user guidance

**Key Improvements**:
- **Reliability**: Modern libraries address "empty buffer" issues common in containerized environments
- **Error Handling**: Progressive fallback system prevents processing failures
- **Quality**: Enhanced OCR cleaning removes conversion artifacts
- **User Guidance**: Clear messaging when image uploads would provide better results

**Best Practice Recommendations**:
- **Image uploads (PNG/JPG)**: Optimal quality for OCR and Uber receipt detection
- **PDF processing**: Significantly improved but may have lower text quality due to conversion
- **Manual entry**: Enhanced form when automatic processing limitations are encountered

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

## 📦 Bulk Receipt Downloads

### ZIP Package Generation
**Purpose**: Download all business receipts for a statement period in a single organized ZIP file with standardized naming conventions.

**Key Features**:
- **Flat File Structure**: All receipts in root directory with descriptive filenames
- **Smart Filtering**: Excludes personal expenses, includes only business receipts
- **Standardized Naming**: `[YYYYMMDD]_[Merchant]_[Amount]_NON_AMEX.ext` format
- **Complete Package**: Includes receipt images, summary CSV, and Oracle export CSV

**ZIP Contents**:
- **Receipt Images**: All business receipt files with standardized names
- **Summary CSV**: Detailed receipt metadata and matching information
- **Oracle Export CSV**: Ready-to-import Oracle iExpense format
- **Organized Structure**: Consistent file organization for easy processing

### Smart Assignment Controls
**Purpose**: Ensure data quality by requiring complete receipt information before period assignment.

**Assignment Requirements**:
- **Date**: Valid expense date must be filled
- **Merchant**: Vendor/merchant name must be present
- **Amount**: Valid expense amount must be entered
- **Visual Feedback**: Clear messaging when requirements not met

**Quality Assurance**:
- **Filename Generation**: Ensures proper filename creation upon assignment
- **Data Validation**: Prevents incomplete receipts from being processed
- **User Guidance**: Helpful prompts to complete required fields
- **Workflow Control**: Assignment only available when data is complete

### File Naming Convention
**Purpose**: Standardized, descriptive filenames for easy identification and Oracle compatibility.

**Naming Format**:
- **Standard Format**: `[Date]_[Merchant]_[Amount].ext`
- **Non-AMEX Suffix**: `[Date]_[Merchant]_[Amount]_NON_AMEX.ext`
- **Date Format**: YYYYMMDD (20241231 for December 31, 2024)
- **Merchant Sanitization**: Alphanumeric only, truncated to 20 characters
- **Amount Format**: Dollars and cents without decimal (1234 for $12.34)

**Integration Benefits**:
- **Oracle Compatibility**: Filenames work seamlessly with Oracle iExpense
- **Easy Sorting**: Chronological sorting by filename
- **Clear Identification**: Immediate recognition of expense type
- **Batch Processing**: Consistent naming for automated processing

---

This comprehensive feature documentation provides detailed information about all capabilities available in the Receipt Manager application. Each feature is designed to work together seamlessly to provide a complete expense management workflow from receipt capture to enterprise system integration.