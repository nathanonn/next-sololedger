/**
 * Integration tests for API key organization scoping security fix
 * Tests that API keys scoped to org A cannot access org B's resources
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/mockPrisma";

// Mock database
vi.mock("@/lib/db", () => ({
  db: prismaMock,
}));

// Mock bcrypt
vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

import { GET as transactionsGET } from "@/app/api/orgs/[orgSlug]/transactions/route";
import { GET as categoriesGET } from "@/app/api/orgs/[orgSlug]/categories/route";
import { GET as vendorsGET } from "@/app/api/orgs/[orgSlug]/vendors/route";
import { GET as orgsGET } from "@/app/api/orgs/route";
import { mockBearerRequest } from "@/tests/helpers/mockRequest";
import { generateTestBearerToken } from "@/tests/helpers/mockApiKey";
import { testUsers, testOrganizations, testMemberships } from "@/tests/helpers/testData";

describe("API Key Organization Scoping Security", () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  describe("Cross-organization access prevention", () => {
    it("should deny API key from org A accessing org B transactions", async () => {
      // User is member of both Acme and TechStart
      const userWithApiKey = {
        ...testUsers.john,
        apiKeyOrganizationId: testOrganizations.acme.id, // API key scoped to Acme
      };

      // Generate Bearer token for Acme
      const token = await generateTestBearerToken(
        testUsers.john.id,
        testOrganizations.acme.id
      );

      // Mock user lookup
      prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);

      // Mock API key lookup (valid key for Acme)
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: "api-key-acme",
        userId: testUsers.john.id,
        organizationId: testOrganizations.acme.id,
        revokedAt: null,
        expiresAt: null,
      } as never);

      // Mock organization lookup (TechStart)
      prismaMock.organization.findUnique.mockResolvedValue(
        testOrganizations.techstart as never
      );

      // Mock membership in TechStart (user IS a member)
      prismaMock.membership.findUnique.mockResolvedValue({
        ...testMemberships.johnTechStart,
        role: "admin",
      } as never);

      // Attempt to access TechStart transactions with Acme API key
      const request = mockBearerRequest(token, {
        url: "http://localhost:3000/api/orgs/techstart/transactions",
      });

      const response = await transactionsGET(request, {
        params: Promise.resolve({ orgSlug: "techstart" }),
      });

      // Should be forbidden
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain("API key not authorized");
    });

    it("should allow API key accessing its own organization", async () => {
      // Generate Bearer token for Acme
      const token = await generateTestBearerToken(
        testUsers.john.id,
        testOrganizations.acme.id
      );

      // Mock user lookup
      prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);

      // Mock API key lookup
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: "api-key-acme",
        userId: testUsers.john.id,
        organizationId: testOrganizations.acme.id,
        revokedAt: null,
        expiresAt: null,
      } as never);

      // Mock organization lookup (Acme)
      prismaMock.organization.findUnique.mockResolvedValue(
        testOrganizations.acme as never
      );

      // Mock membership
      prismaMock.membership.findUnique.mockResolvedValue({
        ...testMemberships.johnAcme,
        role: "admin",
      } as never);

      // Mock org settings
      prismaMock.organizationSettings.findUnique.mockResolvedValue({
        id: "settings-acme",
        organizationId: testOrganizations.acme.id,
        baseCurrency: "USD",
      } as never);

      // Mock transactions
      prismaMock.transaction.findMany.mockResolvedValue([]);

      // Access Acme transactions with Acme API key
      const request = mockBearerRequest(token, {
        url: "http://localhost:3000/api/orgs/acme/transactions",
      });

      const response = await transactionsGET(request, {
        params: Promise.resolve({ orgSlug: "acme" }),
      });

      // Should succeed
      expect(response.status).toBe(200);
    });

    it("should deny API key from org A accessing org B categories", async () => {
      const token = await generateTestBearerToken(
        testUsers.john.id,
        testOrganizations.acme.id
      );

      prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: "api-key-acme",
        organizationId: testOrganizations.acme.id,
        revokedAt: null,
        expiresAt: null,
      } as never);

      prismaMock.organization.findUnique.mockResolvedValue(
        testOrganizations.techstart as never
      );

      prismaMock.membership.findUnique.mockResolvedValue({
        ...testMemberships.johnTechStart,
      } as never);

      const request = mockBearerRequest(token, {
        url: "http://localhost:3000/api/orgs/techstart/categories",
      });

      const response = await categoriesGET(request, {
        params: Promise.resolve({ orgSlug: "techstart" }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain("API key not authorized");
    });

    it("should deny API key from org A accessing org B vendors", async () => {
      const token = await generateTestBearerToken(
        testUsers.john.id,
        testOrganizations.acme.id
      );

      prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: "api-key-acme",
        organizationId: testOrganizations.acme.id,
        revokedAt: null,
        expiresAt: null,
      } as never);

      prismaMock.organization.findUnique.mockResolvedValue(
        testOrganizations.techstart as never
      );

      prismaMock.membership.findUnique.mockResolvedValue({
        ...testMemberships.johnTechStart,
      } as never);

      const request = mockBearerRequest(token, {
        url: "http://localhost:3000/api/orgs/techstart/vendors",
      });

      const response = await vendorsGET(request, {
        params: Promise.resolve({ orgSlug: "techstart" }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain("API key not authorized");
    });
  });

  describe("GET /api/orgs with API key authentication", () => {
    it("should only return the scoped organization for API key users", async () => {
      const token = await generateTestBearerToken(
        testUsers.john.id,
        testOrganizations.acme.id
      );

      // Mock user lookup
      prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);

      // Mock API key lookup
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: "api-key-acme",
        organizationId: testOrganizations.acme.id,
        revokedAt: null,
        expiresAt: null,
      } as never);

      // Mock scoped organization lookup
      prismaMock.organization.findUnique.mockResolvedValue(
        testOrganizations.acme as never
      );

      // Mock membership
      prismaMock.membership.findUnique.mockResolvedValue({
        ...testMemberships.johnAcme,
        role: "admin",
      } as never);

      const request = mockBearerRequest(token, {
        url: "http://localhost:3000/api/orgs",
      });

      const response = await orgsGET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should only return the scoped organization
      expect(data.organizations).toHaveLength(1);
      expect(data.organizations[0].id).toBe(testOrganizations.acme.id);
      expect(data.organizations[0].slug).toBe("acme");

      // Should NOT include TechStart even though user is a member
      const orgIds = data.organizations.map((org: { id: string }) => org.id);
      expect(orgIds).not.toContain(testOrganizations.techstart.id);
    });

    it("should return 404 if scoped organization does not exist", async () => {
      const token = await generateTestBearerToken(
        testUsers.john.id,
        "deleted-org-id"
      );

      prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: "api-key-deleted",
        organizationId: "deleted-org-id",
        revokedAt: null,
        expiresAt: null,
      } as never);

      // Organization doesn't exist
      prismaMock.organization.findUnique.mockResolvedValue(null);

      const request = mockBearerRequest(token);

      const response = await orgsGET(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Organization not found");
    });
  });

  describe("Security edge cases", () => {
    it("should prevent API key leakage by not revealing all user organizations", async () => {
      // Scenario: API key for Acme is leaked
      // Attacker should not be able to discover user's other organizations
      const token = await generateTestBearerToken(
        testUsers.john.id,
        testOrganizations.acme.id
      );

      prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: "api-key-acme",
        organizationId: testOrganizations.acme.id,
        revokedAt: null,
        expiresAt: null,
      } as never);

      prismaMock.organization.findUnique.mockResolvedValue(
        testOrganizations.acme as never
      );

      prismaMock.membership.findUnique.mockResolvedValue({
        ...testMemberships.johnAcme,
      } as never);

      const request = mockBearerRequest(token);

      const response = await orgsGET(request);
      const data = await response.json();

      // Attacker should only see Acme, not discover TechStart
      expect(data.organizations).toHaveLength(1);
      expect(data.organizations[0].slug).toBe("acme");
    });

    it("should deny access even if user manually constructs URL for other org", async () => {
      // Scenario: User has API key for Acme, tries to manually access TechStart
      const token = await generateTestBearerToken(
        testUsers.john.id,
        testOrganizations.acme.id
      );

      prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: "api-key-acme",
        organizationId: testOrganizations.acme.id,
        revokedAt: null,
        expiresAt: null,
      } as never);

      prismaMock.organization.findUnique.mockResolvedValue(
        testOrganizations.techstart as never
      );

      // User IS a member of TechStart
      prismaMock.membership.findUnique.mockResolvedValue({
        userId: testUsers.john.id,
        organizationId: testOrganizations.techstart.id,
        role: "admin",
      } as never);

      // Try to access TechStart with Acme API key
      const request = mockBearerRequest(token, {
        url: "http://localhost:3000/api/orgs/techstart/categories",
      });

      const response = await categoriesGET(request, {
        params: Promise.resolve({ orgSlug: "techstart" }),
      });

      // Should be denied by validateApiKeyOrgAccess
      expect(response.status).toBe(403);
    });
  });
});
