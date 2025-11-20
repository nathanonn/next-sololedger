/**
 * Unit tests for api-keys.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/tests/helpers/mockPrisma";

// Mock bcrypt
const mockHash = vi.fn();
const mockCompare = vi.fn();
vi.mock("bcrypt", () => ({
  default: {
    hash: (...args: unknown[]) => mockHash(...args),
    compare: (...args: unknown[]) => mockCompare(...args),
  },
}));

// Mock database
vi.mock("@/lib/db", () => ({
  db: prismaMock,
}));

// Mock crypto for deterministic testing
vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  const mockRandomBytes = (size: number) => ({
    toString: (encoding: string) => {
      if (encoding === "base64url") {
        return "ABCD1234EFGH5678IJKL9012MNOP3456QRST7890UVWX";
      }
      return "";
    },
  });

  return {
    ...actual,
    default: {
      ...actual,
      randomBytes: mockRandomBytes,
    },
    randomBytes: mockRandomBytes,
  };
});

import {
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  createApiKey,
  findActiveApiKeyByFullKey,
  revokeApiKey,
  updateApiKeyScopesAndExpiry,
  listApiKeysForUser,
  updateApiKeyLastUsed,
  createApiKeyAuditLog,
} from "@/lib/api-keys";
import { resetPrismaMock } from "@/tests/helpers/mockPrisma";
import { testUsers, testOrganizations, testApiKeys } from "@/tests/helpers/testData";

describe("generateApiKey", () => {
  it("should generate API key with slk_ prefix", () => {
    const { fullKey, prefix } = generateApiKey();

    expect(fullKey).toMatch(/^slk_/);
    expect(prefix).toMatch(/^slk_/);
    expect(prefix.length).toBe(12); // "slk_" + 8 chars
  });

  it("should generate 40-character random part", () => {
    const { fullKey } = generateApiKey();

    // slk_ (4) + 40 random chars = 44 total
    expect(fullKey.length).toBe(44);
  });

  it("should extract correct prefix", () => {
    const { fullKey, prefix } = generateApiKey();

    expect(prefix).toBe(fullKey.slice(0, 12));
  });
});

describe("hashApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should hash API key using bcrypt", async () => {
    const fullKey = "slk_test1234567890";
    const expectedHash = "$2b$12$hashedvalue";

    mockHash.mockResolvedValue(expectedHash);

    const result = await hashApiKey(fullKey);

    expect(mockHash).toHaveBeenCalledWith(fullKey, 12);
    expect(result).toBe(expectedHash);
  });
});

describe("verifyApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true for valid API key", async () => {
    const fullKey = "slk_test1234567890";
    const hash = "$2b$12$hashedvalue";

    mockCompare.mockResolvedValue(true);

    const result = await verifyApiKey(fullKey, hash);

    expect(mockCompare).toHaveBeenCalledWith(fullKey, hash);
    expect(result).toBe(true);
  });

  it("should return false for invalid API key", async () => {
    const fullKey = "slk_wrongkey";
    const hash = "$2b$12$hashedvalue";

    mockCompare.mockResolvedValue(false);

    const result = await verifyApiKey(fullKey, hash);

    expect(result).toBe(false);
  });
});

describe("createApiKey", () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  it("should create API key in database with all fields", async () => {
    const params = {
      userId: testUsers.john.id,
      organizationId: testOrganizations.acme.id,
      name: "Test API Key",
      scopes: ["read", "write"],
      expiresAt: new Date("2025-12-31"),
    };

    mockHash.mockResolvedValue("$2b$12$hashedkey");

    const createdKey = {
      id: "api-key-id",
      ...params,
      prefix: "slk_ABCD1234",
      secretHash: "$2b$12$hashedkey",
      revokedAt: null,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaMock.apiKey.create.mockResolvedValue(createdKey as never);

    const result = await createApiKey(params);

    expect(result.apiKey).toBeDefined();
    expect(result.fullKey).toMatch(/^slk_/);
    expect(prismaMock.apiKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: params.userId,
          organizationId: params.organizationId,
          name: params.name,
          scopes: params.scopes,
        }),
      })
    );
  });

  it("should handle null scopes and expiresAt", async () => {
    const params = {
      userId: testUsers.john.id,
      organizationId: testOrganizations.acme.id,
      name: "Simple Key",
    };

    mockHash.mockResolvedValue("$2b$12$hashedkey");

    const createdKey = {
      id: "api-key-id",
      ...params,
      prefix: "slk_ABCD1234",
      secretHash: "$2b$12$hashedkey",
      scopes: null,
      expiresAt: null,
      revokedAt: null,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaMock.apiKey.create.mockResolvedValue(createdKey as never);

    const result = await createApiKey(params);

    expect(result.apiKey.scopes).toBeNull();
    expect(result.apiKey.expiresAt).toBeNull();
  });
});

describe("findActiveApiKeyByFullKey", () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  it("should find and validate active API key", async () => {
    const fullKey = "slk_test1234567890";
    const apiKeyRecord = {
      ...testApiKeys.johnAcme,
      user: {
        id: testUsers.john.id,
        email: testUsers.john.email,
        sessionVersion: testUsers.john.sessionVersion,
        role: testUsers.john.role,
      },
    };

    mockCompare.mockResolvedValue(true);
    prismaMock.apiKey.findUnique.mockResolvedValue(apiKeyRecord as never);

    const result = await findActiveApiKeyByFullKey(fullKey);

    expect(result).toBeDefined();
    expect(result?.id).toBe(testApiKeys.johnAcme.id);
    expect(result?.user.id).toBe(testUsers.john.id);
  });

  it("should return null for invalid prefix", async () => {
    const fullKey = "invalid_prefix";

    const result = await findActiveApiKeyByFullKey(fullKey);

    expect(result).toBeNull();
    expect(prismaMock.apiKey.findUnique).not.toHaveBeenCalled();
  });

  it("should return null for non-existent key", async () => {
    const fullKey = "slk_nonexistent";

    prismaMock.apiKey.findUnique.mockResolvedValue(null);

    const result = await findActiveApiKeyByFullKey(fullKey);

    expect(result).toBeNull();
  });

  it("should return null for invalid hash", async () => {
    const fullKey = "slk_test1234567890";
    const apiKeyRecord = {
      ...testApiKeys.johnAcme,
      user: testUsers.john,
    };

    mockCompare.mockResolvedValue(false);
    prismaMock.apiKey.findUnique.mockResolvedValue(apiKeyRecord as never);

    const result = await findActiveApiKeyByFullKey(fullKey);

    expect(result).toBeNull();
  });

  it("should return null for revoked key", async () => {
    const fullKey = "slk_test1234567890";
    const revokedKey = {
      ...testApiKeys.johnRevoked,
      user: testUsers.john,
    };

    mockCompare.mockResolvedValue(true);
    prismaMock.apiKey.findUnique.mockResolvedValue(revokedKey as never);

    const result = await findActiveApiKeyByFullKey(fullKey);

    expect(result).toBeNull();
  });

  it("should return null for expired key", async () => {
    const fullKey = "slk_test1234567890";
    const expiredKey = {
      ...testApiKeys.johnExpired,
      user: testUsers.john,
    };

    mockCompare.mockResolvedValue(true);
    prismaMock.apiKey.findUnique.mockResolvedValue(expiredKey as never);

    const result = await findActiveApiKeyByFullKey(fullKey);

    expect(result).toBeNull();
  });

  it("should handle errors gracefully", async () => {
    const fullKey = "slk_test1234567890";

    prismaMock.apiKey.findUnique.mockRejectedValue(new Error("Database error"));

    const result = await findActiveApiKeyByFullKey(fullKey);

    expect(result).toBeNull();
  });
});

describe("revokeApiKey", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("should revoke API key and update timestamps", async () => {
    const apiKeyId = "api-key-id";
    const now = new Date();

    const revokedKey = {
      ...testApiKeys.johnAcme,
      revokedAt: now,
      lastUsedAt: now,
    };

    prismaMock.apiKey.update.mockResolvedValue(revokedKey as never);

    const result = await revokeApiKey(apiKeyId);

    expect(result.revokedAt).toBeTruthy();
    expect(prismaMock.apiKey.update).toHaveBeenCalledWith({
      where: { id: apiKeyId },
      data: expect.objectContaining({
        revokedAt: expect.any(Date),
        lastUsedAt: expect.any(Date),
      }),
    });
  });
});

describe("updateApiKeyScopesAndExpiry", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("should update scopes only", async () => {
    const params = {
      apiKeyId: "api-key-id",
      scopes: ["read"],
    };

    const updatedKey = {
      ...testApiKeys.johnAcme,
      scopes: ["read"],
    };

    prismaMock.apiKey.update.mockResolvedValue(updatedKey as never);

    await updateApiKeyScopesAndExpiry(params);

    expect(prismaMock.apiKey.update).toHaveBeenCalledWith({
      where: { id: params.apiKeyId },
      data: { scopes: params.scopes },
    });
  });

  it("should update expiry only", async () => {
    const expiresAt = new Date("2025-12-31");
    const params = {
      apiKeyId: "api-key-id",
      expiresAt,
    };

    const updatedKey = {
      ...testApiKeys.johnAcme,
      expiresAt,
    };

    prismaMock.apiKey.update.mockResolvedValue(updatedKey as never);

    await updateApiKeyScopesAndExpiry(params);

    expect(prismaMock.apiKey.update).toHaveBeenCalledWith({
      where: { id: params.apiKeyId },
      data: { expiresAt },
    });
  });

  it("should update name, scopes and expiry", async () => {
    const expiresAt = new Date("2025-12-31");
    const params = {
      apiKeyId: "api-key-id",
      name: "Updated Name",
      scopes: ["read", "write"],
      expiresAt,
    };

    const updatedKey = {
      ...testApiKeys.johnAcme,
      ...params,
    };

    prismaMock.apiKey.update.mockResolvedValue(updatedKey as never);

    await updateApiKeyScopesAndExpiry(params);

    expect(prismaMock.apiKey.update).toHaveBeenCalledWith({
      where: { id: params.apiKeyId },
      data: {
        name: params.name,
        scopes: params.scopes,
        expiresAt,
      },
    });
  });
});

describe("listApiKeysForUser", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("should list all keys for user", async () => {
    const userId = testUsers.john.id;
    const keys = [
      {
        ...testApiKeys.johnAcme,
        organization: testOrganizations.acme,
      },
    ];

    prismaMock.apiKey.findMany.mockResolvedValue(keys as never);

    const result = await listApiKeysForUser(userId);

    expect(result).toHaveLength(1);
    expect(result[0].organization.id).toBe(testOrganizations.acme.id);
    expect(prismaMock.apiKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId },
      })
    );
  });

  it("should filter by organization", async () => {
    const userId = testUsers.john.id;
    const orgId = testOrganizations.acme.id;
    const keys = [
      {
        ...testApiKeys.johnAcme,
        organization: testOrganizations.acme,
      },
    ];

    prismaMock.apiKey.findMany.mockResolvedValue(keys as never);

    const result = await listApiKeysForUser(userId, orgId);

    expect(result).toHaveLength(1);
    expect(prismaMock.apiKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, organizationId: orgId },
      })
    );
  });

  it("should not return secretHash", async () => {
    const userId = testUsers.john.id;
    const keys = [
      {
        ...testApiKeys.johnAcme,
        organization: testOrganizations.acme,
      },
    ];

    // Remove secretHash to simulate select behavior
    delete (keys[0] as { secretHash?: string }).secretHash;

    prismaMock.apiKey.findMany.mockResolvedValue(keys as never);

    const result = await listApiKeysForUser(userId);

    expect(result[0]).not.toHaveProperty("secretHash");
  });
});

describe("updateApiKeyLastUsed", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("should update lastUsedAt timestamp", async () => {
    const apiKeyId = "api-key-id";

    prismaMock.apiKey.update.mockResolvedValue({} as never);

    await updateApiKeyLastUsed(apiKeyId);

    expect(prismaMock.apiKey.update).toHaveBeenCalledWith({
      where: { id: apiKeyId },
      data: { lastUsedAt: expect.any(Date) },
    });
  });
});

describe("createApiKeyAuditLog", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("should create audit log entry", async () => {
    const params = {
      action: "api_key.created",
      userId: testUsers.john.id,
      organizationId: testOrganizations.acme.id,
      email: testUsers.john.email,
      ip: "192.168.1.1",
      metadata: { keyName: "Test Key" },
    };

    prismaMock.auditLog.create.mockResolvedValue({} as never);

    await createApiKeyAuditLog(params);

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: params,
    });
  });

  it("should handle missing optional fields", async () => {
    const params = {
      action: "api_key.revoked",
      userId: testUsers.john.id,
      organizationId: testOrganizations.acme.id,
    };

    prismaMock.auditLog.create.mockResolvedValue({} as never);

    await createApiKeyAuditLog(params);

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        ...params,
        email: undefined,
        ip: undefined,
        metadata: {},
      },
    });
  });
});
