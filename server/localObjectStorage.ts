import { Response } from "express";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// Local file storage for development
const LOCAL_STORAGE_DIR = path.join(process.cwd(), ".local-storage");

export class LocalObjectStorageService {
  constructor() {
    this.ensureStorageDir();
  }

  private async ensureStorageDir() {
    try {
      await fs.mkdir(LOCAL_STORAGE_DIR, { recursive: true });
      await fs.mkdir(path.join(LOCAL_STORAGE_DIR, "uploads"), { recursive: true });
      console.log("📁 Local storage initialized:", LOCAL_STORAGE_DIR);
    } catch (error) {
      console.error("Error creating local storage directory:", error);
    }
  }

  async uploadFile(buffer: Buffer, filename: string, contentType: string): Promise<string> {
    const fileId = randomUUID();
    const filePath = path.join(LOCAL_STORAGE_DIR, "uploads", fileId);

    await fs.writeFile(filePath, buffer);

    // Store metadata
    const metadataPath = `${filePath}.meta.json`;
    await fs.writeFile(metadataPath, JSON.stringify({
      originalName: filename,
      contentType,
      uploadedAt: new Date().toISOString()
    }));

    console.log(`✅ Uploaded file locally: ${fileId} (${filename})`);
    return `/objects/uploads/${fileId}`;
  }

  async getObjectEntityFile(objectPath: string): Promise<{ path: string; contentType: string }> {
    // Remove /objects/ prefix
    const cleanPath = objectPath.replace(/^\/objects\//, "");
    let filePath = path.join(LOCAL_STORAGE_DIR, cleanPath);

    // Check if file exists as-is
    try {
      await fs.access(filePath);
    } catch {
      // File not found without extension, try to find it with common extensions
      const extensions = [".jpg", ".jpeg", ".png", ".pdf", ".gif", ".webp"];
      let found = false;

      for (const ext of extensions) {
        try {
          const pathWithExt = `${filePath}${ext}`;
          await fs.access(pathWithExt);
          filePath = pathWithExt;
          found = true;
          break;
        } catch {
          // Try next extension
        }
      }

      if (!found) {
        throw new Error("Object not found");
      }
    }

    // Try to get metadata
    let contentType = "application/octet-stream";
    try {
      const metadataPath = `${filePath}.meta.json`;
      const metadata = JSON.parse(await fs.readFile(metadataPath, "utf-8"));
      contentType = metadata.contentType || contentType;
    } catch {
      // No metadata, guess from extension
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
      };
      contentType = mimeTypes[ext] || contentType;
    }

    return { path: filePath, contentType };
  }

  async downloadObject(fileInfo: { path: string; contentType: string }, res: Response) {
    try {
      const buffer = await fs.readFile(fileInfo.path);
      res.setHeader("Content-Type", fileInfo.contentType);
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
    } catch (error) {
      console.error("Error downloading object:", error);
      throw error;
    }
  }

  async deleteObject(objectPath: string): Promise<boolean> {
    const cleanPath = objectPath.replace(/^\/objects\//, "");
    const filePath = path.join(LOCAL_STORAGE_DIR, cleanPath);

    try {
      await fs.unlink(filePath);
      // Try to delete metadata
      try {
        await fs.unlink(`${filePath}.meta.json`);
      } catch {}
      return true;
    } catch {
      return false;
    }
  }
}

// Check if we're running on localhost
export const isLocalDevelopment = () => {
  return !process.env.REPL_ID && !process.env.REPLIT_DB_URL;
};
