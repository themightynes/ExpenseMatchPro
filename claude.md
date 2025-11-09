# ExpenseMatchPro - Claude Session Instructions

## 📊 Project Architecture Overview
TypeScript full-stack application for receipt processing and AMEX expense matching.

**Stack**: React 18 + Vite, Wouter routing, TanStack Query, Clerk auth, Express + Drizzle ORM + PostgreSQL

**Key Components**:
- Receipt upload with OCR (Tesseract.js) and multi-file support (Uppy)
- AMEX CSV import with intelligent charge matching
- Dual storage: Cloudflare R2 (production) / Local filesystem (development)
- Oracle iExpense template generation
- Transportation-specific expense fields (addresses, trip data)

## UI Components

- Using shadcn/ui (New York style) with TypeScript
- Components location: `client/src/components/ui/`
- To add new components: `npx shadcn@latest add [component-name]` from project root
- CSS variables enabled for theming (neutral base color)
- Import alias: `@/components/ui/[component]`

## 🚨 Railway Deployment Environment

**Database**: Railway PostgreSQL with standard `pg` driver
- **Connection**: Uses `DATABASE_URL` environment variable with SSL enabled
- **Pool Settings**: Max 10 connections, 30s idle timeout, 10s connection timeout
- **Local Development**: Default port 5000

## 🗄️ Database & Migrations (Drizzle Kit)

**Quick Reference**: See `/server/STORAGE.md` for storage details.

**Core Rules**:
- ✅ Generate migrations with `npm run db:push`
- ✅ Verify with Drizzle Studio (add db:studio script if needed)
- ✅ Make schema changes **one table at a time**
- ❌ Never modify 3+ tables in a single migration

**Key Tables**:
- `receipts` - Uploaded receipts with OCR data, transportation fields
- `amexStatements` - Statement periods with date ranges
- `amexCharges` - Individual AMEX charges
- `skipAnalytics` - Tracks skipped matches for algorithm improvement

**Critical Relationships**:
- receipts.matchedChargeId → amexCharges.id
- receipts.statementId → amexStatements.id
- Never delete receipts without unlinking charges first

## 🗂️ File Storage Architecture

**Factory Pattern**: `server/storageFactory.ts` auto-selects storage provider

**Production (Cloudflare R2)**:
- Requires env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- Implementation: `server/r2Storage.ts`
- Supports presigned URLs for direct uploads/downloads

**Development (Local)**:
- No configuration needed - auto-fallback if R2 vars missing
- Files stored in: `.local-storage/uploads/`
- Implementation: `server/localObjectStorage.ts`

**Usage**:
```typescript
import { getStorage } from './storageFactory';
const storage = getStorage(); // Returns R2 or Local automatically
```

**Important**: Never hardcode storage paths - always use storage service methods

## 🔐 Authentication & Security

- Authentication powered by Clerk; use Clerk React hooks (`useUser()`, `useAuth()`, `<SignedIn>`, `<UserButton>`)
- Never roll your own auth helpers—extend behavior by composing Clerk primitives
- File-level ACL system in `server/objectAcl.ts` for granular permissions
- Pre-upload authentication verification required

## 🔍 OCR & Receipt Processing

- **Engine**: Tesseract.js for server-side OCR
- **PDF Handling**: Multi-library pipeline (pdf-parse, pdf2pic, pdfjs-dist)
- **Processing**: Background OCR with immediate response
- **Service**: `server/ocrService.ts` with timeout handling
- **Fallback**: Manual entry always available via UI

## 💳 AMEX Integration

- CSV import with automatic date range detection (`server/routes.ts`)
- Intelligent matching: amount + date proximity (7-day window) + merchant similarity
- Cross-statement matching supported
- Charges can be marked as personal or no-receipt-required
- Track skipped matches in `skipAnalytics` table

## ✅ Validation Commands

- `npm run dev` - Starts server with hot reload (port 5000)
- `npm run check` - TypeScript compilation check
- `npm run build` - Build for production (Vite + esbuild)
- `npm run db:push` - Apply Drizzle migrations

## 📋 Implementation Notes

- Receipt-charge matching is complex - preserve matching algorithm logic
- Oracle naming convention: `DATE_MERCHANT_$AMOUNT_RECEIPT.ext`
- Transportation fields are optional - only Uber/Lyft/taxi receipts use them
- Always provide manual entry fallback for OCR failures

## Implementation Philosophy

- **One Layer at a Time**: Never build multiple interdependent systems simultaneously
- **Stub and Ship**: `return true; // TODO: make smarter` is valid first implementation
- **48-Hour Rule**: Any feature should show visible progress within 2 days
- **Annotate Everything**: Mark all hardcoded values, stubs, and missing features with clear TODO/STUB/HARDCODED comments
- Commit incomplete working code > complete non-working code

**Annotation Standards:**
```typescript
// STUB: Will be replaced with ML model in Phase 2
return 0.5;

// HARDCODED: Should read from config eventually
const MATCH_THRESHOLD = 0.85;

// TODO: Add fuzzy matching for merchant names
function matchMerchant() { return exactMatch(); }

// MISSING: Email integration for automated receipt import
```

## ⚠️ Things Not to Do

- ❌ Never modify storage factory without updating both R2 and Local implementations
- ❌ Don't skip OCR validation - always test with real receipts
- ❌ Never delete receipts without unlinking charges (breaks referential integrity)
- ❌ Don't trust AMEX CSV format - always validate column headers
- ❌ Never hardcode file paths - use storage service methods

---
*For comprehensive project documentation, see `/docs/README.md`*
*For storage migration details, see `/.Railway-Migration-Guide.md`*
