import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";
import { db } from "../server/db";
import { receipts } from "@shared/schema";

const LOCAL_STORAGE_DIR = path.join(process.cwd(), ".local-storage", "uploads");

async function cleanOrphanedFiles() {
  console.log("🧹 Cleaning orphaned files...\n");

  try {
    // Get all receipts from database
    const allReceipts = await db.select().from(receipts);

    // Get all files in local storage
    const localFiles = await fs.readdir(LOCAL_STORAGE_DIR);

    // Remove extensions and .meta.json files to get just the IDs
    const localFileIds = localFiles
      .filter(f => !f.endsWith('.meta.json'))
      .map(f => path.basename(f, path.extname(f)));

    const receiptFileIds = new Set(
      allReceipts
        .filter(r => r.fileUrl)
        .map(r => r.fileUrl!.replace(/^\/objects\/uploads\//, ''))
    );

    const orphanedFiles: string[] = [];

    for (const fileId of localFileIds) {
      if (!receiptFileIds.has(fileId)) {
        orphanedFiles.push(fileId);
      }
    }

    if (orphanedFiles.length === 0) {
      console.log("✅ No orphaned files found!");
      return;
    }

    console.log(`Found ${orphanedFiles.length} orphaned files\n`);
    console.log("⚠️  These files will be DELETED:\n");

    orphanedFiles.forEach((fileId, index) => {
      console.log(`   ${index + 1}. ${fileId}`);
    });

    console.log("\n❓ Do you want to delete these files? (This script is for info only)");
    console.log("   To delete, uncomment the deletion code in the script.\n");

    // UNCOMMENT TO ACTUALLY DELETE:
    /*
    let deletedCount = 0;
    for (const fileId of orphanedFiles) {
      const files = await fs.readdir(LOCAL_STORAGE_DIR);
      const matchingFiles = files.filter(f => f.startsWith(fileId));

      for (const file of matchingFiles) {
        const filePath = path.join(LOCAL_STORAGE_DIR, file);
        await fs.unlink(filePath);
        console.log(`   Deleted: ${file}`);
        deletedCount++;
      }
    }

    console.log(`\n✅ Deleted ${deletedCount} files`);
    */

    console.log("📊 Summary:");
    console.log(`   Files in database: ${allReceipts.length}`);
    console.log(`   Files in storage: ${localFileIds.length}`);
    console.log(`   Orphaned files: ${orphanedFiles.length}`);
    console.log(`   Space to recover: ~${(orphanedFiles.length * 1).toFixed(0)}MB (estimated)`);

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// Run the cleaner
cleanOrphanedFiles()
  .then(() => {
    console.log("\n✅ Check complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
