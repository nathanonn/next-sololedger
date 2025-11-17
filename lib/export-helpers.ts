/**
 * Export helpers for CSV generation
 * Server-side only (Node runtime)
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Available CSV columns
 * Note: documentIds and documentNames are commented out because the Transaction model
 * does not have a documents relation in the current schema
 */
export const AVAILABLE_CSV_COLUMNS = [
  "id",
  "date",
  "type",
  "status",
  "description",
  "category",
  "account",
  "vendor",
  "client",
  "amountBase",
  "currencyBase",
  "amountSecondary",
  "currencySecondary",
  "exchangeRate",
  "notes",
  // "documentIds",
  // "documentNames",
] as const;

export type CsvColumn = (typeof AVAILABLE_CSV_COLUMNS)[number];

/**
 * Transaction CSV export configuration
 */
export interface TransactionCsvExportConfig {
  organizationId: string;
  from: Date;
  to: Date;
  // Optional filters
  type?: "INCOME" | "EXPENSE";
  status?: "POSTED" | "DRAFT";
  categoryIds?: string[];
  vendorId?: string;
  clientId?: string;
  // Column selection
  columns: CsvColumn[];
}

/**
 * CSV export result
 */
export interface CsvExportResult {
  filename: string;
  csv: string;
}

/**
 * Generate transactions CSV with configurable columns
 */
export async function generateTransactionsCsv(
  config: TransactionCsvExportConfig
): Promise<CsvExportResult> {
  const {
    organizationId,
    from,
    to,
    type,
    status = "POSTED",
    categoryIds,
    vendorId,
    clientId,
    columns,
  } = config;

  // Build where clause
  const where: Prisma.TransactionWhereInput = {
    organizationId,
    deletedAt: null,
    date: {
      gte: from,
      lte: to,
    },
  };

  if (type) {
    where.type = type;
  }

  if (status) {
    where.status = status;
  }

  if (categoryIds && categoryIds.length > 0) {
    where.categoryId = { in: categoryIds };
  }

  if (vendorId) {
    where.vendorId = vendorId;
  }

  if (clientId) {
    where.clientId = clientId;
  }

  // Determine includes based on requested columns
  const includeCategory = columns.includes("category");
  const includeAccount = columns.includes("account");
  const includeVendor = columns.includes("vendor");
  const includeClient = columns.includes("client");

  // Fetch transactions
  const transactions = await db.transaction.findMany({
    where,
    include: {
      category: includeCategory,
      account: includeAccount,
      vendor: includeVendor,
      client: includeClient,
    },
    orderBy: { date: "desc" },
  });

  // Generate CSV
  const csvRows: string[] = [];

  // Header row
  const headers = columns.map((col) => getColumnLabel(col));
  csvRows.push(headers.join(","));

  // Data rows
  for (const transaction of transactions) {
    const row: string[] = [];

    for (const col of columns) {
      row.push(formatCsvValue(col, transaction));
    }

    csvRows.push(row.join(","));
  }

  const csv = csvRows.join("\n");

  // Generate filename
  const fromStr = from.toISOString().split("T")[0];
  const toStr = to.toISOString().split("T")[0];
  const filename = `transactions-${fromStr}-to-${toStr}.csv`;

  return { filename, csv };
}

/**
 * Get column label for CSV header
 */
function getColumnLabel(column: CsvColumn): string {
  const labels: Record<CsvColumn, string> = {
    id: "ID",
    date: "Date",
    type: "Type",
    status: "Status",
    description: "Description",
    category: "Category",
    account: "Account",
    vendor: "Vendor",
    client: "Client",
    amountBase: "Amount (Base)",
    currencyBase: "Currency (Base)",
    amountSecondary: "Amount (Secondary)",
    currencySecondary: "Currency (Secondary)",
    exchangeRate: "Exchange Rate",
    notes: "Notes",
    // documentIds: "Document IDs",
    // documentNames: "Document Names",
  };

  return labels[column];
}

/**
 * Transaction with includes for CSV export
 */
type TransactionWithIncludes = {
  id: string;
  date: Date;
  type: string;
  status: string;
  description: string;
  amountBase: number | { toString: () => string };
  currencyBase: string | null;
  amountSecondary: number | { toString: () => string } | null;
  currencySecondary: string | null;
  notes: string | null;
  vendorName: string | null;
  clientName: string | null;
  category?: { name: string } | null;
  account?: { name: string } | null;
  vendor?: { name: string } | null;
  client?: { name: string } | null;
};

/**
 * Format a CSV value based on column type
 */
function formatCsvValue(column: CsvColumn, transaction: TransactionWithIncludes): string {
  const escapeCsv = (value: string) => {
    if (!value) return "";
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    const escaped = value.replace(/"/g, '""');
    if (escaped.includes(",") || escaped.includes('"') || escaped.includes("\n")) {
      return `"${escaped}"`;
    }
    return escaped;
  };

  switch (column) {
    case "id":
      return transaction.id;

    case "date":
      return transaction.date.toISOString().split("T")[0];

    case "type":
      return transaction.type;

    case "status":
      return transaction.status;

    case "description":
      return escapeCsv(transaction.description);

    case "category":
      return transaction.category ? escapeCsv(transaction.category.name) : "";

    case "account":
      return transaction.account ? escapeCsv(transaction.account.name) : "";

    case "vendor":
      return transaction.vendorName
        ? escapeCsv(transaction.vendorName)
        : transaction.vendor
          ? escapeCsv(transaction.vendor.name)
          : "";

    case "client":
      return transaction.clientName
        ? escapeCsv(transaction.clientName)
        : transaction.client
          ? escapeCsv(transaction.client.name)
          : "";

    case "amountBase":
      return transaction.amountBase.toString();

    case "currencyBase":
      return transaction.currencyBase || "";

    case "amountSecondary":
      return transaction.amountSecondary?.toString() || "";

    case "currencySecondary":
      return transaction.currencySecondary || "";

    case "exchangeRate":
      if (transaction.amountSecondary && Number(transaction.amountSecondary) > 0) {
        const rate =
          Number(transaction.amountBase) / Number(transaction.amountSecondary);
        return rate.toFixed(8);
      }
      return "";

    case "notes":
      return transaction.notes ? escapeCsv(transaction.notes) : "";

    // Document columns are commented out because the Transaction model
    // does not have a documents relation in the current schema
    // case "documentIds":
    //   if (transaction.documents && transaction.documents.length > 0) {
    //     return transaction.documents.map((d) => d.id).join(";");
    //   }
    //   return "";

    // case "documentNames":
    //   if (transaction.documents && transaction.documents.length > 0) {
    //     return transaction.documents.map((d) => d.filename).join(";");
    //   }
    //   return "";

    default:
      return "";
  }
}
