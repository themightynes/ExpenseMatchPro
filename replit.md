# Overview

This Receipt Manager application automates expense management by integrating with AMEX statements and Oracle iExpense. It enables instant receipt uploads, matches them to AMEX charges, and generates Oracle iExpense templates. The system provides a modern web interface built with React and TypeScript, backed by a Node.js/Express API and PostgreSQL. Key capabilities include multi-file uploads with object storage integration and a streamlined manual receipt processing workflow. The business vision is to simplify expense reporting for individuals and corporations, improving efficiency and reducing manual data entry.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript (Vite)
- **UI Library**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Routing**: Wouter
- **File Upload**: Uppy with AWS S3 integration

## Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM (PostgreSQL dialect)
- **File Storage**: Google Cloud Storage

## Data Storage Solutions
- **Primary Database**: PostgreSQL (Neon Database serverless)
- **Schema Management**: Drizzle migrations
- **File Storage**: Google Cloud Storage buckets

## Core Data Models
- Users, Receipts, AMEX Statements, AMEX Charges, Expense Templates, Transportation Data.

## Processing Pipeline
- **Manual Entry System**: Instant receipt upload with manual data entry.
- **Multi-File Upload**: Up to 10 receipts simultaneously.
- **Direct Upload to Charges**: One-click receipt upload from statement line items.
- **Smart Organization**: Automatic folder creation and receipt organization by AMEX statement periods.
- **Automated Matching**: Algorithm to match receipts to AMEX charges (amount, date, merchant).
- **Template Generation**: Oracle iExpense CSV/XML template creation.
- **Intelligent Transportation Processing**: Automatic Uber receipt detection with specialized field extraction (locations, trip details, driver info).
- **Web Link Processing**: Import receipt data from web URLs (Gmail, Google Drive).
- **Enhanced PDF Processing (August 2025)**: Modern PDF processing using pdf-to-png-converter and enhanced pdf2pic with progressive fallback system. Includes OCR artifact cleaning and comprehensive error handling for reliable text extraction.

## Authentication & Authorization
- **Google OAuth 2.0**: Single-user authentication.
- **Authorized Access**: Restricted to specified email addresses.
- **Session Management**: Secure cookies with proper expiration.
- **Protected Routes**: All API endpoints require authentication.
- **Object-Level Security**: Custom ACL policies for file access.

## UI/UX Decisions
- Modern financial app-inspired design with color-coded metrics.
- Advanced, interactive, and sortable data tables.
- Smart search and filtering capabilities.
- Mobile-responsive design with optimized layouts (e.g., vertical card layout for expenses).
- Visual status indicators for charges and expenses.
- Enhanced PDF viewer using PDF.js with pan, zoom, and multi-page support.

# External Dependencies

## Cloud Services
- **Neon Database**: Serverless PostgreSQL.
- **Google Cloud Storage**: Object storage for receipts.
- **Replit Infrastructure**: Development environment.

## Third-Party Libraries
- **Uppy**: File upload handling.
- **Tesseract.js**: Client-side OCR.
- **Radix UI**: Accessible component primitives.
- **TanStack Query**: Server state synchronization.
- **Drizzle ORM**: Type-safe database queries.
- **PDF.js**: Advanced PDF viewing.
- **pdf-to-png-converter / pdf2pic**: Enhanced PDF processing with modern 2024-2025 solutions.

## Payment Integration
- **AMEX Integration**: Processes AMEX statement CSV files.
- **Oracle iExpense**: Generates compatible templates.