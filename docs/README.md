# Receipt Manager - Comprehensive Expense Management System

A modern web application that automates receipt processing, AMEX statement integration, and Oracle iExpense template generation for streamlined expense management workflows.

## 🌟 Key Features

### Receipt Processing
- **Smart Multi-Device Upload**: Intelligent upload system with device-specific optimization (Uppy for desktop, server upload for mobile)
- **Authentication-Protected**: All uploads require secure user authentication with pre-upload verification
- **Multi-File Support**: Upload up to 10 receipts simultaneously with real-time progress tracking
- **Background OCR Processing**: Automatic text extraction using Tesseract.js with immediate response and async processing
- **Manual Entry Support**: Quick manual data entry when OCR processing isn't needed
- **PDF Text Extraction**: Advanced PDF-to-image conversion with OCR for comprehensive text extraction
- **Email Integration**: Import receipts from email content with copy-paste functionality

### AMEX Integration
- **CSV Import**: Direct AMEX statement upload with automatic parsing
- **Date Range Detection**: Automatic statement period identification
- **Duplicate Prevention**: Smart detection of overlapping statement imports
- **Charge Matching**: Intelligent algorithm matches receipts to AMEX charges

### Smart Organization
- **Oracle Naming**: Automatic renaming using DATE_MERCHANT_$AMOUNT_RECEIPT.ext format
- **Cross-Statement Matching**: Receipts can match charges across all statement periods
- **Intelligent Fallbacks**: System fills missing data using "UNKNOWN_*" conventions
- **Automatic Completion**: Missing receipt data populated from matched charge information

### Enterprise Features
- **Oracle iExpense Templates**: Generate compatible CSV/XML exports
- **Corporate Email Support**: Secure email integration adapted for corporate constraints
- **Deletion Management**: Remove receipts with automatic charge unlinking
- **Comprehensive Audit Trail**: Track all changes and processing activities

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript for modern UI development
- **Vite** for fast build tools and hot module replacement
- **Radix UI + shadcn/ui** for accessible, consistent components
- **Tailwind CSS** for utility-first styling
- **TanStack Query** for efficient server state management
- **Wouter** for lightweight client-side routing

### Backend
- **Node.js + Express** for robust API server
- **TypeScript** for type safety across the stack
- **Drizzle ORM** with PostgreSQL for database operations
- **Google Cloud Storage** for secure file management
- **Custom ACL System** for granular file permissions

### Database
- **PostgreSQL** via Neon Database (serverless)
- **Drizzle Migrations** for schema management
- **Optimized Queries** with proper indexing for performance

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database (or Neon account)
- Google Cloud Storage bucket (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd receipt-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Configure required variables:
   DATABASE_URL=your_postgresql_connection_string
   ```

4. **Initialize database**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

## 📁 Project Structure

```
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utility functions
│   │   └── hooks/         # Custom React hooks
├── server/                # Node.js backend
│   ├── routes.ts          # API route definitions
│   ├── storage.ts         # Database operations
│   ├── emailService.ts    # Email processing logic
│   ├── ocrService.ts      # OCR processing
│   └── fileOrganizer.ts   # File organization logic
├── shared/                # Shared types and schemas
│   └── schema.ts          # Database schema definitions
├── docs/                  # Documentation
└── attached_assets/       # User-uploaded files
```

## 💡 Usage Guide

### 1. Upload Receipts
- Navigate to the upload page
- Drag and drop or select up to 10 files
- Supported formats: PDF, JPEG, PNG, GIF
- System automatically processes images with OCR

### 2. Import AMEX Statements
- Go to Statements page
- Upload CSV file from AMEX
- Enter period name (e.g., "March 2025")
- System automatically creates date ranges and imports charges

### 3. Match Receipts to Charges
- Visit the Matching page
- Review suggested receipt-charge pairs
- Confirm matches or manually adjust
- System uses amount, date, and merchant similarity

### 4. Email Receipt Import
- Use Email Import page for corporate environments
- Copy email content and paste into the form
- System extracts receipt information automatically
- Alternative: Set up email forwarding rules

### 5. Organize and Export
- Use Organize feature to apply Oracle naming conventions
- System automatically fills missing data from matched charges
- Export templates for Oracle iExpense integration

## 🔧 Configuration

### Email Integration
For secure corporate environments, the system supports:
- **Copy-Paste Method**: Manual email content processing
- **Email Forwarding**: Automatic processing of forwarded emails
- **EML File Upload**: Save emails as files and upload

### File Organization
Customize organization patterns in `server/fileOrganizer.ts`:
- Oracle naming: `DATE_MERCHANT_$AMOUNT_RECEIPT.ext`
- Folder structure by statement periods
- Intelligent fallbacks for missing data

### OCR Settings
Adjust OCR processing in `server/ocrService.ts`:
- Language settings (default: English)
- Confidence thresholds
- Text extraction patterns

## 🔒 Security Features

- **Secure File Upload**: Validation and sanitization
- **Database Security**: Parameterized queries and prepared statements
- **Access Control**: Custom ACL system for file permissions
- **Corporate Compliance**: Email integration adapted for security constraints
- **Audit Logging**: Comprehensive activity tracking

## 🐛 Troubleshooting

### Common Issues

**OCR Processing Slow/Failing**
- Use manual entry for faster processing
- Ensure images are clear and well-lit
- Try PDF conversion if issues persist

**AMEX CSV Import Errors**
- Verify CSV format matches AMEX export
- Check date format (MM/DD/YYYY expected)
- Ensure no duplicate statement periods

**Matching Not Working**
- Check receipt data completeness
- Verify charge amounts match exactly
- Ensure dates are within 7-day window

**Email Import Issues**
- Verify all required fields are filled
- Check email content contains receipt information
- Try alternative import methods

### Getting Help

1. Check the [documentation](docs/)
2. Review error logs in the console
3. Verify environment variables are set correctly
4. Ensure database connectivity

## 🔄 API Reference

### Receipts
- `GET /api/receipts` - List all receipts
- `POST /api/receipts` - Create new receipt
- `PUT /api/receipts/:id` - Update receipt
- `DELETE /api/receipts/:id` - Delete receipt

### Statements
- `GET /api/statements` - List AMEX statements
- `POST /api/charges/import-csv` - Import AMEX CSV
- `GET /api/statements/:id/charges` - Get statement charges

### Matching
- `GET /api/matching/candidates/:statementId` - Get matching candidates
- `POST /api/matching/confirm` - Confirm receipt-charge match

### Email Processing
- `POST /api/email/process-content` - Process email content
- `POST /api/email/search` - Search email receipts

## 📊 Performance

### Optimizations
- **Client-side OCR**: Reduces server load
- **Efficient Queries**: Optimized database operations
- **Smart Caching**: Reduced API calls with TanStack Query
- **Parallel Processing**: Multi-file upload with progress tracking

### Monitoring
- Real-time processing status indicators
- Dashboard statistics and analytics
- Error tracking and logging
- Performance metrics collection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Maintain consistent code formatting
- Add tests for new features
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Tesseract.js** for OCR processing capabilities
- **Radix UI** for accessible component primitives
- **Drizzle ORM** for type-safe database operations
- **TanStack Query** for excellent server state management
- **Neon Database** for serverless PostgreSQL hosting

---

Built with ❤️ for efficient expense management workflows.