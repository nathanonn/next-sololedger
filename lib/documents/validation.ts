/**
 * Document Validation Constants and Helpers
 * Shared by document upload API and CSV/ZIP import features
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Allowed MIME types for document uploads
 * Supports: JPEG, PNG, PDF, and plain text files
 */
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "text/plain",
] as const;

/**
 * Maximum file size for a single document: 10 MB
 */
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Maximum file size in human-readable format
 */
export const MAX_DOCUMENT_FILE_SIZE_DISPLAY = "10 MB";

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a document file based on MIME type and size
 *
 * @param params - Validation parameters
 * @param params.mimeType - MIME type of the file
 * @param params.sizeBytes - File size in bytes
 * @returns null if valid, error message string if invalid
 */
export function validateDocumentFile(params: {
  mimeType: string;
  sizeBytes: number;
}): string | null {
  const { mimeType, sizeBytes } = params;

  // Check if MIME type is allowed
  if (!ALLOWED_MIME_TYPES.includes(mimeType as any)) {
    return `Unsupported file type "${mimeType}". Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`;
  }

  // Check file size
  if (sizeBytes > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    return `File size (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size of ${MAX_DOCUMENT_FILE_SIZE_DISPLAY}`;
  }

  return null;
}

/**
 * Type guard to check if a MIME type is allowed
 */
export function isAllowedMimeType(
  mimeType: string
): mimeType is (typeof ALLOWED_MIME_TYPES)[number] {
  return ALLOWED_MIME_TYPES.includes(
    mimeType as (typeof ALLOWED_MIME_TYPES)[number]
  );
}
