import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessJwtSignatureOnly } from "@/lib/jwt-edge";

/**
 * Edge middleware for route protection
 * Validates JWT signature only (no DB access)
 * Cooperates with /api/auth/refresh for token rotation
 */

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/invite",
  "/api/auth/request-otp",
  "/api/auth/verify-otp",
  "/api/auth/dev-signin",
  "/api/auth/signout",
  "/api/auth/refresh",
  "/api/auth/api-key/exchange",
];

// Paths that should always be accessible
const ALWAYS_ACCESSIBLE = [
  "/_next",
  "/favicon.ico",
  "/assets",
];

export async function middleware(request: NextRequest): Promise<Response> {
  const { pathname } = request.nextUrl;

  // Allow always-accessible paths
  if (ALWAYS_ACCESSIBLE.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Get JWT secret from env
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    console.error("JWT_SECRET not configured or too short");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protected paths: /o/, /onboarding, /admin
  const isProtected =
    pathname.startsWith("/o/") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/admin");

  if (isProtected) {
    // Get access cookie
    const accessCookieName = process.env.JWT_ACCESS_COOKIE_NAME || "__access";
    const refreshCookieName = process.env.JWT_REFRESH_COOKIE_NAME || "__session";

    const accessToken = request.cookies.get(accessCookieName)?.value;
    const refreshToken = request.cookies.get(refreshCookieName)?.value;

    // Try to verify access token
    if (accessToken) {
      const payload = await verifyAccessJwtSignatureOnly(accessToken, jwtSecret);
      if (payload) {
        // Valid access token - allow through
        // Add security headers
        const response = NextResponse.next();
        response.headers.set("X-Content-Type-Options", "nosniff");
        response.headers.set("X-Frame-Options", "SAMEORIGIN");
        response.headers.set("X-XSS-Protection", "1; mode=block");
        response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
        return response;
      }
    }

    // Access token invalid/missing - try refresh token
    if (refreshToken) {
      // Rewrite to refresh endpoint
      // The refresh endpoint will rotate tokens and redirect back
      const url = new URL("/api/auth/refresh", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.rewrite(url);
    }

    // No valid tokens - redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Default: allow through with security headers
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
