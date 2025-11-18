/**
 * Document Storage Abstraction
 *
 * Pluggable storage interface for document files.
 * Initial implementation uses local disk storage.
 * Can be extended to support S3, Azure Blob, etc. in the future.
 */

import { createReadStream, createWriteStream, promises as fs } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { createId } from '@paralleldrive/cuid2';

// Storage metadata returned after saving a file
export interface StoredDocumentMeta {
  storageKey: string;
  mimeType: string;
  fileSizeBytes: number;
}

// Parameters for saving a document
export interface SaveDocumentParams {
  organizationId: string;
  file: Buffer;
  mimeType: string;
  originalName: string;
}

// Parameters for retrieving a document stream
export interface GetDocumentStreamParams {
  organizationId: string;
  storageKey: string;
}

// Parameters for deleting a document
export interface DeleteDocumentParams {
  organizationId: string;
  storageKey: string;
}

// Storage interface - implementations must provide these methods
export interface DocumentStorage {
  save(params: SaveDocumentParams): Promise<StoredDocumentMeta>;
  getStream(params: GetDocumentStreamParams): Readable;
  delete(params: DeleteDocumentParams): Promise<void>;
}

/**
 * Local Disk Storage Implementation
 *
 * Stores files under: storage/documents/{organizationId}/{yyyy}/{mm}/{documentId.ext}
 */
export class LocalDiskDocumentStorage implements DocumentStorage {
  private baseDir: string;

  constructor(baseDir = 'storage/documents') {
    this.baseDir = baseDir;
  }

  /**
   * Save a document file to local disk
   *
   * @param params - Save parameters including organization ID, file buffer, mime type, and original filename
   * @returns Metadata about the stored document
   */
  async save(params: SaveDocumentParams): Promise<StoredDocumentMeta> {
    const { organizationId, file, mimeType, originalName } = params;

    // Generate storage path with date-based organization
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');

    // Extract file extension from original name
    const ext = path.extname(originalName) || '';

    // Generate unique filename
    const documentId = createId();
    const filename = `${documentId}${ext}`;

    // Construct full directory path
    const dirPath = path.join(this.baseDir, organizationId, year, month);

    // Construct storage key (relative path from base)
    const storageKey = path.join(organizationId, year, month, filename);

    // Construct absolute file path
    const absolutePath = path.join(this.baseDir, storageKey);

    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });

    // Write file to disk
    await fs.writeFile(absolutePath, file);

    // Get file size
    const stats = await fs.stat(absolutePath);

    return {
      storageKey,
      mimeType,
      fileSizeBytes: stats.size,
    };
  }

  /**
   * Get a readable stream for a stored document
   *
   * @param params - Get parameters including organization ID and storage key
   * @returns Readable stream of the file
   */
  getStream(params: GetDocumentStreamParams): Readable {
    const { storageKey } = params;
    const absolutePath = path.join(this.baseDir, storageKey);

    // Return a read stream for the file
    return createReadStream(absolutePath);
  }

  /**
   * Delete a document file from local disk
   *
   * @param params - Delete parameters including organization ID and storage key
   */
  async delete(params: DeleteDocumentParams): Promise<void> {
    const { storageKey } = params;
    const absolutePath = path.join(this.baseDir, storageKey);

    try {
      await fs.unlink(absolutePath);
    } catch (error) {
      // If file doesn't exist, ignore the error (already deleted)
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

// Singleton instance
let storageInstance: DocumentStorage | null = null;

/**
 * Get the document storage instance (singleton)
 *
 * @returns DocumentStorage implementation
 */
export function getDocumentStorage(): DocumentStorage {
  if (!storageInstance) {
    storageInstance = new LocalDiskDocumentStorage();
  }
  return storageInstance;
}
