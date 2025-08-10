# Overview

This is a Receipt Manager application that integrates with AMEX statements and Oracle iExpense to automate expense management workflows. The system allows instant receipt uploads with manual data entry, matches them to AMEX charges, and generates Oracle iExpense templates for seamless expense reporting.

The application features a modern web interface built with React and TypeScript, backed by a Node.js/Express API server with PostgreSQL database storage. It includes multi-file upload capabilities with object storage integration and a streamlined manual receipt processing workflow.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Library**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS for utility-first styling with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **File Upload**: Uppy with AWS S3 integration for direct-to-cloud uploads

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **File Storage**: Google Cloud Storage with custom ACL policies
- **Development**: Hot reload with Vite integration for full-stack development

## Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon Database serverless
- **Schema Management**: Drizzle migrations with shared schema definitions
- **File Storage**: Google Cloud Storage buckets for receipt images and documents
- **Object Access Control**: Custom ACL system with granular permissions

## Core Data Models
- **Users**: Authentication and user management
- **Receipts**: OCR-processed receipt data with categorization
- **AMEX Statements**: Statement periods and charge data
- **AMEX Charges**: Individual charge records for matching
- **Expense Templates**: Oracle iExpense-compatible export data

## Processing Pipeline
- **Manual Entry System**: Instant receipt upload with manual data entry (OCR disabled due to 30+ minute processing times)
- **Multi-File Upload**: Support for uploading up to 10 receipts simultaneously with progress tracking
- **Direct Upload to Charges**: One-click receipt upload from statement line items with automatic charge linking
- **Smart Organization**: Automatic folder creation and receipt organization by AMEX statement periods
- **Automated Matching**: Algorithm to match receipts to AMEX charges based on amount, date, and merchant similarity
- **Template Generation**: Oracle iExpense CSV/XML template creation for seamless integration

## Authentication & Authorization
- **Google OAuth 2.0**: Single-user authentication system with Google account integration
- **Authorized Access**: Only specified email address (AUTHORIZED_EMAIL environment variable) can access the system
- **Session Management**: Production-ready session configuration with secure cookies and proper expiration
- **Protected Routes**: All API endpoints require authentication with automatic redirection for unauthorized access
- **User Profile**: Displays user information including name, email, and profile picture from Google account
- **Object-Level Security**: Custom ACL policies for file access control

# External Dependencies

## Cloud Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Google Cloud Storage**: Object storage for receipt images and documents with IAM integration
- **Replit Infrastructure**: Development environment with sidecar authentication for GCS

## Third-Party Libraries
- **Uppy**: File upload handling with progress tracking and AWS S3 direct upload
- **Tesseract.js**: Client-side OCR processing for receipt text extraction
- **Radix UI**: Accessible component primitives for the user interface
- **TanStack Query**: Server state synchronization and caching
- **Drizzle ORM**: Type-safe database queries and migrations

## Development Tools
- **Vite**: Fast build tool with TypeScript and React support
- **TypeScript**: Static type checking across frontend, backend, and shared code
- **Tailwind CSS**: Utility-first CSS framework with design system integration
- **ESBuild**: Fast JavaScript bundler for production builds

## Payment Integration
- **AMEX Integration**: Processes AMEX statement CSV files with automatic date range detection and folder organization
- **Oracle iExpense**: Generates compatible templates for enterprise expense reporting

