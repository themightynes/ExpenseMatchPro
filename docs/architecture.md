# System Architecture

Comprehensive overview of the Receipt Manager application architecture, including technology stack, design patterns, and system components.

## Architecture Overview

The Receipt Manager follows a modern full-stack architecture with clear separation of concerns, cloud-native design, and emphasis on performance and scalability.

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │  External       │
│   (React/TS)    │◄──►│   (Node.js/TS)  │◄──►│  Services       │
│                 │    │                 │    │                 │
│ • React 18      │    │ • Express.js    │    │ • Google Cloud  │
│ • TypeScript    │    │ • TypeScript    │    │ • Neon DB       │
│ • Vite Build    │    │ • Drizzle ORM   │    │ • Replit Auth   │
│ • TanStack      │    │ • PostgreSQL    │    │                 │
│ • Tailwind CSS  │    │ • Object Store  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Frontend Architecture

### Technology Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: Radix UI primitives with shadcn/ui design system
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state
- **Routing**: Wouter for lightweight client-side routing
- **File Upload**: Uppy with AWS S3 integration

### Component Architecture
```
src/
├── components/
│   ├── ui/                 # Reusable UI components (shadcn/ui)
│   ├── ReceiptViewer.tsx   # Receipt display and editing
│   ├── MatchingInterface.tsx # Receipt-charge matching
│   ├── UploadDialog.tsx    # Multi-file upload interface
│   └── Dashboard.tsx       # Main dashboard component
├── pages/
│   ├── dashboard.tsx       # Dashboard page
│   ├── receipts.tsx        # Receipt management
│   └── statements.tsx      # Statement management
├── hooks/
│   ├── use-toast.ts        # Toast notification hook
│   └── use-query-client.ts # API query management
└── lib/
    ├── queryClient.ts      # TanStack Query configuration
    └── utils.ts           # Utility functions
```

### Design Patterns
- **Component Composition**: Reusable UI components with clear props
- **Custom Hooks**: Encapsulated state logic and side effects
- **Provider Pattern**: Context for global state (theme, auth)
- **Render Props**: Flexible component APIs for complex interactions

## Backend Architecture

### Technology Stack
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL
- **File Storage**: Google Cloud Storage with custom ACL
- **Authentication**: Replit Auth integration
- **Session Management**: Memory-based sessions

### Service Architecture
```
server/
├── routes.ts              # API endpoints and routing
├── storage.ts             # Database operations and business logic
├── objectStorage.ts       # Cloud storage integration
├── objectAcl.ts          # Access control policies
├── fileOrganizer.ts      # File organization logic
├── db.ts                 # Database connection
└── index.ts              # Application entry point
```

### API Design Patterns
- **RESTful Endpoints**: Standard REST conventions
- **Middleware Chain**: Authentication, validation, error handling
- **Service Layer**: Business logic separation from routes
- **Repository Pattern**: Data access abstraction

## Data Architecture

### Database Schema
```sql
-- Core entities with relationships
Users (1) ──── (N) Receipts
                    │
                    │ (1:1)
                    ▼
              AmexCharges ──── (N:1) AmexStatements
```

### Entity Relationships
- **Users**: Authentication and user preferences
- **Receipts**: File metadata, processing status, organization
- **AmexStatements**: Statement periods with date ranges
- **AmexCharges**: Individual transactions with categorization
- **ExpenseTemplates**: Oracle export data structures

### Data Flow
1. **Receipt Upload** → Object Storage + Database Record
2. **Manual Entry** → Database Update + Status Change
3. **AMEX Import** → Statement Creation + Charge Records
4. **Matching** → Bidirectional Links + Data Completion
5. **Organization** → File Movement + Path Updates

## Storage Architecture

### Object Storage Design
```
Google Cloud Storage
├── .private/
│   └── uploads/           # User upload staging area
└── statements/
    ├── {statement-id}/
    │   ├── Matched/       # Matched receipts (Oracle names)
    │   └── Unmatched/     # Unmatched receipts
    └── Inbox_New/         # Unprocessed receipts
```

### Access Control
- **User Isolation**: Complete separation of user data
- **ACL Policies**: Object-level permissions
- **Presigned URLs**: Direct client-to-storage uploads
- **Audit Trail**: Complete access logging

### File Lifecycle
1. **Upload**: Temporary storage with unique identifiers
2. **Processing**: Manual data entry and validation
3. **Organization**: Movement to structured folders
4. **Archival**: Long-term storage with retention policies

## Security Architecture

### Authentication Flow
```
Client Request → Replit Auth → Session Validation → Route Handler
                     ↓
              Session Storage ← User Context
```

