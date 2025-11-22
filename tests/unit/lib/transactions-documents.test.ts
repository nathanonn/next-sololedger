/**
 * Unit tests for lib/import/transactions-documents.ts
 */

import { describe, it, expect } from "vitest";
import { validateImportDocumentsForZip } from "@/lib/import/transactions-documents";
import type { NormalizedImportRow } from "@/lib/import/transactions-csv";

// Helper to create a minimal normalized import row
function createRow(
  overrides: Partial<NormalizedImportRow> = {}
): NormalizedImportRow {
  return {
    rowIndex: 0,
    status: "valid",
    errors: [],
    warnings: [],
    isDuplicateCandidate: false,
    duplicateCandidateIds: [],
    normalized: {
      accountId: "acc_1",
      categoryId: "cat_1",
      type: "EXPENSE" as const,
      amountOriginal: 100,
      currencyOriginal: "MYR",
      amountBase: 100,
      currencyBase: "MYR",
      exchangeRateToBase: 1,
      date: new Date("2025-01-01"),
      description: "Test transaction",
      amountSecondary: null,
      currencySecondary: null,
      vendorName: null,
      clientName: null,
      notes: null,
      tagNames: null,
    },
    ...overrides,
  };
}

// Helper to create document map entries
function createDocumentMap(
  entries: Array<{ path: string; content: string; size?: number }>
): Map<string, { buffer: Buffer; originalName: string }> {
  const map = new Map<string, { buffer: Buffer; originalName: string }>();

  for (const entry of entries) {
    const buffer =
      entry.size !== undefined
        ? Buffer.alloc(entry.size, "x")
        : Buffer.from(entry.content, "utf-8");
    const parts = entry.path.split("/");
    const originalName = parts[parts.length - 1];

    map.set(entry.path, { buffer, originalName });
  }

  return map;
}

