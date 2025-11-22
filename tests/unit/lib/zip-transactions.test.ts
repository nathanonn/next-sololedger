/**
 * Unit tests for lib/import/zip-transactions.ts
 */

import { describe, it, expect } from "vitest";
import AdmZip from "adm-zip";
import {
  normalizeDocumentPath,
  guessMimeType,
  parseTransactionsZip,
} from "@/lib/import/zip-transactions";

describe("normalizeDocumentPath", () => {
  it("should normalize simple path", () => {
    const result = normalizeDocumentPath("documents/receipt.pdf");
    expect(result).toBe("documents/receipt.pdf");
  });

  it("should convert backslashes to forward slashes", () => {
    const result = normalizeDocumentPath("documents\\receipt.pdf");
    expect(result).toBe("documents/receipt.pdf");
  });

  it("should strip leading ./", () => {
    const result = normalizeDocumentPath("./documents/receipt.pdf");
    expect(result).toBe("documents/receipt.pdf");
  });

  it("should strip leading /", () => {
    const result = normalizeDocumentPath("/documents/receipt.pdf");
    expect(result).toBe("documents/receipt.pdf");
  });

  it("should handle Windows absolute paths", () => {
    const result = normalizeDocumentPath("C:\\Users\\Documents\\receipt.pdf");
    expect(result).toBe("C:/Users/Documents/receipt.pdf");
  });

  it("should collapse duplicate slashes", () => {
    const result = normalizeDocumentPath("documents//receipts///file.pdf");
    expect(result).toBe("documents/receipts/file.pdf");
  });

  it("should handle mixed separators", () => {
    const result = normalizeDocumentPath(".\\documents/receipts\\file.pdf");
    expect(result).toBe("documents/receipts/file.pdf");
  });

  it("should trim whitespace", () => {
    const result = normalizeDocumentPath("  documents/receipt.pdf  ");
    expect(result).toBe("documents/receipt.pdf");
  });

  it("should handle empty string", () => {
    const result = normalizeDocumentPath("");
    expect(result).toBe("");
  });

  it("should handle filename without directory", () => {
    const result = normalizeDocumentPath("receipt.pdf");
    expect(result).toBe("receipt.pdf");
  });
});

describe("guessMimeType", () => {
  it("should detect PDF files", () => {
    expect(guessMimeType("document.pdf")).toBe("application/pdf");
    expect(guessMimeType("Document.PDF")).toBe("application/pdf");
    expect(guessMimeType("receipt.Pdf")).toBe("application/pdf");
  });

  it("should detect PNG images", () => {
    expect(guessMimeType("image.png")).toBe("image/png");
    expect(guessMimeType("Image.PNG")).toBe("image/png");
  });

  it("should detect JPEG images (jpg extension)", () => {
    expect(guessMimeType("photo.jpg")).toBe("image/jpeg");
    expect(guessMimeType("Photo.JPG")).toBe("image/jpeg");
  });

  it("should detect JPEG images (jpeg extension)", () => {
    expect(guessMimeType("photo.jpeg")).toBe("image/jpeg");
    expect(guessMimeType("Photo.JPEG")).toBe("image/jpeg");
  });

  it("should detect text files", () => {
    expect(guessMimeType("notes.txt")).toBe("text/plain");
    expect(guessMimeType("Notes.TXT")).toBe("text/plain");
  });

  it("should return null for unsupported extensions", () => {
    expect(guessMimeType("document.docx")).toBeNull();
    expect(guessMimeType("spreadsheet.xlsx")).toBeNull();
    expect(guessMimeType("archive.zip")).toBeNull();
    expect(guessMimeType("video.mp4")).toBeNull();
  });

  it("should return null for files without extension", () => {
    expect(guessMimeType("README")).toBeNull();
    expect(guessMimeType("Makefile")).toBeNull();
  });

  it("should handle paths with multiple dots", () => {
    expect(guessMimeType("invoice.2024.11.22.pdf")).toBe("application/pdf");
    expect(guessMimeType("photo.final.v2.jpg")).toBe("image/jpeg");
  });

  it("should handle full paths", () => {
    expect(guessMimeType("documents/receipts/invoice.pdf")).toBe(
      "application/pdf"
    );
    expect(guessMimeType("images/photos/vacation.jpg")).toBe("image/jpeg");
  });
});

