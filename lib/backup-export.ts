/**
 * Full Data Export & Backup
 * Server-side only (Node runtime)
 *
 * Handles:
 * - JSON export of full organization data
 * - CSV/ZIP export with multiple entity files
 * - Document reference inclusion (optional)
 * - Date range filtering for transactions
 */

import { db } from "@/lib/db";
import { stringify } from "csv-stringify/sync";
import archiver from "archiver";
import { Readable } from "stream";

// ============================================================================
// Types & Interfaces
// ============================================================================

export type BackupFormat = "json" | "csv";

export interface BackupExportOptions {
  format: BackupFormat;
  includeDocumentReferences: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface BackupExportResult {
  filename: string;
  contentType: string;
  buffer: Buffer;
}

/**
 * JSON backup structure
 */
export interface JsonBackupData {
  exportDate: string;
  organizationSlug: string;
  organizationName: string;
  settings: unknown;
  accounts: unknown[];
  categories: unknown[];
  vendors: unknown[];
  clients: unknown[];
  tags: unknown[];
  transactions: unknown[];
  transactionTags: unknown[];
  transactionDocuments?: unknown[];
  documents?: unknown[];
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Export full organization data as JSON or CSV ZIP
 */
export async function exportOrganizationBackup(
  organizationId: string,
  orgSlug: string,
  orgName: string,
  options: BackupExportOptions
): Promise<BackupExportResult> {
  // Fetch all organization data
  const data = await fetchOrganizationData(organizationId, options);

  if (options.format === "json") {
    return exportAsJson(orgSlug, orgName, data);
  } else {
    return exportAsCsvZip(orgSlug, orgName, data);
  }
}

// ============================================================================
// Data Fetching
// ============================================================================

/**
 * Fetch all organization data for backup
 */
async function fetchOrganizationData(
  organizationId: string,
  options: BackupExportOptions
) {
  const { includeDocumentReferences, dateFrom, dateTo } = options;

  // Fetch settings
  const settings = await db.organizationSettings.findUnique({
    where: { organizationId },
  });

  // Fetch master data
  const [accounts, categories, vendors, clients, tags] = await Promise.all([
    db.account.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    db.category.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    db.vendor.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    db.client.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    db.tag.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
  ]);

  // Build transaction filter
  const transactionWhere: {
    organizationId: string;
    deletedAt: null;
    date?: { gte?: Date; lte?: Date };
  } = {
    organizationId,
    deletedAt: null,
  };

  if (dateFrom || dateTo) {
    transactionWhere.date = {};
    if (dateFrom) transactionWhere.date.gte = dateFrom;
    if (dateTo) transactionWhere.date.lte = dateTo;
  }

  // Fetch transactions with related data
  const transactions = await db.transaction.findMany({
    where: transactionWhere,
    include: {
      account: { select: { name: true } },
      category: { select: { name: true } },
      vendor: { select: { name: true } },
      client: { select: { name: true } },
      transactionTags: {
        include: {
          tag: { select: { name: true } },
        },
      },
      documents: includeDocumentReferences
        ? {
            include: {
              document: {
                select: {
                  id: true,
                  displayName: true,
                  filenameOriginal: true,
                  storageKey: true,
                  mimeType: true,
                  fileSizeBytes: true,
                  type: true,
                  documentDate: true,
                  uploadedAt: true,
                },
              },
            },
          }
        : false,
    },
    orderBy: { date: "desc" },
  });

  // Extract transaction IDs for joins
  const transactionIds = transactions.map((t) => t.id);

  // Fetch transaction tags join table
  const transactionTags = await db.transactionTag.findMany({
    where: { transactionId: { in: transactionIds } },
  });

  // Fetch documents if requested
  let documents: unknown[] = [];
  let transactionDocuments: unknown[] = [];

  if (includeDocumentReferences && transactionIds.length > 0) {
    transactionDocuments = await db.transactionDocument.findMany({
      where: { transactionId: { in: transactionIds } },
    });

    // Get unique document IDs
    const documentIds = Array.from(
      new Set(
        transactions.flatMap((t) =>
          t.documents ? t.documents.map((d) => d.documentId) : []
        )
      )
    );

    if (documentIds.length > 0) {
      documents = await db.document.findMany({
        where: {
          id: { in: documentIds as string[] },
          organizationId,
        },
        select: {
          id: true,
          storageKey: true,
          filenameOriginal: true,
          displayName: true,
          mimeType: true,
          fileSizeBytes: true,
          type: true,
          documentDate: true,
          uploadedAt: true,
          deletedAt: true,
        },
      });
    }
  }

  return {
    settings,
    accounts,
    categories,
    vendors,
    clients,
    tags,
    transactions,
    transactionTags,
    transactionDocuments: includeDocumentReferences ? transactionDocuments : [],
    documents: includeDocumentReferences ? documents : [],
  };
}

// ============================================================================
// JSON Export
// ============================================================================

/**
 * Export data as JSON
 */
function exportAsJson(
  orgSlug: string,
  orgName: string,
  data: Awaited<ReturnType<typeof fetchOrganizationData>>
): BackupExportResult {
  const exportData: JsonBackupData = {
    exportDate: new Date().toISOString(),
    organizationSlug: orgSlug,
    organizationName: orgName,
    settings: data.settings,
    accounts: data.accounts,
    categories: data.categories,
    vendors: data.vendors,
    clients: data.clients,
    tags: data.tags,
    transactions: data.transactions,
    transactionTags: data.transactionTags,
  };

  if (data.transactionDocuments.length > 0) {
    exportData.transactionDocuments = data.transactionDocuments;
  }

  if (data.documents.length > 0) {
    exportData.documents = data.documents;
  }

  const jsonString = JSON.stringify(exportData, null, 2);
  const buffer = Buffer.from(jsonString, "utf-8");

  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `sololedger-backup-${orgSlug}-${dateStr}.json`;

  return {
    filename,
    contentType: "application/json",
    buffer,
  };
}

// ============================================================================
// CSV/ZIP Export
// ============================================================================

/**
 * Export data as ZIP containing multiple CSV files
 */
async function exportAsCsvZip(
  orgSlug: string,
  orgName: string,
  data: Awaited<ReturnType<typeof fetchOrganizationData>>
): Promise<BackupExportResult> {
  // Create archiver
  const archive = archiver("zip", {
    zlib: { level: 9 }, // Maximum compression
  });

  const chunks: Buffer[] = [];

  // Collect chunks
  archive.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });

