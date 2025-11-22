/**
 * Document Storage Abstraction
 * Server-side only (Node runtime)
 *
 * Handles physical storage of document files
 * Currently uses local filesystem, can be extended to S3/cloud storage
 */

import { createId } from "@paralleldrive/cuid2";
import * as fs from "fs/promises";
import * as path from "path";

// ============================================================================
// Configuration
// ============================================================================

// Base storage directory (relative to project root)
const STORAGE_BASE_DIR =
  process.env.DOCUMENT_STORAGE_PATH || "./storage/documents";

// ============================================================================
// Types
// ============================================================================

export interface SavedDocument {
  storageKey: string;
  mimeType: string;
  fileSizeBytes: number;
}

// ============================================================================
// Storage Interface
// ============================================================================

export interface DocumentStorage {
  save(
    buffer: Buffer,
    originalFilename: string,
    mimeType: string
  ): Promise<SavedDocument>;
  get(storageKey: string): Promise<Buffer | null>;
  delete(storageKey: string): Promise<boolean>;
}

// ============================================================================
// Local Filesystem Storage Implementation
// ============================================================================

class LocalFileSystemStorage implements DocumentStorage {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.access(this.baseDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(this.baseDir, { recursive: true });
    }
  }

  /**
   * Generate a unique storage key for a document
   */
  private generateStorageKey(originalFilename: string): string {
    const id = createId();
    const ext = path.extname(originalFilename);
    return `${id}${ext}`;
  }

  /**
   * Save a document buffer to storage
   */
  async save(
    buffer: Buffer,
    originalFilename: string,
    mimeType: string
  ): Promise<SavedDocument> {
    await this.ensureStorageDir();

    const storageKey = this.generateStorageKey(originalFilename);
    const filePath = path.join(this.baseDir, storageKey);

    await fs.writeFile(filePath, buffer);

    return {
      storageKey,
      mimeType,
      fileSizeBytes: buffer.length,
    };
  }

  /**
   * Retrieve a document buffer from storage
   */
  async get(storageKey: string): Promise<Buffer | null> {
    try {
      const filePath = path.join(this.baseDir, storageKey);
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  /**
   * Delete a document from storage
   */
  async delete(storageKey: string): Promise<boolean> {
    try {
      const filePath = path.join(this.baseDir, storageKey);
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let storageInstance: DocumentStorage | null = null;

/**
 * Get the document storage instance
 */
export function getDocumentStorage(): DocumentStorage {
  if (!storageInstance) {
    storageInstance = new LocalFileSystemStorage(STORAGE_BASE_DIR);
  }
  return storageInstance;
}
