/**
 * This file only exports ObjectNotFoundError for backwards compatibility
 *
 * For actual storage operations, use:
 * - storageFactory.ts (auto-selects R2/Local storage)
 * - r2Storage.ts (Cloudflare R2 for production)
 * - localObjectStorage.ts (Local filesystem for development)
 */

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}
