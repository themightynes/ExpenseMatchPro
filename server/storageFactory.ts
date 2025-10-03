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
