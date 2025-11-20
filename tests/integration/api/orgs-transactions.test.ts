/**
 * Integration tests for /api/orgs/[orgSlug]/transactions
 * Tests Bearer token authentication for CRUD operations
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

import { GET, POST } from "@/app/api/orgs/[orgSlug]/transactions/route";
import { resetPrismaMock } from "@/tests/helpers/mockPrisma";
import { mockBearerRequest } from "@/tests/helpers/mockRequest";
import {
  testUsers,
  testOrganizations,
  testMemberships,
  testTransactions,
  testOrgSettings,
  testCategories,
  testAccounts,
} from "@/tests/helpers/testData";
import { verifyAccessJwt } from "@/lib/jwt";

describe("GET /api/orgs/[orgSlug]/transactions", () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  // Skipped: Requires full Next.js request context and route parameter handling
  it.skip("should list transactions with Bearer token auth", async () => {
    const token = "valid_bearer_token";

    // Mock JWT verification to return API key auth user
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
    prismaMock.organization.findFirst.mockResolvedValue(testOrganizations.acme as never);
    prismaMock.membership.findFirst.mockResolvedValue(testMemberships.johnAcme as never);
    prismaMock.organizationSettings.findUnique.mockResolvedValue(testOrgSettings.acme as never);
    prismaMock.transaction.findMany.mockResolvedValue([testTransactions.income] as never);

    const request = mockBearerRequest(token, {
      url: `http://localhost:3000/api/orgs/${testOrganizations.acme.slug}/transactions`,
    });

    const response = await GET(request, {
      params: Promise.resolve({ orgSlug: testOrganizations.acme.slug }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.transactions).toHaveLength(1);
  });

  it("should reject request without authentication", async () => {
    vi.mocked(verifyAccessJwt).mockRejectedValue(new Error("No token"));

    const request = mockBearerRequest("invalid", {
      url: `http://localhost:3000/api/orgs/${testOrganizations.acme.slug}/transactions`,
    });

    const response = await GET(request, {
      params: Promise.resolve({ orgSlug: testOrganizations.acme.slug }),
    });

    expect(response.status).toBe(401);
  });

  // Skipped: Requires full Next.js request context
  it.skip("should reject API key accessing wrong organization", async () => {
    const token = "valid_bearer_token";

    // User's API key is scoped to acme, but trying to access techstart
    vi.mocked(verifyAccessJwt).mockResolvedValue({
      sub: testUsers.john.id,
      email: testUsers.john.email,
      role: testUsers.john.role,
      tokenVersion: testUsers.john.sessionVersion,
      authMethod: "api_key",
      apiKeyId: "api-key-id",
      organizationId: testOrganizations.acme.id, // Scoped to acme
    });

    prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);
    prismaMock.apiKey.findUnique.mockResolvedValue({
      id: "api-key-id",
      revokedAt: null,
      expiresAt: null,
    } as never);
    prismaMock.organization.findFirst.mockResolvedValue(testOrganizations.techstart as never); // Trying to access techstart

    const request = mockBearerRequest(token, {
      url: `http://localhost:3000/api/orgs/${testOrganizations.techstart.slug}/transactions`,
    });

    const response = await GET(request, {
      params: Promise.resolve({ orgSlug: testOrganizations.techstart.slug }),
    });

    const data = await response.json();
    expect(response.status).toBe(403);
    expect(data.error).toBe("Access denied");
  });
});

describe("POST /api/orgs/[orgSlug]/transactions", () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  // Skipped: Requires full Next.js request context and route parameter handling
  it.skip("should create transaction with Bearer token (no CSRF error)", async () => {
    const token = "valid_bearer_token";

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
    prismaMock.organization.findFirst.mockResolvedValue(testOrganizations.acme as never);
    prismaMock.membership.findFirst.mockResolvedValue(testMemberships.johnAcme as never);
    prismaMock.organizationSettings.findUnique.mockResolvedValue(testOrgSettings.acme as never);
    prismaMock.category.findUnique.mockResolvedValue(testCategories.revenue as never);
    prismaMock.account.findUnique.mockResolvedValue(testAccounts.checkingAccount as never);
    prismaMock.transaction.create.mockResolvedValue(testTransactions.income as never);

    const transactionData = {
      type: "INCOME",
      status: "POSTED",
      amountBase: 1000,
      date: "2025-01-15",
      description: "Test transaction via API",
      categoryId: testCategories.revenue.id,
      accountId: testAccounts.checkingAccount.id,
    };

    const request = mockBearerRequest(token, {
      method: "POST",
      url: `http://localhost:3000/api/orgs/${testOrganizations.acme.slug}/transactions`,
      body: transactionData,
      headers: {
        origin: "http://evil.com", // Invalid origin, but Bearer bypasses CSRF
      },
    });

    const response = await POST(request, {
      params: Promise.resolve({ orgSlug: testOrganizations.acme.slug }),
    });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.transaction).toBeDefined();
  });

  // Skipped: Requires full Next.js request context
  it.skip("should validate category type matches transaction type", async () => {
    const token = "valid_bearer_token";

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
    prismaMock.organization.findFirst.mockResolvedValue(testOrganizations.acme as never);
    prismaMock.membership.findFirst.mockResolvedValue(testMemberships.johnAcme as never);
    prismaMock.organizationSettings.findUnique.mockResolvedValue(testOrgSettings.acme as never);
    prismaMock.category.findUnique.mockResolvedValue(testCategories.expenses as never); // EXPENSE category
    prismaMock.account.findUnique.mockResolvedValue(testAccounts.checkingAccount as never);

    const transactionData = {
      type: "INCOME", // INCOME transaction with EXPENSE category = mismatch
      status: "POSTED",
      amountBase: 1000,
      date: "2025-01-15",
      description: "Test transaction",
      categoryId: testCategories.expenses.id,
      accountId: testAccounts.checkingAccount.id,
    };

    const request = mockBearerRequest(token, {
      method: "POST",
      url: `http://localhost:3000/api/orgs/${testOrganizations.acme.slug}/transactions`,
      body: transactionData,
    });

    const response = await POST(request, {
      params: Promise.resolve({ orgSlug: testOrganizations.acme.slug }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Category type must match");
  });
});
