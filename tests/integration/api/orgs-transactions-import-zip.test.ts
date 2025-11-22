/**
 * Integration tests for ZIP transaction import
 * Tests /api/orgs/[orgSlug]/transactions/import/preview and commit
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/tests/helpers/mockPrisma";

// Mock database
vi.mock("@/lib/db", () => ({
  db: prismaMock,
}));

// Mock JWT verification
vi.mock("@/lib/jwt", async () => {
  const actual = await vi.importActual("@/lib/jwt");
  return {
    ...actual,
    verifyAccessJwt: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue(null),
  };
});

// Mock document storage
import { createMockDocumentStorage } from "@/tests/helpers/mockDocumentStorage";
const mockStorage = createMockDocumentStorage();

vi.mock("@/lib/documents/storage", () => ({
  getDocumentStorage: vi.fn(() => mockStorage),
}));

import { POST as PreviewPOST } from "@/app/api/orgs/[orgSlug]/transactions/import/preview/route";
import { POST as CommitPOST } from "@/app/api/orgs/[orgSlug]/transactions/import/commit/route";
import { resetPrismaMock } from "@/tests/helpers/mockPrisma";
import { mockBearerRequest } from "@/tests/helpers/mockRequest";
import {
  testUsers,
  testOrganizations,
  testMemberships,
  testOrgSettings,
  testCategories,
  testAccounts,
} from "@/tests/helpers/testData";

// Create additional test data for categories
const testExpenseCategory = {
  id: "cat-software-id",
  organizationId: testOrganizations.acme.id,
  name: "Software & Subscriptions",
  type: "EXPENSE" as const,
  parentId: null,
  displayOrder: 1,
  active: true,
  deletedAt: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

const testAccount = {
  id: "acc-mbb-id",
  organizationId: testOrganizations.acme.id,
  name: "MBB",
  type: "BANK_ACCOUNT" as const,
  currency: "MYR",
  displayOrder: 1,
  active: true,
  deletedAt: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};
import { verifyAccessJwt } from "@/lib/jwt";
import {
  createCompleteTestZip,
  createZipWithMissingDocument,
  createZipWithOversizedDocument,
  createZipWithUnsupportedFileType,
  createInvalidZip,
  createSampleCsvContent,
  createTestZip,
} from "@/tests/helpers/testZipFiles";

describe("POST /api/orgs/[orgSlug]/transactions/import/preview (ZIP mode)", () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  it("should preview valid ZIP file with documents", async () => {
    const token = "valid_bearer_token";
    const zipBuffer = createCompleteTestZip();

    // Mock JWT verification
    vi.mocked(verifyAccessJwt).mockResolvedValue({
      sub: testUsers.john.id,
      email: testUsers.john.email,
      role: testUsers.john.role,
      tokenVersion: testUsers.john.sessionVersion,
      authMethod: "api_key",
      apiKeyId: "api-key-id",
      organizationId: testOrganizations.acme.id,
    });

    // Mock database calls
    prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);
    prismaMock.apiKey.findUnique.mockResolvedValue({
      id: "api-key-id",
      revokedAt: null,
      expiresAt: null,
    } as never);
    prismaMock.organization.findUnique.mockResolvedValue(
      testOrganizations.acme as never
    );
    prismaMock.membership.findUnique.mockResolvedValue(
      testMemberships.johnAcme as never
    );
    prismaMock.organizationSettings.findUnique.mockResolvedValue(
      testOrgSettings.acme as never
    );

    // Mock category and account findMany (for bulk lookups in normalizeAndValidateRows)
    prismaMock.category.findMany.mockResolvedValue([
      testCategories.expenses,
      testExpenseCategory,
      testCategories.revenue,
    ] as never);
    prismaMock.account.findMany.mockResolvedValue([
      testAccounts.checkingAccount,
      testAccount,
    ] as never);

    // Mock category lookups
    prismaMock.category.findFirst.mockImplementation(async (args: any) => {
      const name = args?.where?.name;
      if (name === "Software & Subscriptions") {
        return testExpenseCategory as never;
      }
      if (name === "Office Supplies") {
        return testCategories.expenses as never;
      }
      return null;
    });

    // Mock account lookups
    prismaMock.account.findFirst.mockImplementation(async (args: any) => {
      const name = args?.where?.name;
      if (name === "MBB") {
        return testAccount as never;
      }
      if (name === "Bank") {
        return testAccounts.checkingAccount as never;
      }
      return null;
    });

    // Mock duplicate detection
    prismaMock.transaction.findMany.mockResolvedValue([]);

    // Create FormData with ZIP file
    const formData = new FormData();
    formData.append("file", new File([zipBuffer], "transactions.zip", {
      type: "application/zip",
    }));
    formData.append(
      "mappingConfig",
      JSON.stringify({
        importMode: "zip_with_documents",
        columnMapping: {
          date: "date",
          amount: "amount",
          currency: "currency",
          description: "description",
          category: "category",
          account: "account",
          type: "type",
          vendor: "vendor",
          tags: "tags",
          document: "document",
        },
        parsingOptions: {
          directionMode: "type_column",
          dateFormat: "YYYY_MM_DD",
          delimiter: ",",
          headerRowIndex: 0,
          hasHeaders: true,
          decimalSeparator: "DOT",
          thousandsSeparator: "COMMA",
        },
      })
    );

    const request = mockBearerRequest(token, {
      url: `http://localhost:3000/api/orgs/${testOrganizations.acme.slug}/transactions/import/preview`,
      method: "POST",
      body: formData,
    });

    const response = await PreviewPOST(request, {
      params: Promise.resolve({ orgSlug: testOrganizations.acme.slug }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary).toBeDefined();
    expect(data.summary.totalRows).toBe(2);
    // Note: validRows/invalidRows depend on category/account validation
    expect(data.rows).toHaveLength(2);
  });

  it("should reject ZIP without transactions.csv", async () => {
    const token = "valid_bearer_token";
    const zipBuffer = createInvalidZip();

    vi.mocked(verifyAccessJwt).mockResolvedValue({
      sub: testUsers.john.id,
      email: testUsers.john.email,
      role: testUsers.john.role,
      tokenVersion: testUsers.john.sessionVersion,
      authMethod: "api_key",
      apiKeyId: "api-key-id",
      organizationId: testOrganizations.acme.id,
    });

    prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);
    prismaMock.apiKey.findUnique.mockResolvedValue({
      id: "api-key-id",
      revokedAt: null,
      expiresAt: null,
    } as never);
    prismaMock.organization.findUnique.mockResolvedValue(
      testOrganizations.acme as never
    );
    prismaMock.membership.findUnique.mockResolvedValue(
      testMemberships.johnAcme as never
    );

    const formData = new FormData();
    formData.append("file", new File([zipBuffer], "invalid.zip", {
      type: "application/zip",
    }));
    formData.append(
      "mappingConfig",
      JSON.stringify({
        importMode: "zip_with_documents",
        columnMapping: { date: "date" },
        parsingOptions: {
          directionMode: "type_column",
          dateFormat: "YYYY_MM_DD",
          delimiter: ",",
          headerRowIndex: 0,
          hasHeaders: true,
          decimalSeparator: "DOT",
          thousandsSeparator: "COMMA",
        },
      })
    );

    const request = mockBearerRequest(token, {
      url: `http://localhost:3000/api/orgs/${testOrganizations.acme.slug}/transactions/import/preview`,
      method: "POST",
      body: formData,
    });

    const response = await PreviewPOST(request, {
      params: Promise.resolve({ orgSlug: testOrganizations.acme.slug }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Failed to parse ZIP file");
  });

  it("should mark rows invalid when documents are missing", async () => {
    const token = "valid_bearer_token";
    const zipBuffer = createZipWithMissingDocument();

    vi.mocked(verifyAccessJwt).mockResolvedValue({
      sub: testUsers.john.id,
      email: testUsers.john.email,
      role: testUsers.john.role,
      tokenVersion: testUsers.john.sessionVersion,
      authMethod: "api_key",
      apiKeyId: "api-key-id",
      organizationId: testOrganizations.acme.id,
    });

    prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);
    prismaMock.apiKey.findUnique.mockResolvedValue({
      id: "api-key-id",
      revokedAt: null,
      expiresAt: null,
    } as never);
    prismaMock.organization.findUnique.mockResolvedValue(
      testOrganizations.acme as never
    );
    prismaMock.membership.findUnique.mockResolvedValue(
      testMemberships.johnAcme as never
    );
    prismaMock.organizationSettings.findUnique.mockResolvedValue(
      testOrgSettings.acme as never
    );

    // Mock category and account findMany (for bulk lookups in normalizeAndValidateRows)
    prismaMock.category.findMany.mockResolvedValue([
      testCategories.expenses,
      testExpenseCategory,
      testCategories.revenue,
    ] as never);
    prismaMock.account.findMany.mockResolvedValue([
      testAccounts.checkingAccount,
      testAccount,
    ] as never);

    prismaMock.category.findFirst.mockImplementation(async (args: any) => {
      const name = args?.where?.name;
      if (name === "Office Supplies") {
        return testCategories.expenses as never;
      }
      return null;
    });
    prismaMock.account.findFirst.mockImplementation(async (args: any) => {
      const name = args?.where?.name;
      if (name === "Bank") {
        return testAccounts.checkingAccount as never;
      }
      return null;
    });
    prismaMock.transaction.findMany.mockResolvedValue([]);

    const formData = new FormData();
    formData.append("file", new File([zipBuffer], "missing-doc.zip", {
      type: "application/zip",
    }));
    formData.append(
      "mappingConfig",
      JSON.stringify({
        importMode: "zip_with_documents",
        columnMapping: {
          date: "date",
          amount: "amount",
          currency: "currency",
          description: "description",
          category: "category",
          account: "account",
          type: "type",
          document: "document",
        },
        parsingOptions: {
          directionMode: "type_column",
          dateFormat: "YYYY_MM_DD",
          delimiter: ",",
          headerRowIndex: 0,
          hasHeaders: true,
          decimalSeparator: "DOT",
          thousandsSeparator: "COMMA",
        },
      })
    );

    const request = mockBearerRequest(token, {
      url: `http://localhost:3000/api/orgs/${testOrganizations.acme.slug}/transactions/import/preview`,
      method: "POST",
      body: formData,
    });

    const response = await PreviewPOST(request, {
      params: Promise.resolve({ orgSlug: testOrganizations.acme.slug }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary.invalidRows).toBeGreaterThan(0);
    // Check that at least one row has document-related error
    const hasDocumentError = data.rows.some((row: any) =>
      row.errors?.some((err: string) => err.includes("Missing document"))
    );
    expect(hasDocumentError).toBe(true);
  });

  it("should support backward compatibility with CSV mode", async () => {
    const token = "valid_bearer_token";
    const csvContent = createSampleCsvContent({ rowCount: 1 });
    const csvBuffer = Buffer.from(csvContent, "utf-8");

    vi.mocked(verifyAccessJwt).mockResolvedValue({
      sub: testUsers.john.id,
      email: testUsers.john.email,
      role: testUsers.john.role,
      tokenVersion: testUsers.john.sessionVersion,
      authMethod: "api_key",
      apiKeyId: "api-key-id",
      organizationId: testOrganizations.acme.id,
    });

    prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);
    prismaMock.apiKey.findUnique.mockResolvedValue({
      id: "api-key-id",
      revokedAt: null,
      expiresAt: null,
    } as never);
    prismaMock.organization.findUnique.mockResolvedValue(
      testOrganizations.acme as never
    );
    prismaMock.membership.findUnique.mockResolvedValue(
      testMemberships.johnAcme as never
    );
    prismaMock.organizationSettings.findUnique.mockResolvedValue(
      testOrgSettings.acme as never
    );

    // Mock category and account findMany (for bulk lookups in normalizeAndValidateRows)
    prismaMock.category.findMany.mockResolvedValue([
      testCategories.expenses,
      testExpenseCategory,
      testCategories.revenue,
    ] as never);
    prismaMock.account.findMany.mockResolvedValue([
      testAccounts.checkingAccount,
      testAccount,
    ] as never);

    prismaMock.category.findFirst.mockImplementation(async (args: any) => {
      const name = args?.where?.name;
      if (name === "Office Supplies") {
        return testCategories.expenses as never;
      }
      return null;
    });
    prismaMock.account.findFirst.mockImplementation(async (args: any) => {
      const name = args?.where?.name;
      if (name === "Bank") {
        return testAccounts.checkingAccount as never;
      }
      return null;
    });
    prismaMock.transaction.findMany.mockResolvedValue([]);

    const formData = new FormData();
    formData.append("file", new File([csvBuffer], "transactions.csv", {
      type: "text/csv",
    }));
    formData.append(
      "mappingConfig",
      JSON.stringify({
        importMode: "csv", // Explicit CSV mode
        columnMapping: {
          date: "date",
          amount: "amount",
          currency: "currency",
          description: "description",
          category: "category",
          account: "account",
          type: "type",
        },
        parsingOptions: {
          directionMode: "type_column",
          dateFormat: "YYYY_MM_DD",
          delimiter: ",",
          headerRowIndex: 0,
          hasHeaders: true,
          decimalSeparator: "DOT",
          thousandsSeparator: "COMMA",
        },
      })
    );

    const request = mockBearerRequest(token, {
      url: `http://localhost:3000/api/orgs/${testOrganizations.acme.slug}/transactions/import/preview`,
      method: "POST",
      body: formData,
    });

    const response = await PreviewPOST(request, {
      params: Promise.resolve({ orgSlug: testOrganizations.acme.slug }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary).toBeDefined();
  });
});

describe("POST /api/orgs/[orgSlug]/transactions/import/commit (ZIP mode)", () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  it("should commit valid ZIP import with document upload", async () => {
    const token = "valid_bearer_token";
    const zipBuffer = createTestZip({
      csvContent: `date,amount,currency,description,category,account,type,document
2025-01-15,100.00,MYR,Test expense,Office Supplies,Bank,EXPENSE,receipts/receipt-1.pdf`,
      documents: [
        { path: "receipts/receipt-1.pdf", content: "PDF content" },
      ],
    });

    vi.mocked(verifyAccessJwt).mockResolvedValue({
      sub: testUsers.john.id,
      email: testUsers.john.email,
      role: testUsers.john.role,
      tokenVersion: testUsers.john.sessionVersion,
      authMethod: "api_key",
      apiKeyId: "api-key-id",
      organizationId: testOrganizations.acme.id,
    });

    prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);
    prismaMock.apiKey.findUnique.mockResolvedValue({
      id: "api-key-id",
      revokedAt: null,
      expiresAt: null,
    } as never);
    prismaMock.organization.findUnique.mockResolvedValue(
      testOrganizations.acme as never
    );
    prismaMock.membership.findUnique.mockResolvedValue(
      testMemberships.johnAcme as never
    );
    prismaMock.organizationSettings.findUnique.mockResolvedValue(
      testOrgSettings.acme as never
    );

    // Mock category and account findMany (for bulk lookups in normalizeAndValidateRows)
    prismaMock.category.findMany.mockResolvedValue([
      testCategories.expenses,
      testExpenseCategory,
      testCategories.revenue,
    ] as never);
    prismaMock.account.findMany.mockResolvedValue([
      testAccounts.checkingAccount,
      testAccount,
    ] as never);

    prismaMock.category.findFirst.mockImplementation(async (args: any) => {
      const name = args?.where?.name;
      if (name === "Office Supplies") {
        return testCategories.expenses as never;
      }
      return null;
    });
    prismaMock.account.findFirst.mockImplementation(async (args: any) => {
      const name = args?.where?.name;
      if (name === "Bank") {
        return testAccounts.checkingAccount as never;
      }
      return null;
    });
    prismaMock.transaction.findMany.mockResolvedValue([]);

    // Mock transaction creation
    prismaMock.transaction.create.mockResolvedValue({
      id: "txn-1",
      organizationId: testOrganizations.acme.id,
      userId: testUsers.john.id,
      accountId: testAccounts.checkingAccount.id,
      categoryId: testCategories.expenses.id,
      type: "EXPENSE",
      status: "POSTED",
      amountBase: 100,
      currencyBase: "MYR",
      date: new Date("2025-01-15"),
      description: "Test expense",
    } as never);

    // Mock document creation
    prismaMock.document.create.mockResolvedValue({
      id: "doc-1",
      organizationId: testOrganizations.acme.id,
      uploadedByUserId: testUsers.john.id,
      storageKey: "test-storage-key-1.pdf",
      filenameOriginal: "receipt-1.pdf",
      displayName: "receipt-1",
      mimeType: "application/pdf",
      fileSizeBytes: 11,
      type: "RECEIPT",
      documentDate: new Date("2025-01-15"),
    } as never);

    // Mock transaction-document link creation
    prismaMock.transactionDocument.create.mockResolvedValue({
      transactionId: "txn-1",
      documentId: "doc-1",
    } as never);

    // Mock audit log
    prismaMock.auditLog.create.mockResolvedValue({} as never);

    const formData = new FormData();
    formData.append("file", new File([zipBuffer], "transactions.zip", {
      type: "application/zip",
    }));
    formData.append(
      "mappingConfig",
      JSON.stringify({
        importMode: "zip_with_documents",
        columnMapping: {
          date: "date",
          amount: "amount",
          currency: "currency",
          description: "description",
          category: "category",
          account: "account",
          type: "type",
          document: "document",
        },
        parsingOptions: {
          directionMode: "type_column",
          dateFormat: "YYYY_MM_DD",
          delimiter: ",",
          headerRowIndex: 0,
          hasHeaders: true,
          decimalSeparator: "DOT",
          thousandsSeparator: "COMMA",
        },
      })
    );

    const request = mockBearerRequest(token, {
      url: `http://localhost:3000/api/orgs/${testOrganizations.acme.slug}/transactions/import/commit`,
      method: "POST",
      body: formData,
    });

    const response = await CommitPOST(request, {
      params: Promise.resolve({ orgSlug: testOrganizations.acme.slug }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.importedCount).toBe(1);
    expect(data.documentsCreated).toBe(1);
    expect(data.documentLinksCreated).toBe(1);

    // Verify document storage was called
    expect(mockStorage.save).toHaveBeenCalledTimes(1);

    // Verify document was created
    expect(prismaMock.document.create).toHaveBeenCalledTimes(1);

    // Verify transaction-document link was created
    expect(prismaMock.transactionDocument.create).toHaveBeenCalledTimes(1);
  });

  it("should reject unauthenticated requests", async () => {
    vi.mocked(verifyAccessJwt).mockRejectedValue(new Error("No token"));

    const formData = new FormData();
    formData.append("file", new File(["test"], "test.zip"));

    const request = mockBearerRequest("invalid", {
      url: `http://localhost:3000/api/orgs/${testOrganizations.acme.slug}/transactions/import/commit`,
      method: "POST",
      body: formData,
    });

    const response = await CommitPOST(request, {
      params: Promise.resolve({ orgSlug: testOrganizations.acme.slug }),
    });

    expect(response.status).toBe(401);
  });
});
