/**
 * Unit tests for auth-helpers.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/tests/helpers/mockPrisma";

// Mock the database BEFORE importing anything
vi.mock("@/lib/db", () => ({
  db: prismaMock,
}));

// Mock the getAccessToken function from cookies
vi.mock("@/lib/jwt", async () => {
  const actual = await vi.importActual("@/lib/jwt");
  return {
    ...actual,
    getAccessToken: vi.fn().mockResolvedValue(null),
    getRefreshToken: vi.fn().mockResolvedValue(null),
  };
});

import {
  getCurrentUser,
  getAuthFromRequest,
  validateApiKeyOrgAccess,
} from "@/lib/auth-helpers";
import {
  resetPrismaMock,
  mockUserFind,
  mockApiKeyFind,
} from "@/tests/helpers/mockPrisma";
import {
  mockBearerRequest,
  mockCookieRequest,
  mockRequest,
} from "@/tests/helpers/mockRequest";
import {
  generateTestBearerToken,
  generateTestCookieToken,
  generateInvalidToken,
  mockApiKey,
  mockExpiredApiKey,
  mockRevokedApiKey,
} from "@/tests/helpers/mockApiKey";
import {
  mockUser,
  mockApiKeyUser,
  mockCookieUser,
} from "@/tests/helpers/mockUser";
import { testUsers, testApiKeys } from "@/tests/helpers/testData";

describe("getAuthFromRequest", () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  it("should extract Bearer token from Authorization header", async () => {
    const token = "test_bearer_token";
    const request = mockBearerRequest(token);

    const result = await getAuthFromRequest(request);

    expect(result).toBe(token);
  });

  it("should return null when no auth present", async () => {
    const request = mockRequest();

    const result = await getAuthFromRequest(request);

    expect(result).toBeNull();
  });

  it("should ignore invalid Authorization header format", async () => {
    const request = mockRequest({
      headers: { authorization: "InvalidFormat token" },
    });

    const result = await getAuthFromRequest(request);

    expect(result).toBeNull();
  });

  it("should handle Bearer token with extra spaces", async () => {
    const token = "test_token";
    const request = mockRequest({
      headers: { authorization: `Bearer  ${token}` },
    });

    const result = await getAuthFromRequest(request);

    // Should not match because we expect exactly "Bearer " prefix
    expect(result).not.toBe(token);
  });
});

describe("getCurrentUser - Bearer token authentication", () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  it("should authenticate user with valid Bearer token", async () => {
    const token = await generateTestBearerToken(
      testUsers.john.id,
      "org-id",
      {
        email: testUsers.john.email,
        sessionVersion: testUsers.john.sessionVersion,
      }
    );
    const request = mockBearerRequest(token);

    mockUserFind(testUsers.john);
    mockApiKeyFind(testApiKeys.johnAcme);

    const user = await getCurrentUser(request);

    expect(user).toBeTruthy();
    expect(user?.id).toBe(testUsers.john.id);
    expect(user?.email).toBe(testUsers.john.email);
    expect(user?.apiKeyOrganizationId).toBe("org-id");
  });

  it("should return null for invalid Bearer token", async () => {
    const invalidToken = generateInvalidToken();
    const request = mockBearerRequest(invalidToken);

    const user = await getCurrentUser(request);

    expect(user).toBeNull();
  });

  it("should reject expired API key", async () => {
    const token = await generateTestBearerToken(
      testUsers.john.id,
      "org-id",
      {
        apiKeyId: testApiKeys.johnExpired.id,
        sessionVersion: testUsers.john.sessionVersion,
      }
    );
    const request = mockBearerRequest(token);

    mockUserFind(testUsers.john);
    mockApiKeyFind(mockExpiredApiKey());

    const user = await getCurrentUser(request);

    expect(user).toBeNull();
  });

  it("should reject revoked API key", async () => {
    const token = await generateTestBearerToken(
      testUsers.john.id,
      "org-id",
      {
        apiKeyId: testApiKeys.johnRevoked.id,
        sessionVersion: testUsers.john.sessionVersion,
      }
    );
    const request = mockBearerRequest(token);

    mockUserFind(testUsers.john);
    mockApiKeyFind(mockRevokedApiKey());

    const user = await getCurrentUser(request);

    expect(user).toBeNull();
  });

  it("should reject when API key not found in database", async () => {
    const token = await generateTestBearerToken(
      testUsers.john.id,
      "org-id",
      {
        apiKeyId: "non-existent-key",
        sessionVersion: testUsers.john.sessionVersion,
      }
    );
    const request = mockBearerRequest(token);

    mockUserFind(testUsers.john);
    prismaMock.apiKey.findUnique.mockResolvedValue(null);

    const user = await getCurrentUser(request);

    expect(user).toBeNull();
  });

  it("should reject when session version mismatch", async () => {
    const token = await generateTestBearerToken(
      testUsers.john.id,
      "org-id",
      {
        sessionVersion: 1, // Token has version 1
      }
    );
    const request = mockBearerRequest(token);

    // User in database has version 2 (password changed)
    const userWithNewVersion = { ...testUsers.john, sessionVersion: 2 };
    mockUserFind(userWithNewVersion);
    mockApiKeyFind(testApiKeys.johnAcme);

    const user = await getCurrentUser(request);

    expect(user).toBeNull();
  });

  it("should reject when user not found in database", async () => {
    const token = await generateTestBearerToken("non-existent-user", "org-id");
    const request = mockBearerRequest(token);

    prismaMock.user.findUnique.mockResolvedValue(null);

    const user = await getCurrentUser(request);

    expect(user).toBeNull();
  });
});

describe("getCurrentUser - Cookie authentication", () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  it("should return null when no authentication present", async () => {
    const user = await getCurrentUser();

    expect(user).toBeNull();
  });

  it("should not set apiKeyOrganizationId for cookie auth", async () => {
    const token = await generateTestCookieToken(testUsers.john.id, {
      sessionVersion: testUsers.john.sessionVersion,
    });

    // Mock getAccessToken to return the cookie token
    const { getAccessToken } = await import("@/lib/jwt");
    vi.mocked(getAccessToken).mockResolvedValue(token);

    mockUserFind(testUsers.john);

    const user = await getCurrentUser();

    expect(user).toBeTruthy();
    expect(user?.id).toBe(testUsers.john.id);
    // Cookie auth returns null for apiKeyOrganizationId (not undefined)
    expect(user?.apiKeyOrganizationId).toBeNull();
  });
});

describe("validateApiKeyOrgAccess", () => {
  it("should allow cookie-based users to access any organization", () => {
    const user = mockCookieUser({ id: "user-id" });
    const requestedOrgId = "any-org-id";

    const isValid = validateApiKeyOrgAccess(user, requestedOrgId);

    expect(isValid).toBe(true);
  });

  it("should allow API key user to access their scoped organization", () => {
    const orgId = "org-123";
    const user = mockApiKeyUser(orgId);

    const isValid = validateApiKeyOrgAccess(user, orgId);

    expect(isValid).toBe(true);
  });

  it("should deny API key user access to different organization", () => {
    const scopedOrgId = "org-123";
    const requestedOrgId = "org-456";
    const user = mockApiKeyUser(scopedOrgId);

    const isValid = validateApiKeyOrgAccess(user, requestedOrgId);

    expect(isValid).toBe(false);
  });

  it("should handle user without apiKeyOrganizationId as cookie auth", () => {
    const user = mockUser({ apiKeyOrganizationId: undefined });
    const requestedOrgId = "any-org";

    const isValid = validateApiKeyOrgAccess(user, requestedOrgId);

    expect(isValid).toBe(true);
  });
});
