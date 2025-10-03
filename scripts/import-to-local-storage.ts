import { promises as fs } from "fs";
import path from "path";

const BACKUP_DIR = path.join(process.cwd(), "replit-files-backup");
const LOCAL_STORAGE_DIR = path.join(process.cwd(), ".local-storage");

async function importToLocalStorage() {
  console.log("🚀 Importing files to local storage...");
  console.log(`📂 Source: ${BACKUP_DIR}`);
  console.log(`📁 Destination: ${LOCAL_STORAGE_DIR}`);

  try {
    // Check if backup exists
    try {
      await fs.access(BACKUP_DIR);
    } catch {
      console.error(`❌ Backup directory not found: ${BACKUP_DIR}`);
      console.log("\n💡 Tip: Run the download script on Replit first:");
      console.log("   npx tsx scripts/download-replit-files.ts");
      process.exit(1);
    }

    // Create local storage structure
    await fs.mkdir(LOCAL_STORAGE_DIR, { recursive: true });
    await fs.mkdir(path.join(LOCAL_STORAGE_DIR, "uploads"), { recursive: true });

    // Read manifest
    const manifestPath = path.join(BACKUP_DIR, "download-manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));

    console.log(`\n📋 Found ${manifest.totalFiles} files in manifest\n`);

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    // Copy files from backup to local storage
    for (const fileInfo of manifest.files) {
      try {
        // Extract just the file ID from the path
        // .private/uploads/abc123 -> abc123
        const fileId = path.basename(fileInfo.name);
        const sourcePath = path.join(BACKUP_DIR, ".private", "uploads", fileId);
        const destPath = path.join(LOCAL_STORAGE_DIR, "uploads", fileId);

        // Check if source exists
        try {
          await fs.access(sourcePath);
        } catch {
          console.log(`⚠️  Skipping (not found): ${fileId}`);
          skipped++;
          continue;
        }

        // Copy file
        await fs.copyFile(sourcePath, destPath);

        // Copy metadata if exists
        const sourceMetaPath = `${sourcePath}.meta.json`;
        const destMetaPath = `${destPath}.meta.json`;
        try {
          await fs.access(sourceMetaPath);
          await fs.copyFile(sourceMetaPath, destMetaPath);
        } catch {
          // No metadata, that's OK
        }

        imported++;
        console.log(`✅ Imported: ${fileId}`);
      } catch (error: any) {
        console.error(`❌ Failed to import ${fileInfo.name}:`, error.message);
        failed++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log(`📊 Import Summary:`);
    console.log(`   ✅ Successfully imported: ${imported} files`);
    console.log(`   ⚠️  Skipped: ${skipped} files`);
    console.log(`   ❌ Failed: ${failed} files`);
    console.log(`   📁 Files imported to: ${LOCAL_STORAGE_DIR}/uploads/`);
    console.log("=".repeat(60));

    console.log("\n🎉 Import complete!");
    console.log("\n📝 Next steps:");
    console.log("   1. Restart your dev server: npm run dev");
    console.log("   2. Test that images/PDFs display correctly");
    console.log("   3. Verify receipt uploads still work");

  } catch (error: any) {
    console.error("\n❌ Error during import:", error);
    process.exit(1);
  }
}

// Run the import
importToLocalStorage()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
