import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getClientIp, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import {
  createApiKey,
  listApiKeysForUser,
  createApiKeyAuditLog,
} from "@/lib/api-keys";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/auth/api-keys
 * List all API keys for the current user
 * Optionally filter by organizationId
 */
export async function GET(request: Request): Promise<Response> {
  try {
    // Authenticate (supports both cookie and Bearer token)
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId") || undefined;

    // If organizationId is provided, verify user is a member
    if (organizationId) {
      // For API key auth, verify organization constraint
      if (!validateApiKeyOrgAccess(user, organizationId)) {
        return NextResponse.json(
          { error: "forbidden", message: "API key not authorized for this organization" },
          { status: 403 }
        );
      }

      const membership = await db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId,
          },
        },
      });

      if (!membership) {
        return NextResponse.json(
          { error: "forbidden", message: "Access denied to this organization" },
          { status: 403 }
        );
      }
    }

    // List API keys
    const apiKeys = await listApiKeysForUser(user.id, organizationId);

    return NextResponse.json({ apiKeys }, { status: 200 });
  } catch (error) {
    console.error("List API keys error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to list API keys" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/api-keys
 * Create a new API key
 */
export async function POST(request: Request): Promise<Response> {
  try {
    // Authenticate (supports both cookie and Bearer token)
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse and validate body
    const createSchema = z.object({
      name: z.string().min(1).max(255),
      organizationId: z.string().cuid(),
      scopes: z.array(z.string()).optional().nullable(),
      expiresAt: z.string().datetime().optional().nullable(),
    });

    const body = await request.json();
    const validation = createSchema.safeParse(body);

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

    const { name, organizationId, scopes, expiresAt } = validation.data;

    // For API key auth, verify organization constraint
    if (!validateApiKeyOrgAccess(user, organizationId)) {
      return NextResponse.json(
        { error: "forbidden", message: "API key not authorized for this organization" },
        { status: 403 }
      );
    }

    // Verify user is a member of the organization
    const membership = await db.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId,
        },
      },
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

    if (!membership) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied to this organization" },
        { status: 403 }
      );
    }

    // Create API key
    const { apiKey, fullKey } = await createApiKey({
      userId: user.id,
      organizationId,
      name,
      scopes: scopes || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    // Audit log
    const ip = getClientIp(request);
    await createApiKeyAuditLog({
      action: "api_key_created",
      userId: user.id,
      organizationId,
      email: user.email,
      ip,
      metadata: {
        apiKeyId: apiKey.id,
        apiKeyPrefix: apiKey.prefix,
        apiKeyName: apiKey.name,
      },
    });

    // Return key metadata + full key (shown only once)
    return NextResponse.json(
      {
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          prefix: apiKey.prefix,
          organizationId: apiKey.organizationId,
          organization: membership.organization,
          scopes: apiKey.scopes,
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt,
        },
        fullKey, // Only shown once
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create API key error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to create API key" },
      { status: 500 }
    );
  }
}
