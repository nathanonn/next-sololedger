/**
 * Transaction Tools for SoloLedger MCP Server
 *
 * Provides comprehensive transaction management including:
 * - List with advanced filtering
 * - Create/update/delete operations
 * - Bulk operations
 * - Trash management
 * - CSV exports
 * - Document linking
 */

import { z } from "zod";
import { APIClient } from "../api-client.js";
import {
  TransactionFilterSchema,
  CreateTransactionSchema,
  UpdateTransactionSchema,
  BulkTransactionActionSchema,
  TransactionDocumentsSchema,
  ExportRangeSchema,
} from "../types.js";

export function registerTransactionTools(server: any, client: APIClient) {
  const orgSlug = client.getOrgSlug();

  // =========================================================================
  // List Transactions
  // =========================================================================

  server.tool(
    "transactions_list",
    "List transactions with optional filters (type, status, date range, client/vendor, category, amount). Returns all matching transactions with full details including category, account, vendor/client info.",
    {
      type: TransactionFilterSchema.optional(),
      status: z.string().optional().describe("DRAFT or POSTED"),
      dateFrom: z.string().optional().describe("ISO date (YYYY-MM-DD)"),
      dateTo: z.string().optional().describe("ISO date (YYYY-MM-DD)"),
      clientId: z.string().optional().describe("Filter by client ID"),
      vendorId: z.string().optional().describe("Filter by vendor ID"),
      categoryIds: z
        .string()
        .optional()
        .describe("Comma-separated category IDs"),
      amountMin: z.string().optional().describe("Minimum amount"),
      amountMax: z.string().optional().describe("Maximum amount"),
      currency: z
        .string()
        .optional()
        .describe("BASE or 3-char currency code"),
    },
    async (args: z.infer<typeof TransactionFilterSchema>) => {
      const result = await client.get(`/api/orgs/${orgSlug}/transactions`, args);
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
  // Get Single Transaction
  // =========================================================================

  server.tool(
    "transactions_get",
    "Get details of a single transaction by ID. Returns full transaction details including all linked documents and relationships.",
    {
      transactionId: z.string().describe("Transaction ID"),
    },
    async (args: { transactionId: string }) => {
      const result = await client.get(
        `/api/orgs/${orgSlug}/transactions/${args.transactionId}`
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
  // Create Transaction
  // =========================================================================

  server.tool(
    "transactions_create",
    "Create a new income or expense transaction. Supports dual-currency (base + secondary), auto-creates vendors/clients if name provided without ID. INCOME can only have clients, EXPENSE can only have vendors. POSTED status cannot have future dates.",
    {
      type: z.enum(["INCOME", "EXPENSE"]).describe("Transaction type"),
      status: z.enum(["DRAFT", "POSTED"]).describe("Transaction status"),
      amountBase: z.number().positive().describe("Amount in base currency"),
      amountSecondary: z
        .number()
        .positive()
        .optional()
        .describe("Amount in secondary currency (must pair with currencySecondary)"),
      currencySecondary: z
        .string()
        .length(3)
        .optional()
        .describe("3-char currency code (must pair with amountSecondary)"),
      date: z.string().describe("Transaction date (ISO format YYYY-MM-DD)"),
      description: z.string().min(1).describe("Transaction description"),
      categoryId: z.string().describe("Category ID (type must match transaction type)"),
      accountId: z.string().describe("Account ID"),
      vendorId: z.string().optional().describe("Vendor ID (EXPENSE only)"),
      vendorName: z
        .string()
        .optional()
        .describe("Vendor name (EXPENSE only, auto-creates if not exists)"),
      clientId: z.string().optional().describe("Client ID (INCOME only)"),
      clientName: z
        .string()
        .optional()
        .describe("Client name (INCOME only, auto-creates if not exists)"),
      notes: z.string().optional().describe("Additional notes"),
    },
    async (args: z.infer<typeof CreateTransactionSchema>) => {
      const result = await client.post(
        `/api/orgs/${orgSlug}/transactions`,
        args
      );
      return {
        content: [
          {
            type: "text",
            text: `Created ${args.type.toLowerCase()} transaction: ${args.description} ($${args.amountBase})\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // Update Transaction
  // =========================================================================

  server.tool(
    "transactions_update",
    "Update a transaction. All fields are optional. Set allowSoftClosedOverride=true to edit POSTED transactions in soft-closed periods. Cannot change type if client/vendor already set.",
    {
      transactionId: z.string().describe("Transaction ID to update"),
      type: z.enum(["INCOME", "EXPENSE"]).optional().describe("Transaction type"),
      status: z.enum(["DRAFT", "POSTED"]).optional().describe("Transaction status"),
      amountBase: z.number().positive().optional().describe("Amount in base currency"),
      amountSecondary: z
        .number()
        .positive()
        .optional()
        .describe("Amount in secondary currency"),
      currencySecondary: z
        .string()
        .length(3)
        .optional()
        .describe("3-char currency code"),
      date: z.string().optional().describe("Transaction date (ISO format)"),
      description: z.string().min(1).optional().describe("Transaction description"),
      categoryId: z.string().optional().describe("Category ID"),
      accountId: z.string().optional().describe("Account ID"),
      vendorId: z.string().optional().describe("Vendor ID (EXPENSE only)"),
      vendorName: z.string().optional().describe("Vendor name (EXPENSE only)"),
      clientId: z.string().optional().describe("Client ID (INCOME only)"),
      clientName: z.string().optional().describe("Client name (INCOME only)"),
      notes: z.string().optional().describe("Additional notes"),
      allowSoftClosedOverride: z
        .boolean()
        .optional()
        .describe("Allow editing POSTED transactions in soft-closed period"),
    },
    async (args: { transactionId: string } & z.infer<typeof UpdateTransactionSchema>) => {
      const { transactionId, ...data } = args;
      const result = await client.patch(
        `/api/orgs/${orgSlug}/transactions/${transactionId}`,
        data
      );
      return {
        content: [
          {
            type: "text",
            text: `Updated transaction ${transactionId}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // Delete Transaction (Soft)
  // =========================================================================

  server.tool(
    "transactions_delete",
    "Soft delete a transaction (move to trash). The transaction can be restored later using transactions_restore.",
    {
      transactionId: z.string().describe("Transaction ID to delete"),
    },
    async (args: { transactionId: string }) => {
      const result = await client.delete(
        `/api/orgs/${orgSlug}/transactions/${args.transactionId}`
      );
      return {
        content: [
          {
            type: "text",
            text: `Deleted transaction ${args.transactionId}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // Restore Transaction
  // =========================================================================

  server.tool(
    "transactions_restore",
    "Restore a soft-deleted transaction from trash.",
    {
      transactionId: z.string().describe("Transaction ID to restore"),
    },
    async (args: { transactionId: string }) => {
      const result = await client.post(
        `/api/orgs/${orgSlug}/transactions/${args.transactionId}/restore`
      );
      return {
        content: [
          {
            type: "text",
            text: `Restored transaction ${args.transactionId}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // Hard Delete Transaction
  // =========================================================================

  server.tool(
    "transactions_hard_delete",
    "Permanently delete a soft-deleted transaction. WARNING: This cannot be undone. Transaction must be in trash first (soft-deleted).",
    {
      transactionId: z.string().describe("Transaction ID to permanently delete"),
    },
    async (args: { transactionId: string }) => {
      const result = await client.delete(
        `/api/orgs/${orgSlug}/transactions/${args.transactionId}/hard-delete`
      );
      return {
        content: [
          {
            type: "text",
            text: `Permanently deleted transaction ${args.transactionId}`,
          },
        ],
        isError: false,
      };
    }
  );

  // =========================================================================
  // Bulk Update Transactions
  // =========================================================================

  server.tool(
    "transactions_bulk_update",
    "Perform bulk operations on multiple transactions: change category, change status, or delete. Returns success/failure count with details of any failures.",
    {
      transactionIds: z.array(z.string()).min(1).describe("Array of transaction IDs"),
      action: z
        .enum(["changeCategory", "changeStatus", "delete"])
        .describe("Action to perform"),
      categoryId: z
        .string()
        .optional()
        .describe("Category ID (required for changeCategory action)"),
      status: z
        .enum(["DRAFT", "POSTED"])
        .optional()
        .describe("Status (required for changeStatus action)"),
      allowSoftClosedOverride: z
        .boolean()
        .optional()
        .describe("Allow editing POSTED transactions in soft-closed period"),
    },
    async (args: z.infer<typeof BulkTransactionActionSchema>) => {
      const result = await client.post(
        `/api/orgs/${orgSlug}/transactions/bulk`,
        args
      );
      return {
        content: [
          {
            type: "text",
            text: `Bulk ${args.action}: ${(result as any).successCount} succeeded, ${(result as any).failureCount} failed\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // List Trash
  // =========================================================================

  server.tool(
    "transactions_list_trash",
    "List soft-deleted transactions in trash. Optional filters: type, deletedFrom/To dates, search query.",
    {
      type: z.enum(["INCOME", "EXPENSE"]).optional().describe("Transaction type"),
      deletedFrom: z.string().optional().describe("Deleted from date (ISO format)"),
      deletedTo: z.string().optional().describe("Deleted to date (ISO format)"),
      search: z
        .string()
        .optional()
        .describe("Search in description, vendor/client name"),
    },
    async (args: any) => {
      const result = await client.get(
        `/api/orgs/${orgSlug}/transactions/trash`,
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
  // Export Transactions CSV
  // =========================================================================

  server.tool(
    "transactions_export_csv",
    "Export selected transactions to CSV format. Returns CSV data as text with headers: ID, Date, Type, Status, Description, Category, Account, Vendor, Client, Amount (Base), Currency (Base), Amount (Secondary), Currency (Secondary), Exchange Rate, Notes.",
    {
      ids: z.string().describe("Comma-separated transaction IDs"),
    },
    async (args: { ids: string }) => {
      const csvData = await client.get(
        `/api/orgs/${orgSlug}/transactions/export?ids=${args.ids}`
      );
      return {
        content: [
          {
            type: "text",
            text: `CSV Export (${args.ids.split(",").length} transactions):\n\n${csvData}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // Export Range CSV
  // =========================================================================

  server.tool(
    "transactions_export_range_csv",
    "Export transactions by date range to CSV format. Optional filters: type, status. Returns CSV data with same headers as export endpoint.",
    {
      dateFrom: z.string().describe("Start date (ISO format YYYY-MM-DD)"),
      dateTo: z.string().describe("End date (ISO format YYYY-MM-DD)"),
      type: z.enum(["INCOME", "EXPENSE"]).optional().describe("Transaction type filter"),
      status: z.enum(["DRAFT", "POSTED"]).optional().describe("Status filter"),
    },
    async (args: z.infer<typeof ExportRangeSchema>) => {
      // Map MCP parameter names to API endpoint parameter names for compatibility
      const apiParams = {
        from: args.dateFrom,
        to: args.dateTo,
        type: args.type,
        status: args.status,
      };

      const csvData = await client.post(
        `/api/orgs/${orgSlug}/transactions/export-range`,
        apiParams
      );
      return {
        content: [
          {
            type: "text",
            text: `CSV Export (${args.dateFrom} to ${args.dateTo}):\n\n${csvData}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // Link Documents to Transaction
  // =========================================================================

  server.tool(
    "transactions_link_documents",
    "Link one or more documents to a transaction. Documents must exist and belong to the organization. Returns updated list of linked documents.",
    {
      transactionId: z.string().describe("Transaction ID"),
      documentIds: z.array(z.string()).min(1).describe("Array of document IDs to link"),
    },
    async (args: { transactionId: string } & z.infer<typeof TransactionDocumentsSchema>) => {
      const { transactionId, ...data } = args;
      const result = await client.post(
        `/api/orgs/${orgSlug}/transactions/${transactionId}/documents`,
        data
      );
      return {
        content: [
          {
            type: "text",
            text: `Linked ${args.documentIds.length} document(s) to transaction ${transactionId}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // Unlink Documents from Transaction
  // =========================================================================

  server.tool(
    "transactions_unlink_documents",
    "Unlink one or more documents from a transaction. Returns remaining linked documents.",
    {
      transactionId: z.string().describe("Transaction ID"),
      documentIds: z.array(z.string()).min(1).describe("Array of document IDs to unlink"),
    },
    async (args: { transactionId: string } & z.infer<typeof TransactionDocumentsSchema>) => {
      const { transactionId, ...data } = args;
      const result = await client.request(
        `/api/orgs/${orgSlug}/transactions/${transactionId}/documents`,
        {
          method: "DELETE",
          body: JSON.stringify(data),
        }
      );
      return {
        content: [
          {
            type: "text",
            text: `Unlinked ${args.documentIds.length} document(s) from transaction ${transactionId}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );
}