## Recent Changes (August 9, 2025)
- **Individual Statement Pages**: Replaced popup dialogs with dedicated statement detail pages (/statements/:id) for comprehensive data viewing
- **Financial Dashboard Design**: Implemented modern financial app-inspired UI with color-coded metrics and visual statistics
- **Advanced Data Tables**: Interactive sortable tables displaying complete CSV data including merchant details, amounts, categories, card members, and locations
- **Smart Search & Filtering**: Real-time search functionality across descriptions, amounts, and categories with business/personal expense filtering
- **Enhanced Charge Management**: Individual charge notes functionality with expandable sections and edit-in-place capabilities
- **Personal Expense Toggling**: Quick toggle between business and personal expenses with dedicated filtering options
- **Visual Status Indicators**: Color-coded badges for matched/unmatched charges, personal expenses, and charges with notes
- **Comprehensive Statistics**: Statement overview with total charges, matched amounts, unmatched counts, and personal expense tracking
- **Mobile-Responsive Design**: Optimized table layout for various screen sizes with horizontal scrolling support
- **Vertical Card Layout**: Replaced horizontal scrolling table with vertical expense cards for better readability and user experience
- **Three-Row Information Display**: Structured expense cards with date/description, amount/category/card member, and notes/personal/match status
- **Direct Receipt Links**: Added "View Receipt" buttons for matched expenses with improved visual hierarchy
- **React Performance Optimization**: Fixed infinite update loops through proper React hooks dependency management
- **Enhanced Notes System**: Improved expandable notes sections with better UX and error handling
- **Fixed CSV Import**: Resolved date parsing errors for AMEX statement imports (MM/DD/YYYY format now working)
- **Enhanced OCR Processing**: Implemented comprehensive OCR system using Tesseract.js for image processing
- **Manual OCR Trigger**: Added "Extract Text" button for manual OCR processing of existing receipts
- **PDF Handling**: PDF files provide helpful guidance for manual entry instead of attempting complex OCR conversion
- **Image OCR Support**: JPEG, PNG, and other image formats processed automatically with Tesseract.js
- **OCR Status Indicators**: Clear visual feedback showing processing status, completion, and manual entry options
- **Multi-File Upload**: Added support for uploading multiple receipts simultaneously with progress tracking
- **Enhanced UI Feedback**: Clear status indicators for receipts requiring manual data entry
- **Automatic Organization**: Statement folders created automatically when CSV files are imported
- **Cross-Statement Matching**: Receipts can now be matched to AMEX charges across all statement periods, not restricted by date ranges
- **Improved PDF Viewing**: Compact PDF preview interface with clear "Open in New Tab" functionality
- **Fixed Matching Logic**: Receipts with amount data now properly appear in matching interface regardless of statement assignment
- **Oracle iExpense Naming**: Implemented Oracle-friendly naming convention (DATE_MERCHANT_$AMOUNT_RECEIPT.ext)
- **Intelligent Auto-Organization**: System automatically fills missing receipt data from matched AMEX charges during organization
- **Smart Fallback Logic**: Receipts are renamed with available data using "UNKNOWN_*" fallbacks for missing fields
- **Automatic Data Completion**: Matching interface now auto-populates missing merchant, amount, and date from charge data
- **Fixed Receipt-Charge Linking**: Uses correct AMEX 'description' field instead of non-existent 'merchant' field
- **Receipt Deletion**: Added delete functionality to remove unwanted receipts with automatic charge unlinking
- **Duplicate Statement Detection**: CSV upload now checks for overlapping statement periods to prevent duplicate imports
- **Email Integration**: Implemented secure email receipt import system adapted for corporate security constraints
- **Copy-Paste Email Processing**: Manual email content processing that extracts receipt information from pasted text
- **Email Navigation**: Added email import page to main navigation with user-friendly interface
- **Corporate Email Support**: Alternative methods for secure email environments including forwarding and EML file options
- **Comprehensive Documentation**: Created complete documentation system with changelog, features guide, API reference, and user manual
- **Inline PDF Viewer**: Implemented inline PDF viewing with responsive layout - mobile shows PDF above form, desktop shows side-by-side panels
- **PDF Controls**: Added zoom, page navigation, and external link buttons for enhanced PDF interaction
- **Progressive Enhancement**: Feature flag system allows fallback to "Open in New Tab" if inline rendering fails
- **Responsive Receipt Viewer**: Enhanced ReceiptViewer with proper desktop/mobile layouts for simultaneous PDF viewing and form editing
- **Advanced PDF Text Extraction**: Implemented PDF-to-image conversion with OCR for comprehensive text extraction from PDF receipts
- **Enhanced User Experience**: Improved progress indicators, processing time feedback, and real-time status updates for text extraction
- **Smart Receipt Processing**: PDF receipts now automatically extract merchant, amount, date, and category information for seamless AMEX matching
- **Direct Receipt Upload to Charges**: Implemented one-click receipt upload functionality directly from statement line items with automatic charge matching
- **Mobile-Optimized Interface**: Compact responsive button layout with icon-only display on mobile devices and full text labels on desktop
- **Streamlined Upload Workflow**: Upload button integration in statement detail view enables instant receipt-to-charge linking with pre-filled data
- **Google OAuth Authentication**: Implemented secure single-user authentication system with Google OAuth 2.0 integration restricting access to authorized email only
- **Protected API Routes**: All sensitive endpoints now require authentication with proper session management and production-ready security settings
- **User Profile Management**: Added user profile dropdown in mobile navigation with logout functionality and profile picture display