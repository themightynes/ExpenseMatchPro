/**
 * Migration Script: Local Storage → Cloudflare R2
 *
 * This script migrates all files from .local-storage/uploads/ to Cloudflare R2
 * while preserving the same file paths in the database.
 *
 * Usage: npx tsx server/migrate-local-to-r2.ts
 */

import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { R2StorageService } from './r2Storage';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const LOCAL_STORAGE_DIR = path.join(process.cwd(), '.local-storage', 'uploads');

interface MigrationStats {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ file: string; error: string }>;
}

async function getLocalFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(LOCAL_STORAGE_DIR);
    // Filter out metadata files
    return files.filter(f => !f.endsWith('.meta.json'));
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('ℹ️  No local storage directory found');
      return [];
    }
    throw error;
  }
}

async function readMetadata(fileId: string): Promise<any> {
  const metadataPath = path.join(LOCAL_STORAGE_DIR, `${fileId}.meta.json`);
  try {
    const content = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function migrateFile(
  fileId: string,
  r2Service: R2StorageService,
  s3Client: S3Client,
  bucketName: string,
  stats: MigrationStats
): Promise<void> {
  const filePath = path.join(LOCAL_STORAGE_DIR, fileId);

  try {
    // Read file content
    const buffer = await fs.readFile(filePath);

    // Read metadata
    const metadata = await readMetadata(fileId);

    // Determine content type
    let contentType = 'application/octet-stream';
    if (metadata?.contentType) {
      contentType = metadata.contentType;
    } else {
      // Guess from extension
      const ext = path.extname(fileId).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
      };
      contentType = mimeTypes[ext] || contentType;
    }

    // Upload to R2 with the same key structure
    const key = `uploads/${fileId}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: {
        originalName: metadata?.originalName || fileId,
        uploadedAt: metadata?.uploadedAt || new Date().toISOString(),
        migratedFrom: 'local-storage',
        migratedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    stats.successful++;
    process.stdout.write('✅');
  } catch (error: any) {
    stats.failed++;
    stats.errors.push({
      file: fileId,
      error: error.message,
    });
    process.stdout.write('❌');
  }
}

async function migrate(dryRun: boolean = false): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  console.log('\n🚀 Local Storage → R2 Migration Tool\n');
  console.log('═══════════════════════════════════════════\n');

  // Check R2 configuration
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.error('❌ R2 configuration missing!');
    console.error('Required environment variables:');
    console.error('- R2_ACCOUNT_ID');
    console.error('- R2_ACCESS_KEY_ID');
    console.error('- R2_SECRET_ACCESS_KEY');
    console.error('- R2_BUCKET_NAME\n');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`- Source: ${LOCAL_STORAGE_DIR}`);
  console.log(`- Destination: R2 Bucket "${bucketName}"`);
  console.log(`- Mode: ${dryRun ? 'DRY RUN (no files will be uploaded)' : 'LIVE MIGRATION'}`);
  console.log();

  // Initialize R2
  const r2Service = new R2StorageService();
  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  // Get files to migrate
  const files = await getLocalFiles();
  stats.total = files.length;

  if (stats.total === 0) {
    console.log('ℹ️  No files to migrate\n');
    return stats;
  }

  console.log(`📦 Found ${stats.total} files to migrate\n`);

  if (dryRun) {
    console.log('🔍 DRY RUN - Listing files that would be migrated:\n');
    for (const file of files.slice(0, 10)) {
      const metadata = await readMetadata(file);
      console.log(`  - ${file} (${metadata?.originalName || 'unknown'})`);
    }
    if (files.length > 10) {
      console.log(`  ... and ${files.length - 10} more files\n`);
    }
    console.log(`\n✅ Dry run complete. Run without --dry-run to migrate.\n`);
    return stats;
  }

  // Migrate files with progress indicator
  console.log('⏳ Migrating files...\n');
  console.log('Progress: (✅ = success, ❌ = failed)\n');

  const batchSize = 10; // Process 10 files at a time
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, Math.min(i + batchSize, files.length));
    await Promise.all(
      batch.map(file => migrateFile(file, r2Service, s3Client, bucketName, stats))
    );

    // Show progress every 50 files
    if ((i + batchSize) % 50 === 0 || i + batchSize >= files.length) {
      const progress = Math.min(i + batchSize, files.length);
      console.log(` (${progress}/${files.length})`);
    }
  }

  console.log('\n');
  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  try {
    const stats = await migrate(dryRun);

    console.log('═══════════════════════════════════════════');
    console.log('📊 Migration Summary');
    console.log('═══════════════════════════════════════════');
    console.log(`Total files: ${stats.total}`);
    console.log(`Successful: ${stats.successful} ✅`);
    console.log(`Failed: ${stats.failed} ❌`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log();

    if (stats.failed > 0) {
      console.log('❌ Failed files:');
      stats.errors.forEach(({ file, error }) => {
        console.log(`  - ${file}: ${error}`);
      });
      console.log();
    }

    if (!dryRun && stats.successful > 0) {
      console.log('✅ Migration complete!');
      console.log();
      console.log('Next steps:');
      console.log('1. Verify files in R2 dashboard');
      console.log('2. Test app with R2 storage (already configured)');
      console.log('3. Once verified, you can delete .local-storage/');
      console.log('   Command: rm -rf .local-storage/');
      console.log();
      console.log('⚠️  WARNING: Do not delete local files until you verify');
      console.log('   all files are accessible in R2!\n');
    }

    process.exit(stats.failed > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