describe("parseTransactionsZip", () => {
  it("should parse valid ZIP with transactions.csv at root", async () => {
    // Create a simple ZIP with transactions.csv
    const zip = new AdmZip();
    const csvContent = `date,amount,description
2025-01-01,100.00,Test transaction`;
    zip.addFile("transactions.csv", Buffer.from(csvContent, "utf-8"));
    zip.addFile("documents/receipt.pdf", Buffer.from("PDF content", "utf-8"));

    const zipBuffer = zip.toBuffer();
    const result = await parseTransactionsZip(zipBuffer);

    expect(result.transactionsCsv).toBeInstanceOf(Buffer);
    expect(result.transactionsCsv.toString("utf-8")).toBe(csvContent);
    expect(result.documentsByPath.size).toBe(1);
    expect(result.documentsByPath.has("documents/receipt.pdf")).toBe(true);
  });

  it("should parse valid ZIP with transactions.csv in subdirectory", async () => {
    const zip = new AdmZip();
    const csvContent = `date,amount,description
2025-01-01,100.00,Test transaction`;
    zip.addFile("import/transactions.csv", Buffer.from(csvContent, "utf-8"));

    const zipBuffer = zip.toBuffer();
    const result = await parseTransactionsZip(zipBuffer);

    expect(result.transactionsCsv).toBeInstanceOf(Buffer);
    expect(result.transactionsCsv.toString("utf-8")).toBe(csvContent);
  });

  it("should throw error when transactions.csv is missing", async () => {
    const zip = new AdmZip();
    zip.addFile("other-file.csv", Buffer.from("not transactions", "utf-8"));

    const zipBuffer = zip.toBuffer();

    await expect(parseTransactionsZip(zipBuffer)).rejects.toThrow(
      "transactions.csv not found in ZIP"
    );
  });

  it("should include __MACOSX metadata files in documents map", async () => {
    const zip = new AdmZip();
    const csvContent = `date,amount,description
2025-01-01,100.00,Test`;
    zip.addFile("transactions.csv", Buffer.from(csvContent, "utf-8"));
    zip.addFile("__MACOSX/._transactions.csv", Buffer.from("metadata"));
    zip.addFile("__MACOSX/._receipt.pdf", Buffer.from("metadata"));
    zip.addFile("documents/receipt.pdf", Buffer.from("PDF content"));

    const zipBuffer = zip.toBuffer();
    const result = await parseTransactionsZip(zipBuffer);

    // Note: Implementation doesn't filter __MACOSX files, they're included in the map
    // But they won't be referenced in the CSV, so they won't cause issues
    expect(result.documentsByPath.size).toBe(3);
    expect(result.documentsByPath.has("documents/receipt.pdf")).toBe(true);
    expect(result.documentsByPath.has("__MACOSX/._transactions.csv")).toBe(true);
    expect(result.documentsByPath.has("__MACOSX/._receipt.pdf")).toBe(true);
  });

  it("should normalize document paths in returned map", async () => {
    const zip = new AdmZip();
    zip.addFile("transactions.csv", Buffer.from("date,amount", "utf-8"));
    zip.addFile("./documents/receipt.pdf", Buffer.from("PDF"));

    const zipBuffer = zip.toBuffer();
    const result = await parseTransactionsZip(zipBuffer);

    // Path should be normalized (no leading ./)
    expect(result.documentsByPath.has("documents/receipt.pdf")).toBe(true);
    expect(result.documentsByPath.has("./documents/receipt.pdf")).toBe(false);
  });

  it("should handle ZIP with multiple documents", async () => {
    const zip = new AdmZip();
    zip.addFile("transactions.csv", Buffer.from("date,amount", "utf-8"));
    zip.addFile("Anthropic/invoice-1.pdf", Buffer.from("PDF1"));
    zip.addFile("OpenAI/invoice-2.pdf", Buffer.from("PDF2"));
    zip.addFile("receipts/receipt-1.png", Buffer.from("PNG1"));

    const zipBuffer = zip.toBuffer();
    const result = await parseTransactionsZip(zipBuffer);

    expect(result.documentsByPath.size).toBe(3);
    expect(result.documentsByPath.has("Anthropic/invoice-1.pdf")).toBe(true);
    expect(result.documentsByPath.has("OpenAI/invoice-2.pdf")).toBe(true);
    expect(result.documentsByPath.has("receipts/receipt-1.png")).toBe(true);
  });

  it("should preserve original filenames in documentsByPath", async () => {
    const zip = new AdmZip();
    zip.addFile("transactions.csv", Buffer.from("date,amount", "utf-8"));
    zip.addFile(
      "documents/Receipt-2024-001.pdf",
      Buffer.from("PDF content")
    );

    const zipBuffer = zip.toBuffer();
    const result = await parseTransactionsZip(zipBuffer);

    const doc = result.documentsByPath.get("documents/Receipt-2024-001.pdf");
    expect(doc).toBeDefined();
    expect(doc?.originalName).toBe("Receipt-2024-001.pdf");
  });

  it("should handle empty ZIP", async () => {
    const zip = new AdmZip();
    const zipBuffer = zip.toBuffer();

    await expect(parseTransactionsZip(zipBuffer)).rejects.toThrow(
      "transactions.csv not found in ZIP"
    );
  });

  it("should throw error for invalid ZIP buffer", async () => {
    const invalidBuffer = Buffer.from("This is not a ZIP file");

    await expect(parseTransactionsZip(invalidBuffer)).rejects.toThrow();
  });
});