describe("validateImportDocumentsForZip", () => {
  it("should pass validation for row without document path", () => {
    const rows: NormalizedImportRow[] = [
      createRow({
        rowIndex: 0,
        documentPath: undefined,
      }),
    ];

    const documentsByPath = createDocumentMap([]);

    const result = validateImportDocumentsForZip(rows, documentsByPath);

    expect(result[0].status).toBe("valid");
    expect(result[0].errors).toHaveLength(0);
  });

  it("should pass validation for valid row with existing PDF document", () => {
    const rows: NormalizedImportRow[] = [
      createRow({
        rowIndex: 0,
        documentPath: "receipts/invoice.pdf",
      }),
    ];

    const documentsByPath = createDocumentMap([
      { path: "receipts/invoice.pdf", content: "PDF content" },
    ]);

    const result = validateImportDocumentsForZip(rows, documentsByPath);

    expect(result[0].status).toBe("valid");
    expect(result[0].errors).toHaveLength(0);
  });

  it("should pass validation for valid row with PNG image", () => {
    const rows: NormalizedImportRow[] = [
      createRow({
        rowIndex: 0,
        documentPath: "receipts/receipt.png",
      }),
    ];

    const documentsByPath = createDocumentMap([
      { path: "receipts/receipt.png", content: "PNG content" },
    ]);

    const result = validateImportDocumentsForZip(rows, documentsByPath);

    expect(result[0].status).toBe("valid");
    expect(result[0].errors).toHaveLength(0);
  });

  it("should pass validation for valid row with JPEG image", () => {
    const rows: NormalizedImportRow[] = [
      createRow({
        rowIndex: 0,
        documentPath: "receipts/photo.jpg",
      }),
    ];

    const documentsByPath = createDocumentMap([
      { path: "receipts/photo.jpg", content: "JPEG content" },
    ]);

    const result = validateImportDocumentsForZip(rows, documentsByPath);

    expect(result[0].status).toBe("valid");
    expect(result[0].errors).toHaveLength(0);
  });

  it("should fail validation when document is missing from ZIP", () => {
    const rows: NormalizedImportRow[] = [
      createRow({
        rowIndex: 0,
        documentPath: "receipts/missing.pdf",
      }),
    ];

    const documentsByPath = createDocumentMap([]);

    const result = validateImportDocumentsForZip(rows, documentsByPath);

    expect(result[0].status).toBe("invalid");
    expect(result[0].errors).toContain(
      'Missing document "receipts/missing.pdf" in ZIP'
    );
    expect(result[0].normalized).toBeUndefined();
  });

  it("should fail validation for unsupported file type", () => {
    const rows: NormalizedImportRow[] = [
      createRow({
        rowIndex: 0,
        documentPath: "documents/spreadsheet.xlsx",
      }),
    ];

    const documentsByPath = createDocumentMap([
      { path: "documents/spreadsheet.xlsx", content: "Excel content" },
    ]);

    const result = validateImportDocumentsForZip(rows, documentsByPath);

    expect(result[0].status).toBe("invalid");
    expect(result[0].errors[0]).toContain("Unsupported document type");
    expect(result[0].errors[0]).toContain("spreadsheet.xlsx");
    expect(result[0].normalized).toBeUndefined();
  });

  it("should fail validation for oversized document (>10MB)", () => {
    const rows: NormalizedImportRow[] = [
      createRow({
        rowIndex: 0,
        documentPath: "documents/large.pdf",
      }),
    ];

    // Create a document larger than 10MB
    const documentsByPath = createDocumentMap([
      { path: "documents/large.pdf", content: "", size: 11 * 1024 * 1024 },
    ]);

    const result = validateImportDocumentsForZip(rows, documentsByPath);

    expect(result[0].status).toBe("invalid");
    expect(result[0].errors[0]).toContain("large.pdf");
    expect(result[0].errors[0]).toContain("exceeds maximum");
    expect(result[0].normalized).toBeUndefined();
  });

  it("should normalize document paths before lookup", () => {
    const rows: NormalizedImportRow[] = [
      createRow({
        rowIndex: 0,
        documentPath: "./receipts/invoice.pdf", // Leading ./
      }),
    ];

    const documentsByPath = createDocumentMap([
      { path: "receipts/invoice.pdf", content: "PDF content" }, // Normalized path
    ]);

    const result = validateImportDocumentsForZip(rows, documentsByPath);

    expect(result[0].status).toBe("valid");
    expect(result[0].errors).toHaveLength(0);
  });

  it("should skip already invalid rows", () => {
    const rows: NormalizedImportRow[] = [
      createRow({
        rowIndex: 0,
        status: "invalid",
        errors: ["Previous error"],
        documentPath: "receipts/invoice.pdf",
      }),
    ];

    const documentsByPath = createDocumentMap([]);

    const result = validateImportDocumentsForZip(rows, documentsByPath);

    // Should remain invalid with only the original error
    expect(result[0].status).toBe("invalid");
    expect(result[0].errors).toHaveLength(1);
    expect(result[0].errors[0]).toBe("Previous error");
  });

  it("should handle multiple rows with mixed validation results", () => {
    const rows: NormalizedImportRow[] = [
      createRow({
        rowIndex: 0,
        documentPath: "receipts/valid.pdf",
      }),
      createRow({
        rowIndex: 1,
        documentPath: "receipts/missing.pdf",
      }),
      createRow({
        rowIndex: 2,
        documentPath: undefined, // No document
      }),
      createRow({
        rowIndex: 3,
        documentPath: "receipts/invalid.xlsx",
      }),
    ];

    const documentsByPath = createDocumentMap([
      { path: "receipts/valid.pdf", content: "PDF content" },
      { path: "receipts/invalid.xlsx", content: "Excel content" },
    ]);

    const result = validateImportDocumentsForZip(rows, documentsByPath);

    // Row 0: valid document
    expect(result[0].status).toBe("valid");
    expect(result[0].errors).toHaveLength(0);

    // Row 1: missing document
    expect(result[1].status).toBe("invalid");
    expect(result[1].errors).toContain(
      'Missing document "receipts/missing.pdf" in ZIP'
    );

    // Row 2: no document (should pass)
    expect(result[2].status).toBe("valid");
    expect(result[2].errors).toHaveLength(0);

    // Row 3: unsupported file type
    expect(result[3].status).toBe("invalid");
    expect(result[3].errors[0]).toContain("Unsupported document type");
  });

  it("should handle document paths with different extensions (.jpg vs .jpeg)", () => {
    const rows: NormalizedImportRow[] = [
      createRow({
        rowIndex: 0,
        documentPath: "receipts/photo.jpeg",
      }),
    ];

    const documentsByPath = createDocumentMap([
      { path: "receipts/photo.jpeg", content: "JPEG content" },
    ]);

    const result = validateImportDocumentsForZip(rows, documentsByPath);

    expect(result[0].status).toBe("valid");
    expect(result[0].errors).toHaveLength(0);
  });

  it("should preserve documentPath in valid rows", () => {
    const rows: NormalizedImportRow[] = [
      createRow({
        rowIndex: 0,
        documentPath: "receipts/invoice.pdf",
      }),
    ];

    const documentsByPath = createDocumentMap([
      { path: "receipts/invoice.pdf", content: "PDF content" },
    ]);

    const result = validateImportDocumentsForZip(rows, documentsByPath);

    expect(result[0].status).toBe("valid");
    expect(result[0].documentPath).toBe("receipts/invoice.pdf");
  });

  it("should clear normalized data when document validation fails", () => {
    const rows: NormalizedImportRow[] = [
      createRow({
        rowIndex: 0,
        documentPath: "receipts/missing.pdf",
        normalized: {
          accountId: "acc_1",
          categoryId: "cat_1",
          type: "EXPENSE" as const,
          amountOriginal: 100,
          currencyOriginal: "MYR",
          amountBase: 100,
          currencyBase: "MYR",
          exchangeRateToBase: 1,
          date: new Date("2025-01-01"),
          description: "Test transaction",
          amountSecondary: null,
          currencySecondary: null,
          vendorName: null,
          clientName: null,
          notes: null,
          tagNames: null,
        },
      }),
    ];

    const documentsByPath = createDocumentMap([]);

    const result = validateImportDocumentsForZip(rows, documentsByPath);

    expect(result[0].status).toBe("invalid");
    expect(result[0].normalized).toBeUndefined();
  });

  it("should mutate rows array in place and return it", () => {
    const rows: NormalizedImportRow[] = [
      createRow({
        rowIndex: 0,
        documentPath: "receipts/valid.pdf",
      }),
    ];

    const documentsByPath = createDocumentMap([
      { path: "receipts/valid.pdf", content: "PDF content" },
    ]);

    const result = validateImportDocumentsForZip(rows, documentsByPath);

    // Should return the same array reference
    expect(result).toBe(rows);
    expect(result[0]).toBe(rows[0]);
  });
});
