import { NextResponse } from "next/server";
import {
  findActiveApiKeyByFullKey,
  updateApiKeyLastUsed,
  createApiKeyAuditLog,
} from "@/lib/api-keys";
import { createAccessTokenFromApiKey, getClientIp } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/auth/api-key/exchange
 * Exchange a personal API key for a short-lived JWT access token
 *
 * Request:
 *   Authorization: ApiKey <fullKey>
 *
 * Response:
 *   {
 *     accessToken: string,
 *     tokenType: "Bearer",
 *     expiresIn: number (seconds)
 *   }
 */
export async function POST(request: Request): Promise<Response> {
  try {
    // Rate limiting: 10 exchanges per minute per IP
    const ip = getClientIp(request) || "unknown";
    const rateLimitKey = `api_key_exchange:${ip}`;
    const rateLimitResult = await rateLimit(rateLimitKey, 10, 60);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message: "Too many API key exchange attempts. Please try again later.",
        },
        { status: 429 }
      );
    }

    // Parse Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("ApiKey ")) {
      return NextResponse.json(
        {
          error: "invalid_request",
          message: 'Missing or invalid Authorization header. Expected format: "ApiKey <key>"',
        },
        { status: 401 }
      );
    }

    const fullKey = authHeader.slice(7); // Remove "ApiKey " prefix

    // Find and validate the API key
    const apiKey = await findActiveApiKeyByFullKey(fullKey);

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "invalid_api_key",
          message: "The API key is invalid, revoked, or expired.",
        },
        { status: 401 }
      );
    }

    // Create access token
    const accessToken = await createAccessTokenFromApiKey({
      apiKeyId: apiKey.id,
      userId: apiKey.user.id,
      userEmail: apiKey.user.email,
      userRole: apiKey.user.role,
      sessionVersion: apiKey.user.sessionVersion,
      organizationId: apiKey.organizationId,
    });

    // Update last used timestamp (async, no await)
    updateApiKeyLastUsed(apiKey.id).catch((err) => {
      console.error("Failed to update API key last used:", err);
    });

    // Audit log (async, no await)
    createApiKeyAuditLog({
      action: "api_key_exchanged",
      userId: apiKey.userId,
      organizationId: apiKey.organizationId,
      email: apiKey.user.email,
      ip,
      metadata: {
        apiKeyId: apiKey.id,
        apiKeyPrefix: apiKey.prefix,
        apiKeyName: apiKey.name,
      },
    }).catch((err) => {
      console.error("Failed to create audit log:", err);
    });

    // Return access token
    return NextResponse.json(
      {
        accessToken,
        tokenType: "Bearer",
        expiresIn: 3600, // 1 hour in seconds
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("API key exchange error:", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message: "An internal error occurred during API key exchange.",
      },
      { status: 500 }
    );
  }
}
