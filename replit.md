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
- **Smart Organization**: Automatic folder creation and receipt organization by AMEX statement periods
- **Automated Matching**: Algorithm to match receipts to AMEX charges based on amount, date, and merchant similarity
- **Template Generation**: Oracle iExpense CSV/XML template creation for seamless integration

## Authentication & Authorization
- **User System**: Simple username/password authentication
- **Session Management**: Cookie-based sessions with secure defaults
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
- **Fixed CSV Import**: Resolved date parsing errors for AMEX statement imports (MM/DD/YYYY format now working)
- **Disabled OCR Processing**: Removed slow OCR (30+ minutes per receipt) in favor of instant manual entry
- **Multi-File Upload**: Added support for uploading multiple receipts simultaneously with progress tracking
- **Enhanced UI Feedback**: Clear status indicators for receipts requiring manual data entry
- **Automatic Organization**: Statement folders created automatically when CSV files are imported