import { Storage } from "@google-cloud/storage";
import { promises as fs } from "fs";
import path from "path";
import { db } from "../server/db";
import { receipts } from "@shared/schema";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// Initialize Replit storage client
const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

const BUCKET_NAME = process.env.DEFAULT_OBJECT_STORAGE || "";
const OUTPUT_DIR = path.join(process.cwd(), "replit-files-backup");

async function downloadAllFiles() {
  console.log("🚀 Starting Replit files download...");
  console.log(`📦 Bucket: ${BUCKET_NAME}`);
  console.log(`💾 Output directory: ${OUTPUT_DIR}`);

  try {
    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.mkdir(path.join(OUTPUT_DIR, ".private", "uploads"), { recursive: true });

    const bucket = storage.bucket(BUCKET_NAME);

    // List all files
    console.log("\n📋 Listing files...");
    const [files] = await bucket.getFiles({ prefix: ".private/uploads/" });

    console.log(`\n✅ Found ${files.length} files\n`);

    let downloaded = 0;
    let failed = 0;

    // Download each file
    for (const file of files) {
      try {
        const fileName = file.name;
        const localPath = path.join(OUTPUT_DIR, fileName);

        // Create directory if needed
        const dir = path.dirname(localPath);
        await fs.mkdir(dir, { recursive: true });

        // Download file
        console.log(`⬇️  Downloading: ${fileName}`);
        await file.download({ destination: localPath });

        // Get file metadata
        const [metadata] = await file.getMetadata();
        const metadataPath = `${localPath}.meta.json`;
        await fs.writeFile(metadataPath, JSON.stringify({
          originalName: metadata.name,
          contentType: metadata.contentType || "application/octet-stream",
          size: metadata.size,
          created: metadata.timeCreated,
          updated: metadata.updated
        }, null, 2));

        downloaded++;
        console.log(`   ✓ Saved to: ${localPath}`);
      } catch (error: any) {
        console.error(`   ✗ Failed to download ${file.name}:`, error.message);
        failed++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log(`📊 Download Summary:`);
    console.log(`   ✅ Successfully downloaded: ${downloaded} files`);
    console.log(`   ❌ Failed: ${failed} files`);
    console.log(`   📁 Files saved to: ${OUTPUT_DIR}`);
    console.log("=".repeat(60));

    // Create a manifest file
    const manifest = {
      downloadedAt: new Date().toISOString(),
      bucket: BUCKET_NAME,
      totalFiles: files.length,
      successfulDownloads: downloaded,
      failedDownloads: failed,
      files: files.map(f => ({
        name: f.name,
        cloudPath: `gs://${BUCKET_NAME}/${f.name}`,
        localPath: path.join(OUTPUT_DIR, f.name)
      }))
    };

    await fs.writeFile(
      path.join(OUTPUT_DIR, "download-manifest.json"),
      JSON.stringify(manifest, null, 2)
    );

    console.log("\n✅ Manifest saved to: download-manifest.json");

    // Get receipt records to map files to database entries
    console.log("\n📋 Fetching receipt records from database...");
    const allReceipts = await db.select().from(receipts);

    const receiptFileMap = allReceipts.map(receipt => ({
      id: receipt.id,
      fileName: receipt.fileName,
      originalFileName: receipt.originalFileName,
      fileUrl: receipt.fileUrl,
      merchant: receipt.merchant,
      amount: receipt.amount,
      date: receipt.date
    }));

    await fs.writeFile(
      path.join(OUTPUT_DIR, "receipt-file-mapping.json"),
      JSON.stringify(receiptFileMap, null, 2)
    );

    console.log(`✅ Receipt mapping saved (${receiptFileMap.length} receipts)`);

  } catch (error: any) {
    console.error("\n❌ Error during download:", error);
    process.exit(1);
  }
}

// Run the download
downloadAllFiles()
  .then(() => {
    console.log("\n🎉 Download complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
