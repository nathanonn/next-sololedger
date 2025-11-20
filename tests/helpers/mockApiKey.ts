/**
 * Mock API keys and JWT tokens for testing
 */

import { signAccessJwt } from "@/lib/jwt";

export interface MockApiKeyOptions {
  id?: string;
  userId?: string;
  organizationId?: string;
  name?: string;
  prefix?: string;
  secretHash?: string;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  lastUsedAt?: Date | null;
  createdAt?: Date;
}

/**
 * Create a mock API key object (database model)
 */
export function mockApiKey(options: MockApiKeyOptions = {}) {
  return {
    id: options.id || "api-key-id",
    userId: options.userId || "test-user-id",
    organizationId: options.organizationId || "test-org-id",
    name: options.name || "Test API Key",
    prefix: options.prefix || "sk_test",
    secretHash: options.secretHash || "$2b$12$hashedapikeysecret",
    expiresAt: options.expiresAt !== undefined ? options.expiresAt : null,
    revokedAt: options.revokedAt !== undefined ? options.revokedAt : null,
    lastUsedAt: options.lastUsedAt !== undefined ? options.lastUsedAt : null,
    createdAt: options.createdAt || new Date(),
  };
}

/**
 * Create a mock expired API key
 */
export function mockExpiredApiKey(options: MockApiKeyOptions = {}) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return mockApiKey({
    ...options,
    expiresAt: yesterday,
  });
}

/**
 * Create a mock revoked API key
 */
export function mockRevokedApiKey(options: MockApiKeyOptions = {}) {
  return mockApiKey({
    ...options,
    revokedAt: new Date(),
  });
}

/**
 * Generate a valid Bearer token for testing
 */
export async function generateTestBearerToken(
  userId: string = "test-user-id",
  organizationId: string = "test-org-id",
  options: {
    email?: string;
    role?: string;
    sessionVersion?: number;
    apiKeyId?: string;
  } = {}
): Promise<string> {
  const {
    email = "test@example.com",
    role = "USER",
    sessionVersion = 1,
    apiKeyId = "test-api-key-id",
  } = options;

  return signAccessJwt({
    sub: userId,
    email,
    role,
    tokenVersion: sessionVersion,
    authMethod: "api_key",
    apiKeyId,
    organizationId,
  });
}

/**
 * Generate a cookie-based access token (no API key context)
 */
export async function generateTestCookieToken(
  userId: string = "test-user-id",
  options: {
    email?: string;
    role?: string;
    sessionVersion?: number;
  } = {}
): Promise<string> {
  const {
    email = "test@example.com",
    role = "USER",
    sessionVersion = 1,
  } = options;

  return signAccessJwt({
    sub: userId,
    email,
    role,
    tokenVersion: sessionVersion,
  });
}

/**
 * Generate an invalid/malformed JWT token
 */
export function generateInvalidToken(): string {
  return "invalid.jwt.token";
}

/**
 * Generate an expired JWT token
 */
export async function generateExpiredToken(
  userId: string = "test-user-id",
  organizationId: string = "test-org-id"
): Promise<string> {
  // Note: This would need custom JWT signing with expired time
  // For now, return a token that we can mock as expired in tests
  return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJleHAiOjE2MDAwMDAwMDB9.expired";
}
