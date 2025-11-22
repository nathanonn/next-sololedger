/**
 * Mock implementation of DocumentStorage for testing
 */

import { vi } from "vitest";
import type { DocumentStorage, SavedDocument } from "@/lib/documents/storage";

/**
 * Create a mock document storage instance for testing
 * Tracks save/get/delete calls and provides deterministic storage keys
 */
export function createMockDocumentStorage(): DocumentStorage {
  let callCount = 0;
  const savedDocuments = new Map<string, Buffer>();

  return {
    save: vi.fn(
      async (
        buffer: Buffer,
        originalFilename: string,
        mimeType: string
      ): Promise<SavedDocument> => {
        callCount++;
        const storageKey = `test-storage-key-${callCount}.${originalFilename.split(".").pop()}`;

        // Store the buffer for potential retrieval
        savedDocuments.set(storageKey, buffer);

        return {
          storageKey,
          mimeType,
          fileSizeBytes: buffer.length,
        };
      }
    ),

    get: vi.fn(async (storageKey: string): Promise<Buffer | null> => {
      return savedDocuments.get(storageKey) || null;
    }),

    delete: vi.fn(async (storageKey: string): Promise<boolean> => {
      const existed = savedDocuments.has(storageKey);
      savedDocuments.delete(storageKey);
      return existed;
    }),
  };
}

/**
 * Reset the mock document storage instance
 * Call this between tests to clear state
 */
export function resetDocumentStorage() {
  // This will be used if we need to reset a global mock instance
  // For now, tests should create new instances per test
}
