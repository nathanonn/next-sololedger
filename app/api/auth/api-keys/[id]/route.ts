import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getClientIp } from "@/lib/auth-helpers";
import {
  updateApiKeyScopesAndExpiry,
  createApiKeyAuditLog,
} from "@/lib/api-keys";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * PATCH /api/auth/api-keys/:id
 * Update an API key (name, scopes, expiry)
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    // Authenticate
    const user = await getCurrentUser();
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

    // Parse and validate body
    const updateSchema = z.object({
      name: z.string().min(1).max(255).optional(),
      scopes: z.array(z.string()).optional().nullable(),
      expiresAt: z.string().datetime().optional().nullable(),
    });

    const body = await request.json();
    const validation = updateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "Invalid request body",
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { name, scopes, expiresAt } = validation.data;

    // Update API key
    const updatedKey = await updateApiKeyScopesAndExpiry({
      apiKeyId,
      name,
      scopes: scopes !== undefined ? scopes : undefined,
      expiresAt: expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : undefined,
    });

    // Audit log
    const ip = getClientIp(request);
    await createApiKeyAuditLog({
      action: "api_key_updated",
      userId: user.id,
      organizationId: existingKey.organizationId,
      email: user.email,
      ip,
      metadata: {
        apiKeyId: updatedKey.id,
        apiKeyPrefix: updatedKey.prefix,
        apiKeyName: updatedKey.name,
        changes: { name, scopes, expiresAt },
      },
    });

    // Return updated key metadata
    return NextResponse.json(
      {
        apiKey: {
          id: updatedKey.id,
          name: updatedKey.name,
          prefix: updatedKey.prefix,
          organizationId: updatedKey.organizationId,
          organization: existingKey.organization,
          scopes: updatedKey.scopes,
          expiresAt: updatedKey.expiresAt,
          lastUsedAt: updatedKey.lastUsedAt,
          revokedAt: updatedKey.revokedAt,
          createdAt: updatedKey.createdAt,
          updatedAt: updatedKey.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update API key error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to update API key" },
      { status: 500 }
    );
  }
}
