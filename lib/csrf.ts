import { env } from "@/lib/env";

/**
 * CSRF protection via Origin/Referer validation
 * Validates request origin against allowlist
 */

/**
 * Check if request origin is valid
 * Validates against APP_URL and optional ALLOWED_ORIGINS
 * In development, also allows localhost variants
 */
export function isRequestOriginValid(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // Use origin if present, otherwise fallback to referer
  const requestOrigin = origin || (referer ? new URL(referer).origin : null);

  if (!requestOrigin) {
    return false;
  }

  // Build allowlist
  const allowedOrigins = new Set<string>();

  // Always allow APP_URL
  allowedOrigins.add(env.APP_URL);

  // Add optional ALLOWED_ORIGINS
  if (env.ALLOWED_ORIGINS) {
    env.ALLOWED_ORIGINS.split(",").forEach((o) => {
      const trimmed = o.trim();
      if (trimmed) allowedOrigins.add(trimmed);
    });
  }

  // In development, allow localhost variants
  if (env.NODE_ENV === "development") {
    allowedOrigins.add("http://localhost:3000");
    allowedOrigins.add("http://localhost:3001");
    allowedOrigins.add("http://127.0.0.1:3000");
    allowedOrigins.add("http://127.0.0.1:3001");
  }

  return allowedOrigins.has(requestOrigin);
}
