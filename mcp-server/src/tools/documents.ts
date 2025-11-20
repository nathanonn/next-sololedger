/**
 * Document Tools for SoloLedger MCP Server
 *
 * Provides document management including:
 * - Upload files (receipts, invoices, statements)
 * - List/search with advanced filtering
 * - Link to transactions
 * - AI data extraction
 * - Download files
 * - Trash management
 */

import { z } from "zod";
import { APIClient } from "../api-client.js";
import {
  DocumentFilterSchema,
  UpdateDocumentSchema,
  DocumentTransactionsSchema,
  AIExtractSchema,
  ArrayStringSchema,
} from "../types.js";
import fs from "fs/promises";
import path from "path";

export function registerDocumentTools(server: any, client: APIClient) {
  const orgSlug = client.getOrgSlug();

  // =========================================================================
  // Upload Documents
  // =========================================================================

  server.tool(
    "documents_upload",
    "Upload one or more document files (receipts, invoices, statements, etc.). Supports PDF, JPEG, PNG, and TXT files up to 10MB each. Returns uploaded document IDs and metadata.",
    {
      filePaths: ArrayStringSchema(z.string(), 1)
        .describe("Array of absolute file paths to upload"),
    },
    async (args: { filePaths: string[] }) => {
      try {
        // Read and prepare files
        const files: Array<{ filename: string; content: Buffer; mimeType: string }> = [];

        for (const filePath of args.filePaths) {
          const content = await fs.readFile(filePath);
          const filename = path.basename(filePath);
          const ext = path.extname(filename).toLowerCase();

          // Determine MIME type
          let mimeType: string;
          if (ext === ".pdf") {
            mimeType = "application/pdf";
          } else if (ext === ".jpg" || ext === ".jpeg") {
            mimeType = "image/jpeg";
          } else if (ext === ".png") {
            mimeType = "image/png";
          } else if (ext === ".txt") {
            mimeType = "text/plain";
          } else {
            throw new Error(`Unsupported file type: ${ext}`);
          }

          files.push({ filename, content, mimeType });
        }

        // Upload files
        const result = await client.uploadFiles(
          `/api/orgs/${orgSlug}/documents`,
          files
        );

        return {
          content: [
            {
              type: "text",
              text: `Uploaded ${files.length} file(s)\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to upload documents: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // =========================================================================
  // List Documents
  // =========================================================================

  server.tool(
    "documents_list",
    "List and search documents with filters and pagination. Supports filtering by date, linked status, vendor/client, amount, file type, uploader, and text search. Returns paginated results with transaction links.",
    {
      page: z.number().int().positive().optional().describe("Page number (default 1)"),
      pageSize: z
        .number()
        .int()
        .positive()
        .max(100)
        .optional()
        .describe("Page size (default 20, max 100)"),
      dateFrom: z
        .string()
        .optional()
        .describe("Filter by documentDate or uploadedAt (ISO format)"),
      dateTo: z.string().optional().describe("Filter to date (ISO format)"),
      linked: z
        .enum(["all", "linked", "unlinked"])
        .optional()
        .describe("Filter by link status (default: all)"),
      vendorId: z.string().optional().describe("Filter by vendor (via linked transactions)"),
      clientId: z.string().optional().describe("Filter by client (via linked transactions)"),
      amountMin: z.string().optional().describe("Min amount (via linked transactions)"),
      amountMax: z.string().optional().describe("Max amount (via linked transactions)"),
      fileType: z
        .enum(["all", "image", "pdf", "text"])
        .optional()
        .describe("Filter by file type (default: all)"),
      uploaderId: z.string().optional().describe("Filter by uploader user ID"),
      q: z
        .string()
        .optional()
        .describe("Search filename, displayName, textContent, vendor/client names"),
    },
    async (args: z.infer<typeof DocumentFilterSchema>) => {
      const result = await client.get(`/api/orgs/${orgSlug}/documents`, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // =========================================================================
  // Get Single Document
  // =========================================================================

  server.tool(
    "documents_get",
    "Get document details with all linked transactions. Returns complete document metadata, uploader info, and full list of linked transactions.",
    {
      documentId: z.string().describe("Document ID"),
    },
    async (args: { documentId: string }) => {
      const result = await client.get(
        `/api/orgs/${orgSlug}/documents/${args.documentId}`
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // =========================================================================
  // Update Document
  // =========================================================================

  server.tool(
    "documents_update",
    "Update document metadata: display name, type, or document date. Does not modify the actual file.",
    {
      documentId: z.string().describe("Document ID to update"),
      displayName: z
        .string()
        .min(1)
        .max(255)
        .optional()
        .describe("Display name (1-255 chars)"),
      type: z
        .enum(["RECEIPT", "INVOICE", "BANK_STATEMENT", "OTHER"])
        .optional()
        .describe("Document type"),
      documentDate: z
        .string()
        .optional()
        .nullable()
        .describe("Document date (ISO format YYYY-MM-DD, or null to clear)"),
    },
    async (args: { documentId: string } & z.infer<typeof UpdateDocumentSchema>) => {
      const { documentId, ...data } = args;
      const result = await client.patch(
        `/api/orgs/${orgSlug}/documents/${documentId}`,
        data
      );
      return {
        content: [
          {
            type: "text",
            text: `Updated document ${documentId}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // Delete Document (Soft)
  // =========================================================================

  server.tool(
    "documents_delete",
    "Soft delete a document (move to trash). Removes all transaction links. The document can be restored later but links won't be restored.",
    {
      documentId: z.string().describe("Document ID to delete"),
    },
    async (args: { documentId: string }) => {
      const result = await client.delete(
        `/api/orgs/${orgSlug}/documents/${args.documentId}`
      );
      return {
        content: [
          {
            type: "text",
            text: `Deleted document ${args.documentId}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // Restore Document
  // =========================================================================

  server.tool(
    "documents_restore",
    "Restore a soft-deleted document from trash. Note: Transaction links are NOT restored, you'll need to re-link manually.",
    {
      documentId: z.string().describe("Document ID to restore"),
    },
    async (args: { documentId: string }) => {
      const result = await client.post(
        `/api/orgs/${orgSlug}/documents/${args.documentId}/restore`
      );
      return {
        content: [
          {
            type: "text",
            text: `Restored document ${args.documentId}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // Hard Delete Document
  // =========================================================================

  server.tool(
    "documents_hard_delete",
    "Permanently delete a soft-deleted document. WARNING: This cannot be undone. Deletes file from storage and database. Document must be in trash first. Requires admin or superadmin role.",
    {
      documentId: z.string().describe("Document ID to permanently delete"),
    },
    async (args: { documentId: string }) => {
      const result = await client.delete(
        `/api/orgs/${orgSlug}/documents/${args.documentId}/hard`
      );
      return {
        content: [
          {
            type: "text",
            text: `Permanently deleted document ${args.documentId}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // Download Document
  // =========================================================================

  server.tool(
    "documents_download",
    "Download a document file. Returns file content as base64-encoded string along with metadata (filename, mimeType).",
    {
      documentId: z.string().describe("Document ID to download"),
      mode: z
        .enum(["attachment", "inline"])
        .optional()
        .describe("Download mode (default: attachment)"),
    },
    async (args: { documentId: string; mode?: string }) => {
      const queryParam = args.mode ? `?mode=${args.mode}` : "";
      const fileBuffer = await client.downloadFile(
        `/api/orgs/${orgSlug}/documents/${args.documentId}/download${queryParam}`
      );

      // Get document metadata
      const doc = await client.get(
        `/api/orgs/${orgSlug}/documents/${args.documentId}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                documentId: args.documentId,
                filename: (doc as any).filename,
                displayName: (doc as any).displayName,
                mimeType: (doc as any).mimeType,
                fileSize: (doc as any).fileSize,
                base64Content: fileBuffer.toString("base64"),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // =========================================================================
  // List Trash
  // =========================================================================

  server.tool(
    "documents_list_trash",
    "List soft-deleted documents in trash. Supports pagination and date range filtering.",
    {
      page: z.number().int().positive().optional().describe("Page number (default 1)"),
      pageSize: z
        .number()
        .int()
        .positive()
        .max(100)
        .optional()
        .describe("Page size (default 20, max 100)"),
      deletedFrom: z.string().optional().describe("Deleted from date (ISO format)"),
      deletedTo: z.string().optional().describe("Deleted to date (ISO format)"),
    },
    async (args: any) => {
      const result = await client.get(
        `/api/orgs/${orgSlug}/documents/trash`,
        args
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // =========================================================================
  // Link Document to Transactions
  // =========================================================================

  server.tool(
    "documents_link_transactions",
    "Link a document to one or more transactions. Returns all currently linked transactions for this document.",
    {
      documentId: z.string().describe("Document ID"),
      transactionIds: ArrayStringSchema(z.string(), 1)
        .describe("Array of transaction IDs to link"),
    },
    async (args: { documentId: string } & z.infer<typeof DocumentTransactionsSchema>) => {
      const { documentId, ...data } = args;
      const result = await client.post(
        `/api/orgs/${orgSlug}/documents/${documentId}/transactions`,
        data
      );
      return {
        content: [
          {
            type: "text",
            text: `Linked document ${documentId} to ${args.transactionIds.length} transaction(s)\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // Unlink Document from Transactions
  // =========================================================================

  server.tool(
    "documents_unlink_transactions",
    "Unlink a document from one or more transactions. Returns remaining linked transactions.",
    {
      documentId: z.string().describe("Document ID"),
      transactionIds: ArrayStringSchema(z.string(), 1)
        .describe("Array of transaction IDs to unlink"),
    },
    async (args: { documentId: string } & z.infer<typeof DocumentTransactionsSchema>) => {
      const { documentId, ...data } = args;
      const result = await client.request(
        `/api/orgs/${orgSlug}/documents/${documentId}/transactions`,
        {
          method: "DELETE",
          body: JSON.stringify(data),
        }
      );
      return {
        content: [
          {
            type: "text",
            text: `Unlinked document ${documentId} from ${args.transactionIds.length} transaction(s)\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // AI Extract Data
  // =========================================================================

  server.tool(
    "documents_ai_extract",
    "Extract data from a document using AI. Optional: specify fields to extract or custom prompt. Creates a new extraction record. Returns extraction ID and status.",
    {
      documentId: z.string().describe("Document ID to extract data from"),
      fields: ArrayStringSchema(z.string())
        .optional()
        .describe("Specific fields to extract (e.g., ['date', 'amount', 'vendor'])"),
      prompt: z.string().optional().describe("Custom extraction prompt"),
    },
    async (args: { documentId: string } & z.infer<typeof AIExtractSchema>) => {
      const { documentId, ...data } = args;
      const result = await client.post(
        `/api/orgs/${orgSlug}/documents/${documentId}/ai/extract`,
        data
      );
      return {
        content: [
          {
            type: "text",
            text: `AI extraction started for document ${documentId}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // List AI Extractions
  // =========================================================================

  server.tool(
    "documents_ai_list_extractions",
    "List all AI extractions for a document. Shows extraction history with status and extracted data.",
    {
      documentId: z.string().describe("Document ID"),
    },
    async (args: { documentId: string }) => {
      const result = await client.get(
        `/api/orgs/${orgSlug}/documents/${args.documentId}/ai/extractions`
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