  // Wait for archive to finish
  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    archive.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    archive.on("error", reject);
  });

  // Generate CSV files and add to archive

  // Settings CSV
  if (data.settings) {
    const settingsCsv = generateSettingsCsv(data.settings);
    archive.append(settingsCsv, { name: "settings.csv" });
  }

  // Accounts CSV
  if (data.accounts.length > 0) {
    const accountsCsv = generateAccountsCsv(data.accounts);
    archive.append(accountsCsv, { name: "accounts.csv" });
  }

  // Categories CSV
  if (data.categories.length > 0) {
    const categoriesCsv = generateCategoriesCsv(data.categories);
    archive.append(categoriesCsv, { name: "categories.csv" });
  }

  // Vendors CSV
  if (data.vendors.length > 0) {
    const vendorsCsv = generateVendorsCsv(data.vendors);
    archive.append(vendorsCsv, { name: "vendors.csv" });
  }

  // Clients CSV
  if (data.clients.length > 0) {
    const clientsCsv = generateClientsCsv(data.clients);
    archive.append(clientsCsv, { name: "clients.csv" });
  }

  // Tags CSV
  if (data.tags.length > 0) {
    const tagsCsv = generateTagsCsv(data.tags);
    archive.append(tagsCsv, { name: "tags.csv" });
  }

  // Transactions CSV
  if (data.transactions.length > 0) {
    const transactionsCsv = generateTransactionsCsv(data.transactions);
    archive.append(transactionsCsv, { name: "transactions.csv" });
  }

  // Transaction Tags CSV
  if (data.transactionTags.length > 0) {
    const transactionTagsCsv = generateTransactionTagsCsv(data.transactionTags);
    archive.append(transactionTagsCsv, { name: "transaction_tags.csv" });
  }

  // Transaction Documents CSV
  if (data.transactionDocuments.length > 0) {
    const transactionDocsCsv = generateTransactionDocumentsCsv(
      data.transactionDocuments
    );
    archive.append(transactionDocsCsv, { name: "transaction_documents.csv" });
  }

  // Documents CSV
  if (data.documents.length > 0) {
    const documentsCsv = generateDocumentsCsv(data.documents);
    archive.append(documentsCsv, { name: "documents.csv" });
  }

  // Finalize archive
  archive.finalize();

  const buffer = await bufferPromise;

  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `sololedger-backup-${orgSlug}-${dateStr}.zip`;

  return {
    filename,
    contentType: "application/zip",
    buffer,
  };
}

