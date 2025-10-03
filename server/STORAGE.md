# Storage Configuration Guide

This application supports multiple storage backends with automatic provider selection.

## Quick Start

### Option 1: Local Storage (Development)

**No configuration needed!** If R2 environment variables are not set, the app automatically uses local file storage.

Files are stored in: `.local-storage/uploads/`

### Option 2: Cloudflare R2 (Production)

Add these environment variables to your `.env` file:

```bash
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name
```

The app will automatically detect and use R2 storage.

## How It Works

### Storage Factory Pattern

The application uses a storage factory (`server/storageFactory.ts`) that automatically selects the appropriate storage provider:

```typescript
import { getStorage } from './storageFactory';

// Automatically returns R2StorageService or LocalObjectStorageService
const storage = getStorage();

// Use the same interface regardless of provider
await storage.uploadFile(buffer, filename, contentType);
```

### Provider Selection Logic

1. **Check for R2 environment variables** (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, etc.)
   - If all R2 vars are present → **Use R2**
   - If any R2 vars are missing → **Use Local Storage**

2. **Singleton pattern** ensures only one storage instance is created per server lifecycle

### Supported Operations

Both storage providers implement the same interface (`IStorageService`):

| Method | Description |
|--------|-------------|
| `uploadFile(buffer, filename, contentType)` | Upload a file, returns object path |
| `getObjectEntityFile(objectPath)` | Get file metadata |
| `downloadObject(fileInfo, res)` | Stream file to HTTP response |
| `deleteObject(objectPath)` | Delete a file |

**R2-only bonus methods:**
- `getPresignedUploadUrl()` - Generate presigned URL for direct frontend uploads
- `getPresignedDownloadUrl()` - Generate presigned URL for secure downloads

## Switching Between Providers

### Development → Production

1. Set R2 environment variables
2. Restart the server
3. App will automatically use R2

Console output will show: `📦 Storage provider: R2`

### Production → Development (Testing)

1. Comment out R2 environment variables in `.env`
2. Restart the server
3. App will automatically use Local storage

Console output will show: `📦 Storage provider: Local`

## File Migration

When switching storage providers, existing files are not automatically migrated.

### Migrating from Local to R2

If you have existing files in `.local-storage/` that need to be moved to R2:

```bash
# Option 1: Manual upload through UI
# Re-upload receipts through the application interface

# Option 2: Write a migration script (future enhancement)
# A script could read from .local-storage/ and upload to R2
```

**Note:** Database file references (`fileUrl` in receipts table) use the same path format (`/objects/uploads/{uuid}`) for both providers, so URLs don't need updating.

## Configuration Details

### Local Storage

**Implementation:** `server/localObjectStorage.ts`

- Files stored in: `.local-storage/uploads/{uuid}`
- Metadata stored in: `.local-storage/uploads/{uuid}.meta.json`
- No external dependencies
- Perfect for development and testing

**Metadata format:**
```json
{
  "originalName": "receipt.jpg",
  "contentType": "image/jpeg",
  "uploadedAt": "2025-10-03T12:00:00.000Z"
}
```

### Cloudflare R2

**Implementation:** `server/r2Storage.ts`

- Uses AWS SDK v3 (`@aws-sdk/client-s3`)
- S3-compatible API
- Metadata stored as S3 object metadata
- Supports presigned URLs
- Free tier: 10GB storage, 1M Class A operations/month

**Setup Requirements:**
1. Cloudflare account with R2 enabled
2. R2 bucket created
3. API token with R2 read/write permissions

**R2 Endpoint Format:**
```
https://{ACCOUNT_ID}.r2.cloudflarestorage.com
```

## CORS Configuration (R2 Only)

If you plan to use presigned URLs for direct frontend uploads, configure CORS in your R2 bucket:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3000
  }
]
```

## Troubleshooting

### "Missing R2 configuration" Error

**Cause:** R2 environment variables are partially set

**Fix:** Either set all 4 required R2 variables, or remove them all to use local storage

Required variables:
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

### Files Not Found After Switching Providers

**Cause:** Files uploaded to one provider don't exist in another

**Fix:** Upload files again, or write a migration script

### R2 Upload Fails with 403 Error

**Cause:** Invalid credentials or insufficient permissions

**Fix:**
1. Verify R2 API token has read/write permissions
2. Check bucket name is correct
3. Verify account ID matches the token

### Local Storage Files Taking Up Disk Space

**Cause:** Files accumulate in `.local-storage/`

**Fix:**
```bash
# Clear local storage (be careful!)
rm -rf .local-storage/

# Or manually delete old files
# The .local-storage/ directory will be recreated automatically
```

## Best Practices

### Development
- ✅ Use local storage (no R2 vars needed)
- ✅ Add `.local-storage/` to `.gitignore`
- ✅ Don't commit uploaded files

### Production
- ✅ Use Cloudflare R2 (set R2 env vars)
- ✅ Configure CORS if using presigned URLs
- ✅ Monitor R2 usage to stay within free tier
- ✅ Set up R2 lifecycle rules for old file cleanup (optional)

### Testing
- ✅ Test uploads with both providers
- ✅ Verify file downloads work
- ✅ Check console logs to confirm active provider
- ✅ Test provider switching (comment/uncomment R2 vars)

## Architecture

```
┌─────────────────────────────────────┐
│       Application Routes            │
│         (routes.ts)                 │
└─────────────┬───────────────────────┘
              │
              ↓
┌─────────────────────────────────────┐
│      Storage Factory                │
│    (storageFactory.ts)              │
│                                     │
│  getStorage() → IStorageService     │
└─────────────┬───────────────────────┘
              │
        ┌─────┴─────┐
        ↓           ↓
┌─────────────┐  ┌──────────────┐
│   Local     │  │   R2         │
│   Storage   │  │   Storage    │
│             │  │              │
│ .local-     │  │ Cloudflare   │
│  storage/   │  │   R2 API     │
└─────────────┘  └──────────────┘
```

## Future Enhancements

Possible improvements:

1. **Migration Script:** Automated tool to move files between providers
2. **Hybrid Mode:** Use both providers simultaneously (e.g., R2 for new files, local for legacy)
3. **AWS S3 Support:** Add third provider option
4. **Google Cloud Storage:** Add fourth provider option
5. **Multi-region R2:** Support multiple R2 buckets for geographic distribution

## Related Files

- `server/storageFactory.ts` - Factory and provider selection
- `server/localObjectStorage.ts` - Local storage implementation
- `server/r2Storage.ts` - R2 storage implementation
- `server/routes.ts` - Storage usage in API routes
- `.env` - Configuration (R2 credentials)
- `docs/Railway-Migration-Guide.md` - Full migration guide

---

For detailed migration steps and Claude Code prompts, see the [Railway Migration Guide](../docs/Railway-Migration-Guide.md).
