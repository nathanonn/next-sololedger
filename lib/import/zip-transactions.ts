/**
 * ZIP Import Helpers for Transactions
 * Server-side only (Node runtime)
 *
 * Handles:
 * - ZIP file parsing and extraction
 * - Document path normalization
 * - MIME type detection from file extensions
 */

import AdmZip from "adm-zip";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ParsedZipDocuments {
  transactionsCsv: Buffer;
  documentsByPath: Map<
    string,
    {
      buffer: Buffer;
      originalName: string;
    }
  >;
}

// ============================================================================
// Path Normalization
// ============================================================================

/**
 * Normalize a document path for consistent lookup
 * - Trims whitespace
 * - Replaces backslashes with forward slashes
 * - Strips leading ./ or /
 * - Collapses duplicate slashes
 */
export function normalizeDocumentPath(raw: string): string {
  if (!raw) return "";

  let normalized = raw.trim();

  // Replace backslashes with forward slashes
  normalized = normalized.replace(/\\/g, "/");

  // Strip leading ./ or /
  normalized = normalized.replace(/^\.?\/+/, "");

  // Collapse duplicate slashes
  normalized = normalized.replace(/\/+/g, "/");

  return normalized;
}

// ============================================================================
// MIME Type Detection
// ============================================================================

/**
 * Guess MIME type from file extension
 * Returns null for unsupported file types
 */
export function guessMimeType(originalName: string): string | null {
  if (!originalName) return null;

  const extension = originalName.toLowerCase().split(".").pop();

  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "txt":
      return "text/plain";
    default:
      return null;
  }
}

// ============================================================================
// ZIP Parsing
// ============================================================================

/**
 * Parse a ZIP file containing transactions.csv and optional document files
 *
 * Expected structure:
 * - /transactions.csv (required, can be at root or in subdirectory)
 * - /path/to/document.pdf (optional, any structure)
 *
 * @param buffer - ZIP file buffer
 * @returns Parsed CSV buffer and map of documents by normalized path
 * @throws Error if transactions.csv is not found
 */
export async function parseTransactionsZip(
  buffer: Buffer
): Promise<ParsedZipDocuments> {
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    let transactionsCsv: Buffer | null = null;
    const documentsByPath = new Map<
      string,
      { buffer: Buffer; originalName: string }
    >();

    for (const entry of entries) {
      // Skip directories
      if (entry.isDirectory) {
        continue;
      }

      const entryName = entry.entryName;

      // Check if this is transactions.csv
      // Accept: transactions.csv, ./transactions.csv, or any path ending with /transactions.csv
      if (
        entryName === "transactions.csv" ||
        entryName === "./transactions.csv" ||
        entryName.endsWith("/transactions.csv")
      ) {
        if (!transactionsCsv) {
          // First match wins
          transactionsCsv = entry.getData();
        }
        continue;
      }

      // This is a potential document file
      const normalizedPath = normalizeDocumentPath(entryName);

      // Skip if path is empty after normalization (shouldn't happen for valid entries)
      if (!normalizedPath) {
        continue;
      }

      // Read the file contents
      const fileBuffer = entry.getData();

      // Store in the map
      documentsByPath.set(normalizedPath, {
        buffer: fileBuffer,
        originalName: entryName.split("/").pop() || entryName,
      });
    }

    // Validate that transactions.csv was found
    if (!transactionsCsv) {
      throw new Error("transactions.csv not found in ZIP");
    }

    return {
      transactionsCsv,
      documentsByPath,
    };
  } catch (error) {
    if (error instanceof Error) {
      // Re-throw known errors (like missing transactions.csv)
      if (error.message.includes("transactions.csv not found")) {
        throw error;
      }
      // Wrap other errors with more context
      throw new Error(`Failed to parse ZIP file: ${error.message}`);
    }
    throw new Error("Failed to parse ZIP file: Unknown error");
  }
}