// ============================================================================
// CSV Generation Helpers
// ============================================================================

/**
 * Convert value to CSV-safe string
 */
function csvSafe(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * Generate Settings CSV
 */
function generateSettingsCsv(settings: unknown): string {
  const s = settings as Record<string, unknown>;

  const records = [
    {
      id: csvSafe(s.id),
      organizationId: csvSafe(s.organizationId),
      businessType: csvSafe(s.businessType),
      businessTypeOther: csvSafe(s.businessTypeOther),
      address: csvSafe(s.address),
      phone: csvSafe(s.phone),
      email: csvSafe(s.email),
      taxId: csvSafe(s.taxId),
      baseCurrency: csvSafe(s.baseCurrency),
      fiscalYearStartMonth: csvSafe(s.fiscalYearStartMonth),
      dateFormat: csvSafe(s.dateFormat),
      decimalSeparator: csvSafe(s.decimalSeparator),
      thousandsSeparator: csvSafe(s.thousandsSeparator),
      isTaxRegistered: csvSafe(s.isTaxRegistered),
      defaultTaxRate: csvSafe(s.defaultTaxRate),
      createdAt: csvSafe(s.createdAt),
      updatedAt: csvSafe(s.updatedAt),
    },
  ];

  return stringify(records, { header: true });
}

/**
 * Generate Accounts CSV
 */
function generateAccountsCsv(accounts: unknown[]): string {
  const records = accounts.map((a: unknown) => {
    const acc = a as Record<string, unknown>;
    return {
      id: csvSafe(acc.id),
      organizationId: csvSafe(acc.organizationId),
      name: csvSafe(acc.name),
      description: csvSafe(acc.description),
      isDefault: csvSafe(acc.isDefault),
      active: csvSafe(acc.active),
      createdAt: csvSafe(acc.createdAt),
      updatedAt: csvSafe(acc.updatedAt),
    };
  });

  return stringify(records, { header: true });
}

/**
 * Generate Categories CSV
 */
function generateCategoriesCsv(categories: unknown[]): string {
  const records = categories.map((c: unknown) => {
    const cat = c as Record<string, unknown>;
    return {
      id: csvSafe(cat.id),
      organizationId: csvSafe(cat.organizationId),
      parentId: csvSafe(cat.parentId),
      name: csvSafe(cat.name),
      type: csvSafe(cat.type),
      color: csvSafe(cat.color),
      icon: csvSafe(cat.icon),
      sortOrder: csvSafe(cat.sortOrder),
      includeInPnL: csvSafe(cat.includeInPnL),
      active: csvSafe(cat.active),
      createdAt: csvSafe(cat.createdAt),
      updatedAt: csvSafe(cat.updatedAt),
    };
  });

  return stringify(records, { header: true });
}

/**
 * Generate Vendors CSV
 */
function generateVendorsCsv(vendors: unknown[]): string {
  const records = vendors.map((v: unknown) => {
    const ven = v as Record<string, unknown>;
    return {
      id: csvSafe(ven.id),
      organizationId: csvSafe(ven.organizationId),
      name: csvSafe(ven.name),
      email: csvSafe(ven.email),
      phone: csvSafe(ven.phone),
      notes: csvSafe(ven.notes),
      active: csvSafe(ven.active),
      mergedIntoId: csvSafe(ven.mergedIntoId),
      createdAt: csvSafe(ven.createdAt),
      updatedAt: csvSafe(ven.updatedAt),
    };
  });

  return stringify(records, { header: true });
}

/**
 * Generate Clients CSV
 */
function generateClientsCsv(clients: unknown[]): string {
  const records = clients.map((c: unknown) => {
    const cli = c as Record<string, unknown>;
    return {
      id: csvSafe(cli.id),
      organizationId: csvSafe(cli.organizationId),
      name: csvSafe(cli.name),
      email: csvSafe(cli.email),
      phone: csvSafe(cli.phone),
      notes: csvSafe(cli.notes),
      active: csvSafe(cli.active),
      mergedIntoId: csvSafe(cli.mergedIntoId),
      createdAt: csvSafe(cli.createdAt),
      updatedAt: csvSafe(cli.updatedAt),
    };
  });

  return stringify(records, { header: true });
}

/**
 * Generate Tags CSV
 */
function generateTagsCsv(tags: unknown[]): string {
  const records = tags.map((t: unknown) => {
    const tag = t as Record<string, unknown>;
    return {
      id: csvSafe(tag.id),
      organizationId: csvSafe(tag.organizationId),
      name: csvSafe(tag.name),
      createdAt: csvSafe(tag.createdAt),
      updatedAt: csvSafe(tag.updatedAt),
    };
  });

  return stringify(records, { header: true });
}

/**
 * Generate Transactions CSV
 */
function generateTransactionsCsv(transactions: unknown[]): string {
  const records = transactions.map((t: unknown) => {
    const tx = t as Record<string, unknown>;
    return {
      id: csvSafe(tx.id),
      organizationId: csvSafe(tx.organizationId),
      accountId: csvSafe(tx.accountId),
      categoryId: csvSafe(tx.categoryId),
      userId: csvSafe(tx.userId),
      type: csvSafe(tx.type),
      status: csvSafe(tx.status),
      amountBase: csvSafe(tx.amountBase),
      currencyBase: csvSafe(tx.currencyBase),
      amountSecondary: csvSafe(tx.amountSecondary),
      currencySecondary: csvSafe(tx.currencySecondary),
      amountOriginal: csvSafe(tx.amountOriginal),
      currencyOriginal: csvSafe(tx.currencyOriginal),
      exchangeRateToBase: csvSafe(tx.exchangeRateToBase),
      date: csvSafe(tx.date),
      description: csvSafe(tx.description),
      vendorId: csvSafe(tx.vendorId),
      vendorName: csvSafe(tx.vendorName),
      clientId: csvSafe(tx.clientId),
      clientName: csvSafe(tx.clientName),
      notes: csvSafe(tx.notes),
      createdAt: csvSafe(tx.createdAt),
      updatedAt: csvSafe(tx.updatedAt),
    };
  });

  return stringify(records, { header: true });
}

/**
 * Generate Transaction Tags CSV
 */
function generateTransactionTagsCsv(transactionTags: unknown[]): string {
  const records = transactionTags.map((tt: unknown) => {
    const txTag = tt as Record<string, unknown>;
    return {
      transactionId: csvSafe(txTag.transactionId),
      tagId: csvSafe(txTag.tagId),
      createdAt: csvSafe(txTag.createdAt),
    };
  });

  return stringify(records, { header: true });
}

/**
 * Generate Transaction Documents CSV
 */
function generateTransactionDocumentsCsv(transactionDocuments: unknown[]): string {
  const records = transactionDocuments.map((td: unknown) => {
    const txDoc = td as Record<string, unknown>;
    return {
      transactionId: csvSafe(txDoc.transactionId),
      documentId: csvSafe(txDoc.documentId),
      createdAt: csvSafe(txDoc.createdAt),
    };
  });

  return stringify(records, { header: true });
}

/**
 * Generate Documents CSV
 */
function generateDocumentsCsv(documents: unknown[]): string {
  const records = documents.map((d: unknown) => {
    const doc = d as Record<string, unknown>;
    return {
      id: csvSafe(doc.id),
      storageKey: csvSafe(doc.storageKey),
      filenameOriginal: csvSafe(doc.filenameOriginal),
      displayName: csvSafe(doc.displayName),
      mimeType: csvSafe(doc.mimeType),
      fileSizeBytes: csvSafe(doc.fileSizeBytes),
      type: csvSafe(doc.type),
      documentDate: csvSafe(doc.documentDate),
      uploadedAt: csvSafe(doc.uploadedAt),
      deletedAt: csvSafe(doc.deletedAt),
    };
  });

  return stringify(records, { header: true });
}
