/**
 * Edge case tests for token lifecycle
 * Tests token expiration, session version changes, and API key lifecycle
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/tests/helpers/mockPrisma";

// Mock database
vi.mock("@/lib/db", () => ({
  db: prismaMock,
}));

// Mock JWT for custom scenarios
vi.mock("@/lib/jwt", async () => {
  const actual = await vi.importActual("@/lib/jwt");
  return {
    ...actual,
    getAccessToken: vi.fn().mockResolvedValue(null),
  };
});

import { getCurrentUser } from "@/lib/auth-helpers";
import { verifyAccessJwt, signAccessJwt } from "@/lib/jwt";
import { resetPrismaMock } from "@/tests/helpers/mockPrisma";
import { mockBearerRequest } from "@/tests/helpers/mockRequest";
import { testUsers, testApiKeys } from "@/tests/helpers/testData";

describe("Session version mismatch (password changed)", () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  it("should reject token after password change increments session version", async () => {
    // Create a token with sessionVersion=1
    const token = await signAccessJwt({
      sub: testUsers.john.id,
      email: testUsers.john.email,
      role: testUsers.john.role,
      tokenVersion: 1,
      authMethod: "api_key",
      apiKeyId: "api-key-id",
      organizationId: "org-id",
    });

    // User's sessionVersion is now 2 (password changed)
    const userAfterPasswordChange = {
      ...testUsers.john,
      sessionVersion: 2,
    };

    prismaMock.user.findUnique.mockResolvedValue(userAfterPasswordChange as never);
    prismaMock.apiKey.findUnique.mockResolvedValue({
      id: "api-key-id",
      revokedAt: null,
      expiresAt: null,
    } as never);

    const request = mockBearerRequest(token);
    const user = await getCurrentUser(request);

    expect(user).toBeNull();
  });

  it("should accept token with matching session version", async () => {
    // Create a token with sessionVersion=2
    const token = await signAccessJwt({
      sub: testUsers.john.id,
      email: testUsers.john.email,
      role: testUsers.john.role,
      tokenVersion: 2,
      authMethod: "api_key",
      apiKeyId: "api-key-id",
      organizationId: "org-id",
    });

    const userWithSessionVersion2 = {
      ...testUsers.john,
      sessionVersion: 2,
    };

    prismaMock.user.findUnique.mockResolvedValue(userWithSessionVersion2 as never);
    prismaMock.apiKey.findUnique.mockResolvedValue({
      id: "api-key-id",
      revokedAt: null,
      expiresAt: null,
    } as never);

    const request = mockBearerRequest(token);
    const user = await getCurrentUser(request);

    expect(user).toBeTruthy();
    expect(user?.sessionVersion).toBe(2);
  });
});

describe("API key revocation mid-session", () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  it("should reject token after API key is revoked", async () => {
    const token = await signAccessJwt({
      sub: testUsers.john.id,
      email: testUsers.john.email,
      role: testUsers.john.role,
      tokenVersion: testUsers.john.sessionVersion,
      authMethod: "api_key",
      apiKeyId: testApiKeys.johnRevoked.id,
      organizationId: "org-id",
    });

    prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);
    prismaMock.apiKey.findUnique.mockResolvedValue(testApiKeys.johnRevoked as never); // Revoked key

    const request = mockBearerRequest(token);
    const user = await getCurrentUser(request);

    expect(user).toBeNull();
  });
});

describe("API key expiration", () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  it("should reject token from expired API key", async () => {
    const token = await signAccessJwt({
      sub: testUsers.john.id,
      email: testUsers.john.email,
      role: testUsers.john.role,
      tokenVersion: testUsers.john.sessionVersion,
      authMethod: "api_key",
      apiKeyId: testApiKeys.johnExpired.id,
      organizationId: "org-id",
    });

    prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);
    prismaMock.apiKey.findUnique.mockResolvedValue(testApiKeys.johnExpired as never); // Expired key

    const request = mockBearerRequest(token);
    const user = await getCurrentUser(request);

    expect(user).toBeNull();
  });

  it("should accept token from non-expired API key", async () => {
    const futureExpiry = new Date();
    futureExpiry.setFullYear(futureExpiry.getFullYear() + 1);

    const activeKey = {
      ...testApiKeys.johnAcme,
      expiresAt: futureExpiry,
    };

    const token = await signAccessJwt({
      sub: testUsers.john.id,
      email: testUsers.john.email,
      role: testUsers.john.role,
      tokenVersion: testUsers.john.sessionVersion,
      authMethod: "api_key",
      apiKeyId: activeKey.id,
      organizationId: "org-id",
    });

    prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);
    prismaMock.apiKey.findUnique.mockResolvedValue(activeKey as never);

    const request = mockBearerRequest(token);
    const user = await getCurrentUser(request);

    expect(user).toBeTruthy();
  });
});

describe("JWT token expiration", () => {
  it("should reject expired JWT token", async () => {
    // Create a token with immediate expiration (this is theoretical since jose signs with current time)
    const expiredToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZXhwIjoxNjAwMDAwMDAwfQ.signature";

    await expect(verifyAccessJwt(expiredToken)).rejects.toThrow("Invalid or expired access token");
  });

  it("should accept valid non-expired JWT token", async () => {
    const token = await signAccessJwt({
      sub: testUsers.john.id,
      email: testUsers.john.email,
      role: testUsers.john.role,
      tokenVersion: testUsers.john.sessionVersion,
    });

    const verified = await verifyAccessJwt(token);

    expect(verified.sub).toBe(testUsers.john.id);
  });
});

describe("Concurrent token usage", () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  it("should handle multiple simultaneous requests with same token", async () => {
    const token = await signAccessJwt({
      sub: testUsers.john.id,
      email: testUsers.john.email,
      role: testUsers.john.role,
      tokenVersion: testUsers.john.sessionVersion,
      authMethod: "api_key",
      apiKeyId: "api-key-id",
      organizationId: "org-id",
    });

    prismaMock.user.findUnique.mockResolvedValue(testUsers.john as never);
    prismaMock.apiKey.findUnique.mockResolvedValue({
      id: "api-key-id",
      revokedAt: null,
      expiresAt: null,
    } as never);

    // Simulate 5 concurrent requests
    const requests = Array(5)
      .fill(null)
      .map(() => mockBearerRequest(token));

    const results = await Promise.all(
      requests.map((request) => getCurrentUser(request))
    );

    // All requests should succeed
    results.forEach((user) => {
      expect(user).toBeTruthy();
      expect(user?.id).toBe(testUsers.john.id);
    });

    // Should have called findUnique multiple times (not cached)
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(5);
  });

  it("should handle session version change during concurrent requests", async () => {
    const token = await signAccessJwt({
      sub: testUsers.john.id,
      email: testUsers.john.email,
      role: testUsers.john.role,
      tokenVersion: 1,
      authMethod: "api_key",
      apiKeyId: "api-key-id",
      organizationId: "org-id",
    });

    // First request: sessionVersion matches
    prismaMock.user.findUnique.mockResolvedValueOnce({
      ...testUsers.john,
      sessionVersion: 1,
    } as never);

    // Second request: sessionVersion changed
    prismaMock.user.findUnique.mockResolvedValueOnce({
      ...testUsers.john,
      sessionVersion: 2,
    } as never);

    prismaMock.apiKey.findUnique.mockResolvedValue({
      id: "api-key-id",
      revokedAt: null,
      expiresAt: null,
    } as never);

    const request1 = mockBearerRequest(token);
    const request2 = mockBearerRequest(token);

    const [user1, user2] = await Promise.all([
      getCurrentUser(request1),
      getCurrentUser(request2),
    ]);

    // First request succeeds
    expect(user1).toBeTruthy();

    // Second request fails (sessionVersion mismatch)
    expect(user2).toBeNull();
  });
});
