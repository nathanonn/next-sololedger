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
  type AccessTokenPayload,
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
};

/**
 * Get current user from access token
 * Verifies JWT and checks sessionVersion against DB
 * Returns null if invalid or session revoked
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const token = await getAccessToken();
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

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt,
      passwordHash: user.passwordHash,
      sessionVersion: user.sessionVersion,
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
      },
    };
  } catch {
    return { success: false };
  }
}

/**
 * Safe redirect: ensure path is internal
 * Returns provided path if valid, otherwise /dashboard
 */
export function safeRedirect(next?: string | null): string {
  if (!next) return "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
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
