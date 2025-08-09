# Receipt Manager Documentation

A comprehensive expense management web application that integrates with AMEX statements and Oracle iExpense to automate expense management workflows.

## Documentation Structure

### Core Features
- [Receipt Processing](./receipt-processing.md) - Upload, OCR, and manual entry system
- [AMEX Integration](./amex-integration.md) - Statement import and charge processing
- [Smart Matching](./smart-matching.md) - Intelligent receipt-to-charge matching
- [Oracle iExpense](./oracle-iexpense.md) - Export templates and naming conventions
- [File Organization](./file-organization.md) - Automatic folder structure and naming
- [Object Storage](./object-storage.md) - Cloud storage integration with ACL

### System Features
- [Authentication](./authentication.md) - User management and sessions
- [Database Schema](./database-schema.md) - Data models and relationships
- [API Documentation](./api-documentation.md) - Complete endpoint reference
- [UI Components](./ui-components.md) - Frontend component library

### Development
- [Architecture](./architecture.md) - System design and technology stack
- [Setup Guide](./setup-guide.md) - Development environment setup
- [Deployment](./deployment.md) - Production deployment guide

### Project Management
- [Changelog](./CHANGELOG.md) - Version history and feature updates
- [Product Requirements](./PRD.md) - Original requirements and future roadmap
- [Pending Features](./pending-features.md) - Planned enhancements

## Quick Start

1. **Upload Receipts**: Use multi-file upload for up to 10 receipts simultaneously
2. **Import AMEX Statement**: Upload CSV files to create statement periods
3. **Match Receipts**: Use intelligent matching interface to link receipts to charges
4. **Generate Oracle Export**: Download properly formatted templates for expense reporting

## Key Benefits

- **Automated Organization**: Intelligent file naming with Oracle iExpense compatibility
- **Smart Data Completion**: Automatic population of missing receipt data from AMEX charges
- **Duplicate Prevention**: System checks prevent duplicate statement imports
- **Cross-Statement Matching**: Match receipts to charges across any statement period
- **Instant Processing**: Manual entry replaces slow OCR for immediate productivity

## Support

For technical issues or feature requests, refer to the specific feature documentation or check the pending features list for planned enhancements.