import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";
import { db } from "../server/db";
import { receipts } from "@shared/schema";

const LOCAL_STORAGE_DIR = path.join(process.cwd(), ".local-storage", "uploads");

async function checkMissingFiles() {
  console.log("🔍 Checking for missing files...\n");

  try {
    // Get all receipts from database
    const allReceipts = await db.select().from(receipts);
    console.log(`📋 Total receipts in database: ${allReceipts.length}`);

    // Get all files in local storage
    const localFiles = await fs.readdir(LOCAL_STORAGE_DIR);

    // Remove extensions and .meta.json files to get just the IDs
    const localFileIds = new Set(
      localFiles
        .filter(f => !f.endsWith('.meta.json'))
        .map(f => path.basename(f, path.extname(f)))
    );

    console.log(`💾 Files in local storage: ${localFileIds.size}\n`);

    const missingFiles: Array<{
      receiptId: string;
      fileName: string;
      originalFileName: string;
      fileUrl: string;
      merchant: string | null;
      amount: string | null;
      date: Date | null;
    }> = [];

    // Check each receipt
    for (const receipt of allReceipts) {
      if (!receipt.fileUrl) {
        console.log(`⚠️  Receipt ${receipt.id} has no fileUrl`);
        continue;
      }

      // Extract file ID from URL
      // /objects/uploads/abc123 -> abc123
      const fileId = receipt.fileUrl.replace(/^\/objects\/uploads\//, '');

      if (!localFileIds.has(fileId)) {
        missingFiles.push({
          receiptId: receipt.id,
          fileName: receipt.fileName || 'unknown',
          originalFileName: receipt.originalFileName || 'unknown',
          fileUrl: receipt.fileUrl,
          merchant: receipt.merchant,
          amount: receipt.amount,
          date: receipt.date,
        });
      }
    }

    console.log("=".repeat(70));
    console.log(`📊 RESULTS:`);
    console.log("=".repeat(70));
    console.log(`✅ Files found: ${allReceipts.length - missingFiles.length}`);
    console.log(`❌ Missing files: ${missingFiles.length}\n`);

    if (missingFiles.length > 0) {
      console.log("🔴 MISSING FILES:\n");

      missingFiles.forEach((missing, index) => {
        console.log(`${index + 1}. File ID: ${missing.fileUrl.replace('/objects/uploads/', '')}`);
        console.log(`   Receipt ID: ${missing.receiptId}`);
        console.log(`   Original Name: ${missing.originalFileName}`);
        console.log(`   Merchant: ${missing.merchant || 'N/A'}`);
        console.log(`   Amount: ${missing.amount || 'N/A'}`);
        console.log(`   Date: ${missing.date?.toISOString().split('T')[0] || 'N/A'}`);
        console.log(`   Database URL: ${missing.fileUrl}`);
        console.log('');
      });

      // Save to JSON file for reference
      await fs.writeFile(
        path.join(process.cwd(), "missing-files-report.json"),
        JSON.stringify(missingFiles, null, 2)
      );
      console.log("📄 Full report saved to: missing-files-report.json\n");

      // Create instructions
      console.log("=".repeat(70));
      console.log("📝 NEXT STEPS:");
      console.log("=".repeat(70));
      console.log("1. Go to Replit object storage");
      console.log("2. Navigate to .private/uploads/");
      console.log("3. Download these specific files:\n");

      missingFiles.forEach((missing, index) => {
        const fileId = missing.fileUrl.replace('/objects/uploads/', '');
        console.log(`   ${index + 1}. ${fileId}`);
      });

      console.log("\n4. Place them in: .local-storage/uploads/");
      console.log("5. Re-run this script to verify");
      console.log("=".repeat(70));
    } else {
      console.log("🎉 All files are present! No missing files.");
    }

    // Also check for orphaned files (files without database records)
    const orphanedFiles: string[] = [];
    const receiptFileIds = new Set(
      allReceipts
        .filter(r => r.fileUrl)
        .map(r => r.fileUrl!.replace(/^\/objects\/uploads\//, ''))
    );

    for (const fileId of localFileIds) {
      if (!receiptFileIds.has(fileId)) {
        orphanedFiles.push(fileId);
      }
    }

    if (orphanedFiles.length > 0) {
      console.log("\n⚠️  ORPHANED FILES (in storage but not in database):");
      console.log(`   Count: ${orphanedFiles.length}\n`);

      orphanedFiles.forEach((fileId, index) => {
        console.log(`   ${index + 1}. ${fileId}`);
      });

      console.log("\n   These files can be safely deleted or may be from deleted receipts.");
    }

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// Run the check
checkMissingFiles()
  .then(() => {
    console.log("\n✅ Check complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