### Security Layers
- **Transport Security**: HTTPS for all communications
- **Session Security**: Secure session cookies with expiration
- **Data Isolation**: User-specific data access controls
- **Input Validation**: Comprehensive input sanitization
- **Error Handling**: Secure error messages without data leaks

### Access Control
- **Route Protection**: Authentication middleware on all routes
- **Object ACL**: File-level access control
- **Database Security**: Query parameterization and validation
- **Audit Logging**: Complete activity tracking

## Performance Architecture

### Frontend Optimization
- **Code Splitting**: Dynamic imports for route-based splitting
- **Lazy Loading**: On-demand component loading
- **Caching**: TanStack Query for intelligent data caching
- **Bundle Optimization**: Vite tree-shaking and minification

### Backend Optimization
- **Database Indexing**: Strategic indexes on query patterns
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Efficient ORM queries with joins
- **Caching Strategy**: Memory caching for frequently accessed data

### File Storage Optimization
- **Direct Upload**: Client-to-storage uploads bypass server
- **CDN Integration**: Global content delivery
- **Compression**: Automatic image optimization
- **Streaming**: Efficient large file handling

## Scalability Considerations

### Horizontal Scaling
- **Stateless Design**: No server-side session storage
- **Database Scaling**: Connection pooling and read replicas
- **Storage Scaling**: Cloud storage auto-scaling
- **Load Balancing**: Multiple application instances

### Performance Monitoring
- **Database Metrics**: Query performance and connection usage
- **Storage Metrics**: Upload/download performance
- **Application Metrics**: Response times and error rates
- **User Metrics**: Feature usage and performance impact

## Development Architecture

### Build System
- **Vite Configuration**: Optimized development and production builds
- **TypeScript**: Strict type checking across frontend and backend
- **Hot Module Replacement**: Fast development iteration
- **Asset Pipeline**: Optimized asset handling and CDN integration

### Code Organization
```
Project Structure
├── client/                # Frontend application
│   ├── src/              # React components and logic
│   └── public/           # Static assets
├── server/               # Backend application
│   ├── routes.ts         # API endpoints
│   └── storage.ts        # Business logic
├── shared/               # Shared types and schemas
│   └── schema.ts         # Database and validation schemas
└── docs/                 # Documentation
```

### Development Workflow
- **Type Safety**: Shared types between frontend and backend
- **API Contracts**: Consistent request/response interfaces
- **Error Boundaries**: Comprehensive error handling
- **Development Tools**: ESLint, Prettier, TypeScript strict mode

## Deployment Architecture

### Hosting Platform
- **Replit Platform**: Managed hosting with integrated development
- **Automatic Deployment**: Git-based deployment pipeline
- **Environment Management**: Development and production environments
- **Monitoring**: Built-in application monitoring

### Infrastructure Components
- **Application Server**: Node.js Express application
- **Database**: Neon serverless PostgreSQL
- **File Storage**: Google Cloud Storage buckets
- **CDN**: Replit's content delivery network

### Configuration Management
- **Environment Variables**: Secure configuration storage
- **Secrets Management**: Encrypted API keys and credentials
- **Feature Flags**: Runtime feature toggles
- **Health Checks**: Application health monitoring

## Integration Architecture

### External Service Integration
```
Receipt Manager
├── Google Cloud Storage  # File storage and CDN
├── Neon Database        # PostgreSQL hosting
├── Replit Auth          # Authentication service
└── Future Integrations  # Oracle, QuickBooks, etc.
```

### API Design
- **RESTful Convention**: Standard HTTP methods and status codes
- **JSON Communication**: Consistent request/response format
- **Error Handling**: Standardized error responses
- **Versioning Strategy**: Future API versioning support

### Data Integration
- **CSV Processing**: AMEX statement import
- **File Processing**: Receipt image and PDF handling
- **Export Generation**: Oracle iExpense template creation
- **Audit Trail**: Complete data lineage tracking

## Future Architecture Considerations

### Microservices Evolution
- **Service Decomposition**: Separate services for specific domains
- **API Gateway**: Centralized API management
- **Service Discovery**: Dynamic service registration
- **Inter-service Communication**: Message queues and event streams

### Advanced Features
- **Real-time Updates**: WebSocket or SSE for live updates
- **Background Processing**: Queue-based async processing
- **Machine Learning**: AI/ML pipeline integration
- **Advanced Analytics**: Data warehouse integration

### Scalability Enhancements
- **Database Sharding**: Horizontal database scaling
- **Caching Layer**: Redis for distributed caching
- **Content Delivery**: Global CDN optimization
- **Auto-scaling**: Dynamic resource allocation

This architecture provides a solid foundation for current requirements while maintaining flexibility for future enhancements and scaling needs.