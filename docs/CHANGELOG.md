# Changelog

All notable changes to the Receipt Manager application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Receipt deletion functionality with automatic charge unlinking
- Duplicate statement detection for CSV uploads
- Comprehensive documentation system with feature-specific guides

### Changed
- Improved error handling and user feedback throughout application

## [2.1.0] - 2025-08-09

### Added
- Oracle iExpense-friendly naming convention (DATE_MERCHANT_$AMOUNT_RECEIPT.ext)
- Intelligent auto-organization with smart fallback logic
- Automatic data completion from matched AMEX charges
- Cross-statement matching capabilities
- Enhanced mobile UI for Oracle-organized filenames

### Changed
- Fixed receipt-to-charge linking to use AMEX 'description' field instead of 'merchant'
- Updated matching interface to auto-populate missing data from charge information
- Improved file organization system with intelligent fallbacks for missing data

### Fixed
- Receipt reorganization now works with incomplete data using fallback values
- Mobile interface displays Oracle-friendly names instead of original upload names
- Automatic organization handles missing merchant data gracefully

## [2.0.0] - 2025-08-09

### Added
- Multi-file upload support (up to 10 receipts simultaneously)
- Enhanced UI feedback with clear status indicators
- Cross-statement matching (receipts can match charges from any period)
- Improved PDF viewing with compact preview interface
- Automatic statement folder creation on CSV import

### Changed
- **BREAKING**: Disabled OCR processing in favor of instant manual entry
- Completely redesigned receipt processing workflow
- Enhanced matching logic to work across statement boundaries
- Improved user experience with better status indicators

### Fixed
- CSV import date parsing errors (MM/DD/YYYY format now working correctly)
- Receipt matching logic now properly handles amount-based filtering
- PDF viewing interface improved with "Open in New Tab" functionality

### Removed
- OCR processing (due to 30+ minute processing times per receipt)

## [1.2.0] - 2025-08-08

### Added
- AMEX CSV import functionality with automatic statement period creation
- Smart receipt-to-charge matching algorithm
- Personal expense flagging system
- Financial dashboard with comprehensive statistics
- Statement period management

### Changed
- Enhanced database schema with proper relationships
- Improved error handling for CSV processing
- Better user feedback during import operations

### Fixed
- Date parsing issues in AMEX CSV files
- Charge filtering to exclude payments and autopay transactions
- Statement period calculation accuracy

## [1.1.0] - 2025-08-07

### Added
- Receipt upload functionality with object storage integration
- Basic receipt management interface
- User authentication system
- Database integration with PostgreSQL
- Object storage with Google Cloud Storage

### Changed
- Migrated from memory storage to database persistence
- Enhanced security with proper authentication
- Improved file handling and storage

### Fixed
- File upload reliability issues
- User session management
- Database connection stability

## [1.0.0] - 2025-08-06

### Added
- Initial project setup with React/TypeScript frontend
- Express.js backend with basic API structure
- Basic receipt upload functionality
- Simple file management system
- Memory-based storage implementation

### Technical Foundation
- Vite build system for fast development
- Tailwind CSS for styling
- shadcn/ui component library
- TanStack Query for state management
- Wouter for routing

## [0.1.0] - 2025-08-05

### Added
- Project initialization
- Basic development environment setup
- Core technology stack selection
- Initial documentation structure

---

## Version History Summary

- **v2.1.0**: Oracle iExpense integration and intelligent organization
- **v2.0.0**: Multi-file upload and OCR replacement with manual entry
- **v1.2.0**: AMEX integration and smart matching
- **v1.1.0**: Database integration and authentication
- **v1.0.0**: Initial MVP with basic receipt management
- **v0.1.0**: Project foundation and setup

## Breaking Changes

### v2.0.0
- OCR processing completely removed - all receipts now require manual data entry
- Receipt processing workflow changed from automatic to manual
- API endpoints for OCR-related functionality removed

### v1.1.0
- Storage interface changed from memory to database
- Authentication required for all operations
- File storage moved to cloud-based solution

## Migration Notes

### Upgrading to v2.1.0
- Existing receipts will be automatically reorganized with Oracle naming
- No user action required for data migration
- New matching features work with existing receipt and charge data

### Upgrading to v2.0.0
- Existing receipts in OCR processing state will need manual data entry
- No data loss, but user intervention required to complete processing
- Multi-file upload replaces single-file upload interface

### Upgrading to v1.1.0
- Data migration from memory storage to database required
- User accounts must be created for existing data access
- File re-upload may be necessary for proper object storage integration

## Performance Improvements

### v2.1.0
- Intelligent fallback logic reduces processing time
- Automatic data completion eliminates manual entry for matched receipts
- Cross-statement matching improves match rates

### v2.0.0
- Manual entry provides instant completion (vs 30+ minutes for OCR)
- Multi-file upload improves batch processing efficiency
- Enhanced UI reduces user interaction time

### v1.2.0
- Automatic matching reduces manual work
- Bulk operations improve processing speed
- Smart filtering reduces data processing overhead

## Security Enhancements

### v2.1.0
- Enhanced object storage ACL policies
- Improved error handling to prevent data leaks

### v1.1.0
- User authentication and authorization
- Session-based security
- Object-level access control
- Secure file storage with proper permissions

## Known Issues

### Current
- Some older browsers may have compatibility issues with multi-file upload
- Large PDF files (>10MB) may timeout during upload
- Batch operations may be slow with very large datasets

### Resolved in Recent Versions
- ✅ Date parsing errors in AMEX CSV files (fixed in v2.0.0)
- ✅ OCR processing reliability and speed (resolved by removal in v2.0.0)
- ✅ Cross-statement matching limitations (fixed in v2.0.0)
- ✅ Mobile interface display issues (fixed in v2.1.0)

## Contributor Guidelines

For information about contributing to this project, please refer to the development documentation and setup guides in the `/docs` directory.