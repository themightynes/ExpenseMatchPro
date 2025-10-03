/**
 * Verify R2 Migration
 *
 * Checks that migrated files are accessible in R2
 * Usage: npx tsx server/verify-r2-migration.ts
 */

import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { R2StorageService } from './r2Storage';

const LOCAL_STORAGE_DIR = path.join(process.cwd(), '.local-storage', 'uploads');

async function verifyMigration() {
  console.log('\n🔍 Verifying R2 Migration...\n');

  const r2 = new R2StorageService();

  // Get a few sample files from local storage
  const files = await fs.readdir(LOCAL_STORAGE_DIR);
  const sampleFiles = files.filter(f => !f.endsWith('.meta.json')).slice(0, 5);

  console.log(`Testing ${sampleFiles.length} sample files:\n`);

  let successCount = 0;
  let failCount = 0;

  for (const fileId of sampleFiles) {
    const objectPath = `/objects/uploads/${fileId}`;

    try {
      // Try to get file info from R2
      const fileInfo = await r2.getObjectEntityFile(objectPath);

      console.log(`✅ ${fileId}`);
      console.log(`   Content-Type: ${fileInfo.contentType}`);
      console.log(`   Original Name: ${fileInfo.metadata?.originalName || 'N/A'}`);
      console.log(`   Migrated: ${fileInfo.metadata?.migratedFrom || 'N/A'}`);
      console.log();

      successCount++;
    } catch (error: any) {
      console.log(`❌ ${fileId}`);
      console.log(`   Error: ${error.message}`);
      console.log();
      failCount++;
    }
  }

  console.log('═══════════════════════════════════════════');
  console.log('Verification Results:');
  console.log(`✅ Accessible: ${successCount}/${sampleFiles.length}`);
  console.log(`❌ Not accessible: ${failCount}/${sampleFiles.length}`);
  console.log();

  if (failCount === 0) {
    console.log('🎉 All sample files verified successfully!');
    console.log('\nYour files are now in R2 and accessible.');
    console.log('You can now:');
    console.log('1. Test your app to ensure everything works');
    console.log('2. Delete .local-storage/ once fully verified');
    console.log();
  } else {
    console.log('⚠️  Some files could not be verified.');
    console.log('Check your R2 configuration and try again.\n');
  }
}

verifyMigration().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
