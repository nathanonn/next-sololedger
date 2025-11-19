import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import type { ApiKey } from "@prisma/client";

/**
 * API Key helpers for personal API keys (MCP integration)
 * Handles generation, hashing, CRUD operations, and validation
 */

const API_KEY_PREFIX = "slk_";
const API_KEY_BYTES = 32; // 32 bytes = 256 bits
const BCRYPT_ROUNDS = 12;

/**
 * Generate a new API key with prefix
 * Returns the full key and its prefix for storage
 */
export function generateApiKey(): { fullKey: string; prefix: string } {
  // Generate random bytes and convert to base64url (URL-safe)
  const randomPart = randomBytes(API_KEY_BYTES)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 40);

  const fullKey = `${API_KEY_PREFIX}${randomPart}`;

  // Extract prefix (first 8 chars after slk_)
  const prefix = fullKey.slice(0, 12); // "slk_" + 8 chars

  return { fullKey, prefix };
}

/**
 * Hash an API key using bcrypt
 */
export async function hashApiKey(fullKey: string): Promise<string> {
  return bcrypt.hash(fullKey, BCRYPT_ROUNDS);
}

/**
 * Verify an API key against its hash
 */
export async function verifyApiKey(
  fullKey: string,
  secretHash: string
): Promise<boolean> {
  return bcrypt.compare(fullKey, secretHash);
}

/**
 * Create a new API key in the database
 * Returns the created key record and the full key (only shown once)
 */
export async function createApiKey(params: {
  userId: string;
  organizationId: string;
  name: string;
  scopes?: string[] | null;
  expiresAt?: Date | null;
}): Promise<{ apiKey: ApiKey; fullKey: string }> {
  const { userId, organizationId, name, scopes, expiresAt } = params;

  // Generate key and hash
  const { fullKey, prefix } = generateApiKey();
  const secretHash = await hashApiKey(fullKey);

  // Create in database
  const apiKey = await db.apiKey.create({
    data: {
      userId,
      organizationId,
      name,
      prefix,
      secretHash,
      scopes: scopes || null,
      expiresAt: expiresAt || null,
    },
  });

  return { apiKey, fullKey };
}

/**
 * Find an active API key by its full key value
 * Validates the key, checks expiry and revocation status
 * Returns null if invalid, expired, or revoked
 */
export async function findActiveApiKeyByFullKey(
  fullKey: string
): Promise<(ApiKey & { user: { id: string; email: string; sessionVersion: number; role: string } }) | null> {
  try {
    // Extract prefix from full key
    if (!fullKey.startsWith(API_KEY_PREFIX)) {
      return null;
    }

    const prefix = fullKey.slice(0, 12);

    // Find by prefix (unique index)
    const apiKey = await db.apiKey.findUnique({
      where: { prefix },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            sessionVersion: true,
            role: true,
          },
        },
      },
    });

    if (!apiKey) return null;

    // Verify the full key against the hash
    const isValid = await verifyApiKey(fullKey, apiKey.secretHash);
    if (!isValid) return null;

    // Check if revoked
    if (apiKey.revokedAt) return null;

    // Check if expired
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    return apiKey;
  } catch {
    return null;
  }
}

/**
 * Revoke an API key
 * Sets revokedAt timestamp
 */
export async function revokeApiKey(apiKeyId: string): Promise<ApiKey> {
  return db.apiKey.update({
    where: { id: apiKeyId },
    data: {
      revokedAt: new Date(),
      lastUsedAt: new Date(),
    },
  });
}

/**
 * Update API key scopes and expiry
 */
export async function updateApiKeyScopesAndExpiry(params: {
  apiKeyId: string;
  scopes?: string[] | null;
  expiresAt?: Date | null;
  name?: string;
}): Promise<ApiKey> {
  const { apiKeyId, scopes, expiresAt, name } = params;

  return db.apiKey.update({
    where: { id: apiKeyId },
    data: {
      ...(scopes !== undefined && { scopes }),
      ...(expiresAt !== undefined && { expiresAt }),
      ...(name !== undefined && { name }),
    },
  });
}

/**
 * List API keys for a user (with optional org filter)
 * Returns metadata only (never returns secretHash)
 */
export async function listApiKeysForUser(
  userId: string,
  organizationId?: string
): Promise<
  Array<
    Omit<ApiKey, "secretHash"> & {
      organization: { id: string; name: string; slug: string };
    }
  >
> {
  const keys = await db.apiKey.findMany({
    where: {
      userId,
      ...(organizationId && { organizationId }),
    },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      name: true,
      prefix: true,
      scopes: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
      updatedAt: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return keys;
}

/**
 * Update last used timestamp for an API key
 */
export async function updateApiKeyLastUsed(apiKeyId: string): Promise<void> {
  await db.apiKey.update({
    where: { id: apiKeyId },
    data: { lastUsedAt: new Date() },
  });
}

/**
 * Helper to create audit log for API key actions
 * Inline helper since there's no centralized audit logging yet
 */
export async function createApiKeyAuditLog(params: {
  action: string;
  userId: string;
  organizationId: string;
  email?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.auditLog.create({
    data: {
      action: params.action,
      userId: params.userId,
      organizationId: params.organizationId,
      email: params.email,
      ip: params.ip,
      metadata: params.metadata || {},
    },
  });
}
