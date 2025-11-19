import { NextResponse } from "next/server";
import { getCurrentUser, getClientIp, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { revokeApiKey, createApiKeyAuditLog } from "@/lib/api-keys";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/auth/api-keys/:id/revoke
 * Revoke an API key
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    // Authenticate (supports both cookie and Bearer token)
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const apiKeyId = params.id;

    // Load the API key to verify ownership
    const existingKey = await db.apiKey.findUnique({
      where: { id: apiKeyId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!existingKey) {
      return NextResponse.json(
        { error: "not_found", message: "API key not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (existingKey.userId !== user.id) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied to this API key" },
        { status: 403 }
      );
    }

    // For API key auth, verify organization constraint
    if (!validateApiKeyOrgAccess(user, existingKey.organizationId)) {
      return NextResponse.json(
        { error: "forbidden", message: "API key not authorized for this organization" },
        { status: 403 }
      );
    }

    // Check if already revoked
    if (existingKey.revokedAt) {
      return NextResponse.json(
        { error: "already_revoked", message: "API key is already revoked" },
        { status: 400 }
      );
    }

    // Revoke the key
    const revokedKey = await revokeApiKey(apiKeyId);

    // Audit log
    const ip = getClientIp(request);
    await createApiKeyAuditLog({
      action: "api_key_revoked",
      userId: user.id,
      organizationId: existingKey.organizationId,
      email: user.email,
      ip,
      metadata: {
        apiKeyId: revokedKey.id,
        apiKeyPrefix: revokedKey.prefix,
        apiKeyName: revokedKey.name,
      },
    });

    // Return revoked key metadata
    return NextResponse.json(
      {
        apiKey: {
          id: revokedKey.id,
          name: revokedKey.name,
          prefix: revokedKey.prefix,
          organizationId: revokedKey.organizationId,
          organization: existingKey.organization,
          revokedAt: revokedKey.revokedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Revoke API key error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to revoke API key" },
      { status: 500 }
    );
  }
}
