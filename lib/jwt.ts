import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * JWT utilities for Node.js runtime
 * Handles access and refresh tokens with HTTP-only cookies
 */

// JWT payload types
export type AccessTokenPayload = {
  sub: string; // user ID
  email: string;
  role: string;
  tokenVersion: number;
};

export type RefreshTokenPayload = {
  sub: string; // user ID
  tokenVersion: number;
};

// Secret as Uint8Array for jose
const secret = new TextEncoder().encode(env.JWT_SECRET);

/**
 * Sign an access JWT (~1 hour expiry)
 */
export async function signAccessJwt(
  payload: AccessTokenPayload
): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

/**
 * Sign a refresh JWT (~14 days expiry)
 */
export async function signRefreshJwt(
  payload: RefreshTokenPayload
): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secret);
}

/**
 * Verify and decode an access JWT
 */
export async function verifyAccessJwt(
  token: string
): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as AccessTokenPayload;
  } catch {
    throw new Error("Invalid or expired access token");
  }
}

/**
 * Verify and decode a refresh JWT
 */
export async function verifyRefreshJwt(
  token: string
): Promise<RefreshTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as RefreshTokenPayload;
  } catch {
    throw new Error("Invalid or expired refresh token");
  }
}

/**
 * Set access token cookie
 *
 * SameSite strategy:
 * - strict: Maximum security, but breaks OAuth flows (cookie not sent on redirect)
 * - lax: Default; allows cookies on top-level cross-site redirects (required for OAuth)
 * - none: Allows all cross-site requests; requires HTTPS (secure=true)
 */
export async function setAccessCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  const sameSite = env.AUTH_SAMESITE_STRATEGY;
  const isProduction = process.env.NODE_ENV === "production";

  cookieStore.set(env.JWT_ACCESS_COOKIE_NAME, token, {
    httpOnly: true,
    secure: sameSite === "none" ? true : isProduction,
    sameSite,
    path: "/",
    maxAge: 60 * 60, // 1 hour
  });
}

/**
 * Set refresh token cookie
 *
 * Uses the same SameSite strategy as access token to ensure
 * consistent behavior across OAuth flows.
 */
export async function setRefreshCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  const sameSite = env.AUTH_SAMESITE_STRATEGY;
  const isProduction = process.env.NODE_ENV === "production";

  cookieStore.set(env.JWT_REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: sameSite === "none" ? true : isProduction,
    sameSite,
    path: "/",
    maxAge: 60 * 60 * 24 * 14, // 14 days
  });
}

/**
 * Clear both auth cookies
 */
export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(env.JWT_ACCESS_COOKIE_NAME);
  cookieStore.delete(env.JWT_REFRESH_COOKIE_NAME);
}

/**
 * Get access token from cookie
 */
export async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(env.JWT_ACCESS_COOKIE_NAME)?.value;
}

/**
 * Get refresh token from cookie
 */
export async function getRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(env.JWT_REFRESH_COOKIE_NAME)?.value;
}
