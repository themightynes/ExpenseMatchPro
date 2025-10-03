/**
 * Check file paths in database vs R2
 */

import 'dotenv/config';
import { db } from './db';
import { receipts } from '../shared/schema';
import { R2StorageService } from './r2Storage';

async function checkFilePaths() {
  console.log('\n🔍 Checking File Paths...\n');

  // Get sample receipts from database
  const sampleReceipts = await db.select({
    id: receipts.id,
    fileName: receipts.fileName,
    fileUrl: receipts.fileUrl,
  })
  .from(receipts)
  .limit(10);

  console.log(`Found ${sampleReceipts.length} receipts in database\n`);

  const r2 = new R2StorageService();

  for (const receipt of sampleReceipts) {
    console.log(`Receipt ID: ${receipt.id}`);
    console.log(`  fileName: ${receipt.fileName}`);
    console.log(`  fileUrl: ${receipt.fileUrl}`);

    if (!receipt.fileUrl) {
      console.log(`  ⚠️  No fileUrl set\n`);
      continue;
    }

    // Try to access file in R2
    try {
      const fileInfo = await r2.getObjectEntityFile(receipt.fileUrl);
      console.log(`  ✅ Found in R2 (${fileInfo.contentType})\n`);
    } catch (error: any) {
      console.log(`  ❌ NOT found in R2: ${error.message}`);

      // Check what the path should be
      const expectedPath = `/objects/uploads/${receipt.fileName}`;
      console.log(`  Expected path: ${expectedPath}`);

      try {
        const altFileInfo = await r2.getObjectEntityFile(expectedPath);
        console.log(`  ✅ Found with expected path! (${altFileInfo.contentType})`);
        console.log(`  🔧 Database needs update: ${receipt.fileUrl} → ${expectedPath}\n`);
      } catch {
        console.log(`  ❌ Also not found with expected path\n`);
      }
    }
  }

  process.exit(0);
}

checkFilePaths().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
