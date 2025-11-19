import { db } from "@/lib/db";
import {
  getAccessToken,
  getRefreshToken,
  verifyAccessJwt,
  verifyRefreshJwt,
  signAccessJwt,
  signRefreshJwt,
  setAccessCookie,
  setRefreshCookie,
} from "@/lib/jwt";

/**
 * Auth helpers for server components and route handlers
 * getCurrentUser, refresh token rotation, safe redirect
 */

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  emailVerifiedAt: Date | null;
  passwordHash: string | null;
  sessionVersion: number;
  defaultOrganizationId: string | null;
  apiKeyOrganizationId?: string | null; // Set when auth via API key, restricts org access
};

/**
 * Get authentication token from request
 * Checks Authorization header (Bearer token) first, then falls back to cookies
 * This enables both cookie-based (browser) and header-based (API key) authentication
 */
export async function getAuthFromRequest(
  request?: Request
): Promise<string | null | undefined> {
  // Check Authorization header first (for API key / Bearer token auth)
  if (request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.slice(7); // Remove "Bearer " prefix
    }
  }

  // Fall back to cookie-based auth
  return await getAccessToken();
}

/**
 * Get current user from access token
 * Verifies JWT and checks sessionVersion against DB
 * Returns null if invalid or session revoked
 *
 * Supports both cookie-based auth (browser) and Bearer token auth (API keys):
 * - Pass request parameter to enable Bearer token support
 * - Omit request parameter to use cookie-only auth (server components)
 */
export async function getCurrentUser(
  request?: Request
): Promise<CurrentUser | null> {
  try {
    const token = await getAuthFromRequest(request);
    if (!token) return null;

    const payload = await verifyAccessJwt(token);

    // Load user from DB
    const user = await db.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) return null;

    // Check sessionVersion
    if (user.sessionVersion !== payload.tokenVersion) {
      return null; // Session invalidated
    }

    // For API key authentication, verify the key is still valid
    if (payload.authMethod === "api_key" && payload.apiKeyId) {
      const apiKey = await db.apiKey.findUnique({
        where: { id: payload.apiKeyId },
      });

      // Reject if key doesn't exist, is revoked, or has expired
      if (!apiKey || apiKey.revokedAt !== null) {
        return null;
      }

      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        return null;
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt,
      passwordHash: user.passwordHash,
      sessionVersion: user.sessionVersion,
      defaultOrganizationId: user.defaultOrganizationId,
      apiKeyOrganizationId: payload.authMethod === "api_key" ? payload.organizationId : null,
    };
  } catch {
    return null;
  }
}

/**
 * Refresh access + refresh tokens from refresh token
 * Validates sessionVersion and rotates both cookies
 */
export async function refreshFromRefreshToken(): Promise<{
  success: boolean;
  user?: CurrentUser;
}> {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return { success: false };

    const payload = await verifyRefreshJwt(refreshToken);

    // Load user
    const user = await db.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) return { success: false };

    // Check sessionVersion
    if (user.sessionVersion !== payload.tokenVersion) {
      return { success: false }; // Session invalidated
    }

    // Generate new tokens
    const newAccessToken = await signAccessJwt({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.sessionVersion,
    });

    const newRefreshToken = await signRefreshJwt({
      sub: user.id,
      tokenVersion: user.sessionVersion,
    });

    // Set cookies
    await setAccessCookie(newAccessToken);
    await setRefreshCookie(newRefreshToken);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
        passwordHash: user.passwordHash,
        sessionVersion: user.sessionVersion,
        defaultOrganizationId: user.defaultOrganizationId,
      },
    };
  } catch {
    return { success: false };
  }
}

/**
 * Safe redirect: ensure path is internal
 * Returns provided path if valid, otherwise / (which triggers org redirect logic)
 */
export function safeRedirect(next?: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

/**
 * Get client IP from request
 */
export function getClientIp(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return undefined;
}

/**
 * Create access token from API key
 * Used by the API key exchange endpoint
 */
export async function createAccessTokenFromApiKey(params: {
  apiKeyId: string;
  userId: string;
  userEmail: string;
  userRole: string;
  sessionVersion: number;
  organizationId: string;
}): Promise<string> {
  const {
    apiKeyId,
    userId,
    userEmail,
    userRole,
    sessionVersion,
    organizationId,
  } = params;

  return signAccessJwt({
    sub: userId,
    email: userEmail,
    role: userRole,
    tokenVersion: sessionVersion,
    authMethod: "api_key",
    apiKeyId,
    organizationId,
  });
}

/**
 * Get current user from Bearer token (for API key auth)
 * Similar to getCurrentUser but accepts a token parameter
 */
export async function getUserFromBearerToken(
  token: string
): Promise<CurrentUser | null> {
  try {
    const payload = await verifyAccessJwt(token);

    // Load user from DB
    const user = await db.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) return null;

    // Check sessionVersion
    if (user.sessionVersion !== payload.tokenVersion) {
      return null; // Session invalidated
    }

    // For API key authentication, verify the key is still valid
    if (payload.authMethod === "api_key" && payload.apiKeyId) {
      const apiKey = await db.apiKey.findUnique({
        where: { id: payload.apiKeyId },
      });

      // Reject if key doesn't exist, is revoked, or has expired
      if (!apiKey || apiKey.revokedAt !== null) {
        return null;
      }

      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        return null;
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt,
      passwordHash: user.passwordHash,
      sessionVersion: user.sessionVersion,
      defaultOrganizationId: user.defaultOrganizationId,
      apiKeyOrganizationId: payload.authMethod === "api_key" ? payload.organizationId : null,
    };
  } catch {
    return null;
  }
}

/**
 * Validate that an API key user has access to the requested organization
 * Returns true if:
 * - User is not authenticated via API key (regular auth, no restriction)
 * - User's API key organization matches the requested organization
 * Returns false if API key is scoped to a different organization
 */
export function validateApiKeyOrgAccess(
  user: CurrentUser,
  requestedOrgId: string
): boolean {
  // If not API key auth, allow access (regular cookie-based auth)
  if (!user.apiKeyOrganizationId) {
    return true;
  }

  // If API key auth, verify the organization matches
  return user.apiKeyOrganizationId === requestedOrgId;
}
