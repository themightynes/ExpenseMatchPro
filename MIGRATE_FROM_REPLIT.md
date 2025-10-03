# Migrate Files from Replit to Local Development

You have 119 files stored in Replit object storage. This guide will help you download them all and set up local development.

## Overview

1. **Download files from Replit** (run on Replit)
2. **Transfer backup to your local machine**
3. **Import to local storage** (run on localhost)
4. **Verify everything works**

---

## Step 1: Download Files from Replit

### On Replit:

1. **Push your latest code to Replit** (including the download script)

2. **Open Replit Shell** and run:
   ```bash
   npx tsx scripts/download-replit-files.ts
   ```

3. **Wait for completion**. You'll see:
   ```
   📊 Download Summary:
      ✅ Successfully downloaded: 119 files
      ❌ Failed: 0 files
      📁 Files saved to: /path/to/replit-files-backup
   ```

4. **Files are now in `replit-files-backup/` directory** on Replit

### What Gets Downloaded:

- ✅ All 119 files from `.private/uploads/`
- ✅ Metadata for each file (content type, size, etc.)
- ✅ Manifest file listing all files
- ✅ Receipt-to-file mapping from database

---

## Step 2: Transfer Files to Your Local Machine

You have several options:

### Option A: Download via Replit Interface (Easiest)

1. In Replit, find the `replit-files-backup` folder
2. Right-click → **Download as ZIP**
3. Extract on your local machine to your project directory

### Option B: Use Git (If Files Fit in Repository)

```bash
# On Replit
git add replit-files-backup/
git commit -m "Backup Replit files"
git push

# On localhost
git pull
```

**Warning**: Git has file size limits. If total backup > 100MB, use Option A or C.

### Option C: Use rsync/scp (Advanced)

If you have SSH access to Replit:
```bash
rsync -avz replit:/path/to/replit-files-backup ./replit-files-backup
```

### Option D: Cloud Transfer (For Large Files)

1. On Replit, zip the backup:
   ```bash
   cd ~
   zip -r replit-backup.zip replit-files-backup/
   ```
2. Upload to Google Drive, Dropbox, or similar
3. Download to your local machine
4. Extract to project directory

---

## Step 3: Import to Local Storage

### On Your Local Machine:

1. **Verify backup directory exists**:
   ```bash
   ls replit-files-backup/
   # You should see: .private/, download-manifest.json, receipt-file-mapping.json
   ```

2. **Run import script**:
   ```bash
   npx tsx scripts/import-to-local-storage.ts
   ```

3. **Wait for completion**:
   ```
   📊 Import Summary:
      ✅ Successfully imported: 119 files
      ⚠️  Skipped: 0 files
      ❌ Failed: 0 files
      📁 Files imported to: .local-storage/uploads/
   ```

4. **Files are now in `.local-storage/uploads/`**

---

## Step 4: Verify Everything Works

1. **Restart your dev server**:
   ```bash
   npm run dev
   ```

2. **Check logs for**:
   ```
   🏠 Using local file storage for development
   📁 Local storage initialized: /path/to/.local-storage
   ```

3. **Open your app**: `http://localhost:3000`

4. **Test**:
   - ✅ Login with Clerk
   - ✅ Navigate to receipts
   - ✅ Verify images/PDFs display
   - ✅ Test uploading new receipt
   - ✅ Check that new upload displays

---

## File Structure After Migration

```
your-project/
├── .local-storage/           # Local file storage
│   └── uploads/
│       ├── abc123            # File
│       ├── abc123.meta.json  # Metadata
│       ├── def456
│       └── ...
├── replit-files-backup/      # Backup from Replit (can delete after import)
│   ├── .private/
│   │   └── uploads/
│   ├── download-manifest.json
│   └── receipt-file-mapping.json
└── scripts/
    ├── download-replit-files.ts
    └── import-to-local-storage.ts
```

---

## Database Considerations

### File URLs in Database

Your receipt records have `fileUrl` like:
```
/objects/uploads/abc123
```

These URLs work for both:
- ✅ Replit object storage (old)
- ✅ Local file storage (new)

**No database changes needed!** The same URL format works in both environments.

---

## Troubleshooting

### Download Script Fails on Replit

**Error**: `connect ECONNREFUSED 127.0.0.1:1106`

**Solution**: The script must run ON Replit where the credential service is available. Can't run this on localhost.

### Files Not Found After Import

**Check**:
```bash
ls -la .local-storage/uploads/
```

Should show 119 files. If empty:
1. Verify `replit-files-backup/` exists
2. Check manifest: `cat replit-files-backup/download-manifest.json`
3. Re-run import script

### Images Still Not Displaying

**Check console logs**:
```
Serving object path: /objects/uploads/abc123
```

**Verify file exists**:
```bash
ls .local-storage/uploads/abc123
```

**Check metadata**:
```bash
cat .local-storage/uploads/abc123.meta.json
```

### Import Script Shows "Skipped" Files

The file was in the manifest but not actually downloaded. Possible reasons:
- Download failed for that file
- File was deleted from Replit between manifest creation and download
- Permission issue on Replit

Re-run download script on Replit to capture missed files.

---

## Cleaning Up

### After Successful Migration:

1. **Keep backup temporarily** (until you're confident everything works):
   ```bash
   # Don't delete yet
   replit-files-backup/
   ```

2. **Add to .gitignore** (if not already):
   ```
   .local-storage/
   replit-files-backup/
   *.zip
   ```

3. **After confirming everything works** (1-2 weeks):
   ```bash
   # Delete backup
   rm -rf replit-files-backup/

   # Optional: Archive for safekeeping
   zip -r replit-backup-$(date +%Y%m%d).zip replit-files-backup/
   ```

---

## Moving to Production (Non-Replit)

When deploying to a non-Replit host:

### Option 1: Cloud Storage (Recommended)

Use AWS S3, Google Cloud Storage, or similar:

1. Upload all files to cloud storage
2. Update `objectStorage.ts` to use cloud provider SDK
3. Update file URLs in database if needed

### Option 2: Server File Storage

Keep files on server disk:

1. Upload `.local-storage/` to your production server
2. Ensure proper permissions
3. Set up backups (files are not in version control)

### Option 3: CDN + Cloud Storage

Best for production:

1. Upload files to cloud storage
2. Set up CDN (Cloudflare, CloudFront)
3. Update URLs to use CDN

---

## Quick Reference

### Commands

```bash
# On Replit - Download files
npx tsx scripts/download-replit-files.ts

# On Localhost - Import files
npx tsx scripts/import-to-local-storage.ts

# Check files
ls -la .local-storage/uploads/ | wc -l

# Check manifest
cat replit-files-backup/download-manifest.json | jq '.totalFiles'
```

### Expected File Count

- **Replit object storage**: 119 files
- **After download**: 119 files in `replit-files-backup/`
- **After import**: 119 files in `.local-storage/uploads/`

---

## Timeline

1. ⏱️ **Download on Replit**: 2-5 minutes (119 files)
2. ⏱️ **Transfer to localhost**: 1-10 minutes (depends on method)
3. ⏱️ **Import to local storage**: 1-2 minutes
4. ⏱️ **Testing**: 5-10 minutes

**Total**: ~15-30 minutes

---

## Need Help?

Common issues:

1. **Script won't run**: Make sure you're using `npx tsx` not `node`
2. **Permission errors**: Check file permissions with `ls -la`
3. **Missing files**: Re-run download on Replit
4. **Large files slow**: Consider cloud storage instead of local

Your data is safe - we're not deleting anything from Replit until you confirm everything works!
