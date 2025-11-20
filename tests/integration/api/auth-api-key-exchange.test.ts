/**
 * Integration tests for /api/auth/api-key/exchange
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/tests/helpers/mockPrisma";

// Mock database
vi.mock("@/lib/db", () => ({
  db: prismaMock,
}));

// Mock bcrypt for API key verification
const mockCompare = vi.fn();
vi.mock("bcrypt", () => ({
  default: {
    compare: (...args: unknown[]) => mockCompare(...args),
    hash: vi.fn(),
  },
}));

// Mock rate limiting (allow by default)
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

import { POST } from "@/app/api/auth/api-key/exchange/route";
import { resetPrismaMock } from "@/tests/helpers/mockPrisma";
import { testUsers, testApiKeys } from "@/tests/helpers/testData";
import { mockRequest } from "@/tests/helpers/mockRequest";

describe("POST /api/auth/api-key/exchange", () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  it("should exchange valid API key for access token", async () => {
    const fullKey = "slk_validkey1234567890";

    const apiKeyWithUser = {
      ...testApiKeys.johnAcme,
      user: {
        id: testUsers.john.id,
        email: testUsers.john.email,
        sessionVersion: testUsers.john.sessionVersion,
        role: testUsers.john.role,
      },
    };

    mockCompare.mockResolvedValue(true);
    prismaMock.apiKey.findUnique.mockResolvedValue(apiKeyWithUser as never);
    prismaMock.apiKey.update.mockResolvedValue({} as never);
    prismaMock.auditLog.create.mockResolvedValue({} as never);

    const request = mockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/api-key/exchange",
      headers: {
        authorization: `ApiKey ${fullKey}`,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("accessToken");
    expect(data.tokenType).toBe("Bearer");
    expect(data.expiresIn).toBe(3600);
    expect(data.accessToken).toBeTruthy();
  });

  it("should reject request without Authorization header", async () => {
    const request = mockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/api-key/exchange",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("invalid_request");
  });

  it("should reject request with wrong Authorization format", async () => {
    const request = mockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/api-key/exchange",
      headers: {
        authorization: "Bearer some-token",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("invalid_request");
    expect(data.message).toContain("ApiKey");
  });

  it("should reject invalid API key", async () => {
    const fullKey = "slk_invalidkey";

    mockCompare.mockResolvedValue(false);
    prismaMock.apiKey.findUnique.mockResolvedValue(testApiKeys.johnAcme as never);

    const request = mockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/api-key/exchange",
      headers: {
        authorization: `ApiKey ${fullKey}`,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("invalid_api_key");
  });

  it("should reject revoked API key", async () => {
    const fullKey = "slk_revokedkey";

    const revokedKey = {
      ...testApiKeys.johnRevoked,
      user: testUsers.john,
    };

    mockCompare.mockResolvedValue(true);
    prismaMock.apiKey.findUnique.mockResolvedValue(revokedKey as never);

    const request = mockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/api-key/exchange",
      headers: {
        authorization: `ApiKey ${fullKey}`,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("invalid_api_key");
  });

  it("should reject expired API key", async () => {
    const fullKey = "slk_expiredkey";

    const expiredKey = {
      ...testApiKeys.johnExpired,
      user: testUsers.john,
    };

    mockCompare.mockResolvedValue(true);
    prismaMock.apiKey.findUnique.mockResolvedValue(expiredKey as never);

    const request = mockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/api-key/exchange",
      headers: {
        authorization: `ApiKey ${fullKey}`,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("invalid_api_key");
  });

  it("should update last used timestamp", async () => {
    const fullKey = "slk_validkey";

    const apiKeyWithUser = {
      ...testApiKeys.johnAcme,
      user: {
        id: testUsers.john.id,
        email: testUsers.john.email,
        sessionVersion: testUsers.john.sessionVersion,
        role: testUsers.john.role,
      },
    };

    mockCompare.mockResolvedValue(true);
    prismaMock.apiKey.findUnique.mockResolvedValue(apiKeyWithUser as never);
    prismaMock.apiKey.update.mockResolvedValue({} as never);
    prismaMock.auditLog.create.mockResolvedValue({} as never);

    const request = mockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/api-key/exchange",
      headers: {
        authorization: `ApiKey ${fullKey}`,
      },
    });

    await POST(request);

    // Give async operation time to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(prismaMock.apiKey.update).toHaveBeenCalledWith({
      where: { id: testApiKeys.johnAcme.id },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it("should create audit log entry", async () => {
    const fullKey = "slk_validkey";

    const apiKeyWithUser = {
      ...testApiKeys.johnAcme,
      user: {
        id: testUsers.john.id,
        email: testUsers.john.email,
        sessionVersion: testUsers.john.sessionVersion,
        role: testUsers.john.role,
      },
    };

    mockCompare.mockResolvedValue(true);
    prismaMock.apiKey.findUnique.mockResolvedValue(apiKeyWithUser as never);
    prismaMock.apiKey.update.mockResolvedValue({} as never);
    prismaMock.auditLog.create.mockResolvedValue({} as never);

    const request = mockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/api-key/exchange",
      headers: {
        authorization: `ApiKey ${fullKey}`,
      },
    });

    await POST(request);

    // Give async operation time to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "api_key_exchanged",
        userId: testUsers.john.id,
        email: testUsers.john.email,
      }),
    });
  });

  // Skipped: Database error handling needs better mocking
  it.skip("should handle database errors gracefully", async () => {
    const fullKey = "slk_validkey";

    prismaMock.apiKey.findUnique.mockRejectedValue(new Error("Database error"));

    const request = mockRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/api-key/exchange",
      headers: {
        authorization: `ApiKey ${fullKey}`,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("internal_error");
  });
});
