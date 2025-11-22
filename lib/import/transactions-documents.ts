/**
 * Document Validation for Transaction Imports
 * Server-side only (Node runtime)
 *
 * Handles validation of documents referenced in CSV import rows against ZIP contents
 */

import type { NormalizedImportRow } from "./transactions-csv";
import { normalizeDocumentPath, guessMimeType } from "./zip-transactions";
import { validateDocumentFile } from "@/lib/documents/validation";

// ============================================================================
// Document Validation for ZIP Imports
// ============================================================================

/**
 * Validate import documents for ZIP mode
 *
 * For each valid row with a documentPath:
 * - Checks if the document exists in the ZIP
 * - Validates MIME type is supported
 * - Validates file size is within limits
 * - Marks row as invalid if any check fails
 *
 * Mutates the rows array in-place and returns it for chaining.
 *
 * @param rows - Normalized import rows (will be mutated)
 * @param documentsByPath - Map of normalized paths to document buffers from ZIP
 * @returns The mutated rows array
 */
export function validateImportDocumentsForZip(
  rows: NormalizedImportRow[],
  documentsByPath: Map<string, { buffer: Buffer; originalName: string }>
): NormalizedImportRow[] {
  for (const row of rows) {
    // Skip invalid rows (already failed other validation)
    if (row.status !== "valid") {
      continue;
    }

    // Skip rows without a document path
    const documentPath = row.documentPath;
    if (!documentPath) {
      continue;
    }

    // Normalize the path for lookup
    const normalizedPath = normalizeDocumentPath(documentPath);

    // Check if document exists in ZIP
    const documentEntry = documentsByPath.get(normalizedPath);
    if (!documentEntry) {
      row.errors.push(`Missing document "${documentPath}" in ZIP`);
      row.status = "invalid";
      row.normalized = undefined; // Clear normalized data to prevent partial import
      continue;
    }

    const { buffer, originalName } = documentEntry;

    // Guess MIME type from file extension
    const mimeType = guessMimeType(originalName);
    if (!mimeType) {
      row.errors.push(
        `Unsupported document type for "${originalName}". File must be PDF, PNG, JPG, or TXT`
      );
      row.status = "invalid";
      row.normalized = undefined;
      continue;
    }

    // Validate document file (MIME type and size)
    const validationError = validateDocumentFile({
      mimeType,
      sizeBytes: buffer.length,
    });

    if (validationError) {
      row.errors.push(`Document "${originalName}": ${validationError}`);
      row.status = "invalid";
      row.normalized = undefined;
      continue;
    }

    // All checks passed - document path remains in row.documentPath for commit
  }

  return rows;
}
