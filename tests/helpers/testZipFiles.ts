/**
 * Test helpers for loading and creating ZIP files for import tests
 */

import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

/**
 * Load the actual test ZIP file from uploads directory
 * Returns the buffer content
 */
export function loadTestZipFile(): Buffer {
  const zipPath = path.join(
    process.cwd(),
    "uploads",
    "transactions.zip"
  );

  if (!fs.existsSync(zipPath)) {
    throw new Error(
      `Test ZIP file not found at ${zipPath}. Please ensure uploads/transactions.zip exists.`
    );
  }

  return fs.readFileSync(zipPath);
}

/**
 * Create a minimal valid ZIP file for testing
 */
export function createTestZip(options: {
  csvContent: string;
  documents?: Array<{ path: string; content: string | Buffer }>;
}): Buffer {
  const zip = new AdmZip();

  // Add transactions.csv
  zip.addFile("transactions.csv", Buffer.from(options.csvContent, "utf-8"));

  // Add documents if provided
  if (options.documents) {
    for (const doc of options.documents) {
      const buffer =
        typeof doc.content === "string"
          ? Buffer.from(doc.content, "utf-8")
          : doc.content;
      zip.addFile(doc.path, buffer);
    }
  }

  return zip.toBuffer();
}

/**
 * Create a ZIP file with missing transactions.csv (for error testing)
 */
export function createInvalidZip(): Buffer {
  const zip = new AdmZip();
  zip.addFile("some-other-file.txt", Buffer.from("Not a CSV", "utf-8"));
  return zip.toBuffer();
}

/**
 * Create sample CSV content for testing
 */
export function createSampleCsvContent(options?: {
  includeHeaders?: boolean;
  rowCount?: number;
  includeDocumentColumn?: boolean;
}): string {
  const {
    includeHeaders = true,
    rowCount = 2,
    includeDocumentColumn = false,
  } = options || {};

  const headers = [
    "date",
    "amount",
    "currency",
    "description",
    "category",
    "account",
    "type",
  ];

  if (includeDocumentColumn) {
    headers.push("document");
  }

  const rows: string[] = [];

  if (includeHeaders) {
    rows.push(headers.join(","));
  }

  for (let i = 0; i < rowCount; i++) {
    const row = [
      "2025-01-01",
      "100.00",
      "MYR",
      `Test transaction ${i + 1}`,
      "Office Supplies",
      "Bank",
      "EXPENSE",
    ];

    if (includeDocumentColumn) {
      row.push(i === 0 ? "receipts/receipt-1.pdf" : "");
    }

    rows.push(row.join(","));
  }

  return rows.join("\n");
}

/**
 * Create a ZIP with sample transactions for testing
 */
export function createSampleZip(options?: {
  rowCount?: number;
  includeDocuments?: boolean;
  documentCount?: number;
}): Buffer {
  const {
    rowCount = 2,
    includeDocuments = true,
    documentCount = 1,
  } = options || {};

  const csvContent = createSampleCsvContent({
    includeHeaders: true,
    rowCount,
    includeDocumentColumn: includeDocuments,
  });

  const documents: Array<{ path: string; content: string }> = [];

  if (includeDocuments) {
    for (let i = 0; i < documentCount; i++) {
      documents.push({
        path: `receipts/receipt-${i + 1}.pdf`,
        content: `PDF content for receipt ${i + 1}`,
      });
    }
  }

  return createTestZip({
    csvContent,
    documents: documents.length > 0 ? documents : undefined,
  });
}

/**
 * Create a ZIP with an oversized document (for size validation testing)
 */
export function createZipWithOversizedDocument(): Buffer {
  const csvContent = createSampleCsvContent({
    includeHeaders: true,
    rowCount: 1,
    includeDocumentColumn: true,
  });

  // Create a 15MB document (exceeds 10MB limit)
  const largeBuffer = Buffer.alloc(15 * 1024 * 1024, "x");

  return createTestZip({
    csvContent,
    documents: [{ path: "receipts/receipt-1.pdf", content: largeBuffer }],
  });
}

/**
 * Create a ZIP with an unsupported file type
 */
export function createZipWithUnsupportedFileType(): Buffer {
  const csvContent = createSampleCsvContent({
    includeHeaders: true,
    rowCount: 1,
    includeDocumentColumn: true,
  });

  // Replace the .pdf with .xlsx in the CSV
  const modifiedCsv = csvContent.replace("receipt-1.pdf", "spreadsheet-1.xlsx");

  return createTestZip({
    csvContent: modifiedCsv,
    documents: [
      { path: "receipts/spreadsheet-1.xlsx", content: "Excel content" },
    ],
  });
}

/**
 * Create a ZIP with missing document reference
 */
export function createZipWithMissingDocument(): Buffer {
  const csvContent = createSampleCsvContent({
    includeHeaders: true,
    rowCount: 1,
    includeDocumentColumn: true,
  });

  // CSV references a document, but we don't include it in the ZIP
  return createTestZip({
    csvContent,
    documents: [], // No documents
  });
}

/**
 * Create a valid ZIP for commit testing with all necessary data
 */
export function createCompleteTestZip(): Buffer {
  const csvContent = `date,amount,currency,description,category,account,type,vendor,client,notes,tags,document
2025-10-30,150.00,MYR,Anthropic API usage,Software & Subscriptions,MBB,EXPENSE,Anthropic,,"API usage","api;software",Anthropic/invoice-1.pdf
2025-10-25,96.00,MYR,ChatGPT Plus,Software & Subscriptions,MBB,EXPENSE,OpenAI,,"Subscription","subscription;software",OpenAI/invoice-2.pdf`;

  return createTestZip({
    csvContent,
    documents: [
      { path: "Anthropic/invoice-1.pdf", content: "PDF content 1" },
      { path: "OpenAI/invoice-2.pdf", content: "PDF content 2" },
    ],
  });
}
