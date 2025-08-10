# Upload System Architecture

## Overview

The Receipt Manager implements a sophisticated dual-architecture upload system that automatically adapts to device capabilities, providing optimized experiences for both desktop and mobile users while maintaining security and performance.

## Architecture Components

### Frontend Components

#### 1. FileUploadZone.tsx
**Purpose**: Main upload interface with intelligent device detection

**Key Features**:
- Automatic device capability detection using user agent and pointer precision
- Seamless switching between desktop and mobile upload methods
- Real-time progress tracking and status updates
- Authentication verification before upload initiation
- Comprehensive error handling and user feedback

**Device Detection Logic**:
```javascript
// Mobile detection prioritizes touch interfaces
const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
const isDesktop = /windows|macintosh|linux/i.test(userAgent) && !isMobileUserAgent;
const hasMouseInput = window.matchMedia('(pointer: fine)').matches;

// Use mobile uploader if mobile device OR lacks fine pointer control
setIsMobile(isMobileUserAgent || (!isDesktop || !hasMouseInput));
```

#### 2. MobileFileUploader.tsx
**Purpose**: Touch-optimized upload interface for mobile devices

**Features**:
- Sequential file processing with progress indicators
- Pre-upload authentication verification
- Server-based upload with FormData
- Toast notifications for upload status
- Support for multiple file selection

**Upload Flow**:
1. Authentication status check
2. File validation and preparation
3. FormData upload to `/api/objects/upload`
4. Background receipt processing
5. Cache invalidation and UI updates

#### 3. ObjectUploader.tsx
**Purpose**: Advanced desktop upload interface using Uppy

**Features**:
- Direct-to-storage uploads using presigned URLs
- Modal dashboard interface with file management
- Configurable file limits and restrictions
- Automatic retry logic and error handling
- Real-time upload progress with detailed feedback

**Integration**:
- Uses Uppy's AWS S3 plugin with Google Cloud Storage compatibility
- Generates presigned URLs for secure direct uploads
- Handles upload completion and post-processing workflows

### Backend Implementation

#### 1. Direct Upload Endpoint (`/api/objects/upload`)
**Purpose**: Server-based file upload with Google Cloud Storage integration

**Implementation**:
```javascript
app.post("/api/objects/upload", requireAuth, upload.single('file'), async (req, res) => {
  // File validation and metadata extraction
  // Direct upload to Google Cloud Storage
  // Return object path for processing
});
```

**Features**:
- Multer middleware for multipart/form-data handling
- Authentication requirement (requireAuth middleware)
- Direct GCS upload with metadata preservation
- Unique object ID generation with UUID
- Comprehensive error handling and logging

#### 2. Receipt Processing Endpoint (`/api/receipts/process`)
**Purpose**: Create receipt records and initiate background processing

**Architecture**:
- Immediate response pattern for better UX
- Background OCR processing with Tesseract.js
- Automatic statement assignment and matching
- ACL policy application for access control
- File organization and structured storage

**Processing Pipeline**:
1. Receipt record creation with 'processing' status
2. Immediate HTTP response to client
3. Background OCR text extraction
4. Data parsing and field population
5. Automatic statement assignment
6. Smart matching with AMEX charges
7. File organization and ACL setup

#### 3. Object Storage Service
**Purpose**: Google Cloud Storage integration with advanced features

**Capabilities**:
- Presigned URL generation for direct uploads
- ACL policy management for access control
- File organization and movement operations
- Metadata management and custom properties
- Search and retrieval operations across storage paths

## Upload Workflows

### Desktop Upload Flow (Uppy-based)
1. **Device Detection**: System identifies desktop capability
2. **Component Loading**: ObjectUploader with Uppy dashboard
3. **File Selection**: Drag-and-drop or file picker interface
4. **Presigned URL**: Backend generates secure upload URL
5. **Direct Upload**: Files upload directly to Google Cloud Storage
6. **Completion Callback**: Triggers receipt processing workflow
7. **Background Processing**: OCR and matching run asynchronously

### Mobile Upload Flow (Server-based)
1. **Device Detection**: System identifies mobile/touch device
2. **Component Loading**: MobileFileUploader interface
3. **Authentication Check**: Verifies user session before upload
4. **File Selection**: Touch-optimized file picker
5. **Server Upload**: FormData sent to `/api/objects/upload`
6. **Progress Tracking**: Real-time upload progress display
7. **Receipt Processing**: Automatic creation and background OCR

## Security Features

### Authentication Integration
- All uploads require valid user authentication
- Pre-upload session verification prevents unauthorized access
- Protected API endpoints with middleware enforcement
- Session-based authentication with secure cookies

### Access Control
- Custom ACL policies for uploaded objects
- Private storage with controlled access
- Owner-based permissions system
- Granular access controls for different user types

### File Validation
- MIME type validation for supported formats
- File size limits (10MB maximum)
- Extension validation and security checks
- Content-type verification during upload

## Performance Optimizations

### Immediate Response Pattern
- Upload endpoints return immediately after file storage
- Background processing prevents blocking user interactions
- Async OCR processing with status updates
- Parallel processing for multiple files

### Device-Specific Optimization
- Desktop: Direct-to-storage uploads reduce server load
- Mobile: Server-based uploads optimize for cellular connections
- Automatic selection based on device capabilities
- Optimized UI/UX for each platform type

### Progress Tracking
- Real-time upload progress indicators
- Processing status updates with user feedback
- Error states with actionable recovery options
- Batch upload progress with individual file status

## Error Handling

### Client-Side Errors
- Network connectivity issues with retry logic
- File validation errors with clear user messaging
- Authentication failures with redirect to login
- Upload timeouts with automatic retry attempts

### Server-Side Errors
- Storage service failures with fallback options
- OCR processing errors with manual entry fallback
- Database connection issues with proper error responses
- Rate limiting and resource management

### Recovery Mechanisms
- Automatic retry for transient failures
- Manual retry options for failed uploads
- Partial upload recovery and resumption
- Graceful degradation for service outages

## Integration Points

### OCR Service Integration
- Automatic processing trigger after upload completion
- Support for images (JPEG, PNG, etc.) and PDF files
- PDF-to-image conversion for text extraction
- Tesseract.js integration with optimized parameters

### Database Integration
- Receipt record creation with immediate persistence
- Status tracking throughout processing pipeline
- Metadata storage for uploaded files
- Relationship management with AMEX charges

### Storage Integration
- Google Cloud Storage for scalable file storage
- Object organization with statement-based folders
- Automated file movement and organization
- Backup and redundancy through cloud provider

## Monitoring and Analytics

### Upload Metrics
- Success/failure rates by device type
- Processing time analytics for OCR operations
- File size and type distribution analysis
- User engagement metrics for upload features

### Performance Monitoring
- Upload speed and completion times
- Server response times for upload endpoints
- Storage operation latency measurements
- Error rate tracking and alerting

### User Experience Tracking
- Device detection accuracy and performance
- Upload method selection effectiveness
- User completion rates and abandonment analysis
- Feature adoption and usage patterns