import { Response } from "express";
import { LocalObjectStorageService } from "./localObjectStorage";
import { R2StorageService, shouldUseR2 } from "./r2Storage";

/**
 * Unified storage interface
 * Both LocalObjectStorageService and R2StorageService implement this interface
 */
export interface IStorageService {
  uploadFile(buffer: Buffer, filename: string, contentType: string): Promise<string>;
  getObjectEntityFile(objectPath: string): Promise<any>;
  downloadObject(fileInfo: any, res: Response): Promise<void>;
  deleteObject(objectPath: string): Promise<boolean>;
  moveObject(sourcePath: string, destinationPath: string): Promise<void>;
}

/**
 * Storage factory that automatically selects the appropriate storage provider
 * based on environment configuration
 *
 * Priority:
 * 1. Cloudflare R2 (if R2_* env vars are set)
 * 2. Local storage (fallback for development)
 */
export class StorageFactory {
  private static instance: IStorageService | null = null;

  /**
   * Get the active storage service instance
   * Singleton pattern ensures only one instance is created
   */
  static getStorageService(): IStorageService {
    if (!this.instance) {
      if (shouldUseR2()) {
        console.log("📦 Using Cloudflare R2 Storage");
        this.instance = new R2StorageService();
      } else {
        console.log("📦 Using Local Storage (development mode)");
        this.instance = new LocalObjectStorageService();
      }
    }
    return this.instance;
  }

  /**
   * Get storage provider name for logging/debugging
   */
  static getProviderName(): string {
    return shouldUseR2() ? "R2" : "Local";
  }

  /**
   * Force reset the singleton (useful for testing)
   */
  static reset(): void {
    this.instance = null;
  }
}

/**
 * Convenience function to get the storage service
 * Usage: const storage = getStorage();
 */
export const getStorage = (): IStorageService => {
  return StorageFactory.getStorageService();
};

/**
 * Helper: Normalize object path from various formats to standard /objects/... format
 * Handles URLs, paths with/without /objects/ prefix
 */
export const normalizeObjectEntityPath = (rawPath: string): string => {
  // Already in correct format
  if (rawPath.startsWith("/objects/")) {
    return rawPath;
  }

  // Handle full URLs (from legacy storage systems or presigned URLs)
  if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
    try {
      const url = new URL(rawPath);
      const pathname = url.pathname;

      // Extract /objects/... portion if present
      if (pathname.includes("/objects/")) {
        return pathname.substring(pathname.indexOf("/objects/"));
      }

      // Otherwise use the full pathname
      return pathname.startsWith("/objects/") ? pathname : `/objects${pathname}`;
    } catch {
      // Invalid URL, return as-is
      return rawPath;
    }
  }

  // Add /objects/ prefix if missing
  return rawPath.startsWith("/") ? `/objects${rawPath}` : `/objects/${rawPath}`;
};

/**
 * Helper: Set ACL policy (NO-OP for R2/Local storage)
 * Access control is handled at bucket/route level, not per-file
 */
export const trySetObjectEntityAclPolicy = async (
  rawPath: string,
  aclPolicy: { owner?: string; visibility?: string }
): Promise<string> => {
  // Normalize the path and return it
  // ACL is not needed for R2 (bucket-level permissions) or Local (route-level auth)
  const normalizedPath = normalizeObjectEntityPath(rawPath);
  console.log(`ACL policy ignored for ${normalizedPath} (handled at bucket/route level)`);
  return normalizedPath;
};
