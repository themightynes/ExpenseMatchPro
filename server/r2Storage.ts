import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Response } from "express";
import { randomUUID } from "crypto";

// Cloudflare R2 Storage Service
export class R2StorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    // Validate required environment variables
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error(
        "Missing R2 configuration. Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"
      );
    }

    this.bucketName = bucketName;

    // Initialize S3 client with R2 endpoint
    this.s3Client = new S3Client({
      region: "auto", // R2 uses 'auto' for region
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    console.log(`☁️  Cloudflare R2 initialized: ${bucketName}`);
  }

  /**
   * Upload a file to R2
   * @param buffer File buffer
   * @param filename Original filename
   * @param contentType MIME type
   * @returns Object path in format /objects/uploads/{uuid}
   */
  async uploadFile(buffer: Buffer, filename: string, contentType: string): Promise<string> {
    const fileId = randomUUID();
    const key = `uploads/${fileId}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: {
        originalName: filename,
        uploadedAt: new Date().toISOString(),
      },
    });

    await this.s3Client.send(command);

    console.log(`✅ Uploaded to R2: ${key} (${filename})`);
    return `/objects/${key}`;
  }

  /**
   * Get file information from R2
   * @param objectPath Path in format /objects/uploads/{uuid}
   * @returns File metadata including content type
   */
  async getObjectEntityFile(objectPath: string): Promise<{ key: string; contentType: string; metadata?: Record<string, string> }> {
    // Remove /objects/ prefix to get the R2 key
    let key = objectPath.replace(/^\/objects\//, "");

    // Try to find the file - first try exact match
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const headResponse = await this.s3Client.send(headCommand);

      return {
        key,
        contentType: headResponse.ContentType || "application/octet-stream",
        metadata: headResponse.Metadata,
      };
    } catch (error: any) {
      // If not found and key doesn't have an extension, try common extensions
      if ((error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) && !key.match(/\.\w+$/)) {
        const extensions = [".jpg", ".jpeg", ".png", ".pdf", ".gif", ".webp"];

        for (const ext of extensions) {
          try {
            const keyWithExt = `${key}${ext}`;
            const headCommand = new HeadObjectCommand({
              Bucket: this.bucketName,
              Key: keyWithExt,
            });

            const headResponse = await this.s3Client.send(headCommand);

            // Found it! Return with the correct key
            return {
              key: keyWithExt,
              contentType: headResponse.ContentType || "application/octet-stream",
              metadata: headResponse.Metadata,
            };
          } catch {
            // Try next extension
            continue;
          }
        }
      }

      // Still not found
      if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
        throw new Error("Object not found");
      }
      throw error;
    }
  }

  /**
   * Download file from R2 and stream to response
   * @param fileInfo File information from getObjectEntityFile
   * @param res Express response object
   */
  async downloadObject(fileInfo: { key: string; contentType: string }, res: Response): Promise<void> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileInfo.key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error("Empty response body");
      }

      // Set headers
      res.setHeader("Content-Type", fileInfo.contentType);
      if (response.ContentLength) {
        res.setHeader("Content-Length", response.ContentLength);
      }

      // Stream the response body to Express response
      const stream = response.Body as any;
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading from R2:", error);
      throw error;
    }
  }

  /**
   * Delete file from R2
   * @param objectPath Path in format /objects/uploads/{uuid}
   * @returns true if successful
   */
  async deleteObject(objectPath: string): Promise<boolean> {
    const key = objectPath.replace(/^\/objects\//, "");

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      console.log(`🗑️  Deleted from R2: ${key}`);
      return true;
    } catch (error) {
      console.error("Error deleting from R2:", error);
      return false;
    }
  }

  /**
   * Generate presigned URL for direct upload from frontend
   * @param filename Original filename
   * @param contentType MIME type
   * @param expiresIn Expiration time in seconds (default: 15 minutes)
   * @returns Presigned URL and key
   */
  async getPresignedUploadUrl(
    filename: string,
    contentType: string,
    expiresIn: number = 900
  ): Promise<{ url: string; key: string; objectPath: string }> {
    const fileId = randomUUID();
    const key = `uploads/${fileId}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      Metadata: {
        originalName: filename,
        uploadedAt: new Date().toISOString(),
      },
    });

    const url = await getSignedUrl(this.s3Client, command, {
      expiresIn,
      signableHeaders: new Set(["content-type"]),
    });

    return {
      url,
      key,
      objectPath: `/objects/${key}`,
    };
  }

  /**
   * Generate presigned URL for direct download from frontend
   * @param objectPath Path in format /objects/uploads/{uuid}
   * @param expiresIn Expiration time in seconds (default: 1 hour)
   * @returns Presigned URL
   */
  async getPresignedDownloadUrl(objectPath: string, expiresIn: number = 3600): Promise<string> {
    const key = objectPath.replace(/^\/objects\//, "");

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn });
    return url;
  }
}

/**
 * Check if R2 storage should be used
 * Returns true if all R2 environment variables are set
 */
export const shouldUseR2 = (): boolean => {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
};
