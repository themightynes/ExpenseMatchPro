# Changelog

All notable changes to the Receipt Manager application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Critical Application Crash (August 10, 2025)**: Resolved fatal "Cannot set headers after they are sent to the client" error that prevented server startup
- **Receipt Processing Reliability**: Fixed duplicate HTTP response issue in receipt upload endpoint, ensuring stable file upload functionality
- **Server Stability**: Application now runs consistently without crashes during receipt processing operations

### Added
- Individual statement detail pages with comprehensive CSV data display
- Modern financial app-inspired dashboard design with color-coded metrics
- Interactive sortable data tables showing complete charge information
- Advanced search and filtering capabilities across all charge fields
- Individual charge notes functionality with expandable edit sections
- Personal expense toggling with dedicated filtering options
- Visual status indicators for charge matching and personal expenses
- Real-time statistics dashboard with financial summaries
- Mobile-responsive table layout with horizontal scrolling support
- Export to Oracle iExpense functionality from statement detail pages

### Changed
- Replaced popup dialogs with dedicated statement pages for better data visualization
- Enhanced UI with modern table design inspired by financial applications
- Improved navigation flow from statement list to detailed charge view
- Statement viewing experience optimized for comprehensive data analysis
- Replaced horizontal scrolling table with vertical card layout for better readability
- Restructured expense display with clear 3-row information hierarchy
- Enhanced notes functionality with expandable sections and improved UX
- Optimized charge management interface for mobile and desktop viewing

### Technical
- **Critical Bug Resolution**: Fixed receipt processing endpoint to prevent duplicate HTTP responses and ensure proper background processing
- **Error Handling Improvements**: Enhanced error handling in receipt upload workflow with proper async processing patterns
- Added `/statements/:id` route for individual statement pages
- Implemented new API endpoint for single statement retrieval
- Enhanced React Query integration for statement detail data fetching
- Updated routing in statements list to use Link components instead of modal triggers
- Created comprehensive UI design documentation with modern financial app patterns
- Fixed React hooks issues and infinite render loops in statement detail component
- Resolved React hooks infinite update loop with proper dependency array management
- Implemented vertical card layout replacing horizontal scrolling table for improved UX
- Enhanced expense display with structured 3-row information format
- Integrated direct receipt links for matched expenses with improved visual hierarchy
- Optimized notes system with expandable sections and better error handling

### Documentation Updates
- Updated project architecture documentation with new statement detail features
- Added comprehensive UI design guide with component standards and accessibility guidelines
- Enhanced feature documentation with detailed descriptions of new statement management capabilities
- Documented modern financial app design patterns and responsive design principles
- **Updated Technical Documentation**: Added debugging and stability improvements to system documentation

## [1.0.0] - 2025-08-09

### Added
- Complete expense management workflow from receipt upload to Oracle iExpense export
- Multi-file upload capability (up to 10 receipts simultaneously)
- Comprehensive OCR processing system using Tesseract.js
- Manual OCR trigger with "Extract Text" button
- AMEX statement CSV import with automatic date range detection
- Smart receipt-to-charge matching algorithm across all statement periods
- Oracle iExpense compatible naming convention (DATE_MERCHANT_$AMOUNT_RECEIPT.ext)
- Automatic receipt organization with intelligent fallback logic
- Receipt deletion functionality with automatic charge unlinking
- Duplicate statement detection to prevent overlapping imports
- Cross-statement matching capabilities
- PDF receipt handling with guidance for manual entry
- Image OCR support for JPEG, PNG, and other formats
- Real-time processing status indicators
- Financial dashboard with comprehensive statistics
- Receipt viewer with PDF preview and image display
- Statement folder organization system
- Expense template generation for Oracle integration

### Fixed
- CSV date parsing errors for AMEX statements (MM/DD/YYYY format)
- Receipt-charge linking using correct AMEX 'description' field
- OCR processing stability and error handling
- Matching interface data population from charge information
- PDF viewing with compact preview interface
- Receipt naming with Oracle-friendly conventions
- Data completion from matched AMEX charges during organization

### Changed
- OCR processing moved to client-side for better performance
- Manual entry system replaces 30+ minute OCR processing times
- Receipts can be matched across all statement periods, not restricted by date ranges
- Automatic organization fills missing receipt data from matched charges
- Enhanced UI feedback with clear status indicators

### Technical
- React 18 with TypeScript frontend using Vite
- Node.js/Express backend with PostgreSQL database
- Drizzle ORM for type-safe database operations
- Google Cloud Storage for file management
- TanStack Query for server state management
- Radix UI components with shadcn/ui design system
- Tailwind CSS for styling
- Uppy for file upload handling

## [0.9.0] - 2025-08-08

### Added
- Initial project setup and architecture
- Basic receipt upload and storage
- AMEX integration foundation
- Database schema design
- User authentication system

### Technical
- PostgreSQL database setup with Neon
- Express.js API server configuration
- React frontend initialization
- File upload infrastructure

## Development Notes

### Architecture Decisions
- **Manual Entry Priority**: Chose manual entry over long OCR processing times for better user experience
- **Cross-Statement Matching**: Implemented global matching to handle receipts across different statement periods
- **Oracle Naming Convention**: Adopted DATE_MERCHANT_$AMOUNT_RECEIPT.ext format for enterprise compatibility
- **Intelligent Fallbacks**: System uses "UNKNOWN_*" fallbacks for missing data in organization

### Performance Optimizations
- Client-side OCR processing with Tesseract.js
- Efficient database queries with proper indexing
- Optimized file organization with automatic path generation
- Smart caching for dashboard statistics

### Security Considerations
- Secure file upload handling with validation
- Protected API endpoints with proper authentication
- Database security with parameterized queries
- Corporate email integration adapted for security constraints

### Future Roadmap
- Advanced OCR accuracy improvements
- Machine learning for better receipt-charge matching
- Mobile app development
- Additional enterprise integrations
- Bulk processing capabilities
- Advanced reporting and analytics