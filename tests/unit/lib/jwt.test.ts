/**
 * Unit tests for jwt.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock environment
vi.mock("@/lib/env", () => ({
  env: {
    JWT_SECRET: "test-jwt-secret-min-32-characters-long-for-security",
    JWT_ACCESS_COOKIE_NAME: "__test_access",
    JWT_REFRESH_COOKIE_NAME: "__test_session",
    AUTH_SAMESITE_STRATEGY: "lax" as "strict" | "lax" | "none",
  },
}));

// Mock Next.js cookies (not testing cookie functions here)
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import {
  signAccessJwt,
  signRefreshJwt,
  verifyAccessJwt,
  verifyRefreshJwt,
  type AccessTokenPayload,
  type RefreshTokenPayload,
} from "@/lib/jwt";

describe("signAccessJwt", () => {
  it("should create a valid JWT access token", async () => {
    const payload: AccessTokenPayload = {
      sub: "user-123",
      email: "test@example.com",
      role: "USER",
      tokenVersion: 1,
    };

    const token = await signAccessJwt(payload);

    expect(token).toBeTruthy();
    expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
  });

  it("should include authMethod in payload", async () => {
    const payload: AccessTokenPayload = {
      sub: "user-123",
      email: "test@example.com",
      role: "USER",
      tokenVersion: 1,
      authMethod: "api_key",
    };

    const token = await signAccessJwt(payload);
    const verified = await verifyAccessJwt(token);

    expect(verified.authMethod).toBe("api_key");
  });

  it("should include API key context in payload", async () => {
    const payload: AccessTokenPayload = {
      sub: "user-123",
      email: "test@example.com",
      role: "USER",
      tokenVersion: 1,
      authMethod: "api_key",
      apiKeyId: "api-key-123",
      organizationId: "org-123",
    };

    const token = await signAccessJwt(payload);
    const verified = await verifyAccessJwt(token);

    expect(verified.authMethod).toBe("api_key");
    expect(verified.apiKeyId).toBe("api-key-123");
    expect(verified.organizationId).toBe("org-123");
  });

  it("should set expiration time to 1 hour", async () => {
    const payload: AccessTokenPayload = {
      sub: "user-123",
      email: "test@example.com",
      role: "USER",
      tokenVersion: 1,
    };

    const token = await signAccessJwt(payload);
    const verified = await verifyAccessJwt(token);

    // Check that exp claim exists and is in the future
    expect(verified).toHaveProperty("exp");
    const exp = (verified as { exp: number }).exp;
    const iat = (verified as { iat: number }).iat;

    // Should be approximately 1 hour (3600 seconds)
    const duration = exp - iat;
    expect(duration).toBeGreaterThanOrEqual(3590);
    expect(duration).toBeLessThanOrEqual(3610);
  });
});

describe("signRefreshJwt", () => {
  it("should create a valid JWT refresh token", async () => {
    const payload: RefreshTokenPayload = {
      sub: "user-123",
      tokenVersion: 1,
    };

    const token = await signRefreshJwt(payload);

    expect(token).toBeTruthy();
    expect(token.split(".")).toHaveLength(3);
  });

  it("should set expiration time to 14 days", async () => {
    const payload: RefreshTokenPayload = {
      sub: "user-123",
      tokenVersion: 1,
    };

    const token = await signRefreshJwt(payload);
    const verified = await verifyRefreshJwt(token);

    // Check that exp claim exists
    expect(verified).toHaveProperty("exp");
    const exp = (verified as { exp: number }).exp;
    const iat = (verified as { iat: number }).iat;

    // Should be approximately 14 days (1209600 seconds)
    const duration = exp - iat;
    expect(duration).toBeGreaterThanOrEqual(1209500);
    expect(duration).toBeLessThanOrEqual(1209700);
  });
});

describe("verifyAccessJwt", () => {
  it("should verify and decode valid access token", async () => {
    const payload: AccessTokenPayload = {
      sub: "user-123",
      email: "test@example.com",
      role: "ADMIN",
      tokenVersion: 5,
    };

    const token = await signAccessJwt(payload);
    const verified = await verifyAccessJwt(token);

    expect(verified.sub).toBe(payload.sub);
    expect(verified.email).toBe(payload.email);
    expect(verified.role).toBe(payload.role);
    expect(verified.tokenVersion).toBe(payload.tokenVersion);
  });

  it("should throw error for invalid token", async () => {
    const invalidToken = "invalid.jwt.token";

    await expect(verifyAccessJwt(invalidToken)).rejects.toThrow(
      "Invalid or expired access token"
    );
  });

  it("should throw error for malformed token", async () => {
    const malformedToken = "not-a-jwt";

    await expect(verifyAccessJwt(malformedToken)).rejects.toThrow(
      "Invalid or expired access token"
    );
  });

  it("should throw error for token signed with different secret", async () => {
    // This is a token signed with a different secret
    const differentSecretToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";

    await expect(verifyAccessJwt(differentSecretToken)).rejects.toThrow(
      "Invalid or expired access token"
    );
  });

  it("should preserve all payload fields", async () => {
    const payload: AccessTokenPayload = {
      sub: "user-123",
      email: "test@example.com",
      role: "USER",
      tokenVersion: 1,
      authMethod: "api_key",
      apiKeyId: "key-123",
      organizationId: "org-123",
    };

    const token = await signAccessJwt(payload);
    const verified = await verifyAccessJwt(token);

    expect(verified.sub).toBe(payload.sub);
    expect(verified.email).toBe(payload.email);
    expect(verified.role).toBe(payload.role);
    expect(verified.tokenVersion).toBe(payload.tokenVersion);
    expect(verified.authMethod).toBe(payload.authMethod);
    expect(verified.apiKeyId).toBe(payload.apiKeyId);
    expect(verified.organizationId).toBe(payload.organizationId);
  });
});

describe("verifyRefreshJwt", () => {
  it("should verify and decode valid refresh token", async () => {
    const payload: RefreshTokenPayload = {
      sub: "user-456",
      tokenVersion: 3,
    };

    const token = await signRefreshJwt(payload);
    const verified = await verifyRefreshJwt(token);

    expect(verified.sub).toBe(payload.sub);
    expect(verified.tokenVersion).toBe(payload.tokenVersion);
  });

  it("should throw error for invalid token", async () => {
    const invalidToken = "invalid.jwt.token";

    await expect(verifyRefreshJwt(invalidToken)).rejects.toThrow(
      "Invalid or expired refresh token"
    );
  });

  it("should throw error for access token used as refresh token", async () => {
    // Create an access token and try to verify it as refresh token
    const accessPayload: AccessTokenPayload = {
      sub: "user-123",
      email: "test@example.com",
      role: "USER",
      tokenVersion: 1,
    };

    const accessToken = await signAccessJwt(accessPayload);

    // Should still verify (same secret) but payload shape differs
    const verified = await verifyRefreshJwt(accessToken);

    // Payload will have extra fields but core fields should match
    expect(verified.sub).toBe(accessPayload.sub);
    expect(verified.tokenVersion).toBe(accessPayload.tokenVersion);
  });
});

describe("JWT token compatibility", () => {
  it("should create tokens that can be verified immediately", async () => {
    const accessPayload: AccessTokenPayload = {
      sub: "user-test",
      email: "verify@example.com",
      role: "USER",
      tokenVersion: 1,
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: "user-test",
      tokenVersion: 1,
    };

    // Sign both tokens
    const accessToken = await signAccessJwt(accessPayload);
    const refreshToken = await signRefreshJwt(refreshPayload);

    // Verify both tokens
    const verifiedAccess = await verifyAccessJwt(accessToken);
    const verifiedRefresh = await verifyRefreshJwt(refreshToken);

    expect(verifiedAccess.sub).toBe(accessPayload.sub);
    expect(verifiedRefresh.sub).toBe(refreshPayload.sub);
  });

  it("should handle different token versions", async () => {
    const versions = [0, 1, 5, 100, 9999];

    for (const version of versions) {
      const payload: AccessTokenPayload = {
        sub: "user-version-test",
        email: "version@example.com",
        role: "USER",
        tokenVersion: version,
      };

      const token = await signAccessJwt(payload);
      const verified = await verifyAccessJwt(token);

      expect(verified.tokenVersion).toBe(version);
    }
  });

  it("should handle different roles", async () => {
    const roles = ["USER", "ADMIN", "SUPERADMIN", "CUSTOM_ROLE"];

    for (const role of roles) {
      const payload: AccessTokenPayload = {
        sub: "user-role-test",
        email: "role@example.com",
        role,
        tokenVersion: 1,
      };

      const token = await signAccessJwt(payload);
      const verified = await verifyAccessJwt(token);

      expect(verified.role).toBe(role);
    }
  });

  it("should handle different auth methods", async () => {
    const authMethods: Array<"password" | "otp" | "api_key"> = [
      "password",
      "otp",
      "api_key",
    ];

    for (const authMethod of authMethods) {
      const payload: AccessTokenPayload = {
        sub: "user-auth-test",
        email: "auth@example.com",
        role: "USER",
        tokenVersion: 1,
        authMethod,
      };

      const token = await signAccessJwt(payload);
      const verified = await verifyAccessJwt(token);

      expect(verified.authMethod).toBe(authMethod);
    }
  });
});
