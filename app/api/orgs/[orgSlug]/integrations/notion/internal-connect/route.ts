import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { validateCsrf } from "@/lib/csrf";
import { env } from "@/lib/env";
import { getNotionVariantFlags, getProviderConfig } from "@/lib/integrations/providers";
import { encryptSecret } from "@/lib/secrets";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const connectSchema = z.object({
  token: z.string().min(1, "Token is required"),
  workspaceId: z.string().optional(),
});

/**
 * POST /api/orgs/[orgSlug]/integrations/notion/internal-connect
 * Connect Notion using an internal integration token
 * Requires: Admin or Superadmin role, CSRF validation, notion_internal enabled
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    if (!env.INTEGRATIONS_ENABLED) {
      return NextResponse.json(
        { error: "Integrations are disabled" },
        { status: 404 }
      );
    }

    // Verify notion_internal is enabled
    const notionVariants = getNotionVariantFlags();
    if (!notionVariants.internal) {
      return NextResponse.json(
        { error: "Notion internal integration is not enabled" },
        { status: 400 }
      );
    }

    // CSRF validation
    const csrfError = await validateCsrf(request);
    if (csrfError) {
      return NextResponse.json({ error: csrfError }, { status: 403 });
    }

    const { orgSlug } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Verify user is admin or superadmin
    try {
      await requireAdminOrSuperadmin(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Admin or superadmin access required" },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await request.json();
    const parseResult = connectSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0].message },
        { status: 400 }
      );
    }

    const { token, workspaceId } = parseResult.data;

    // Check if a Notion integration already exists
    const existingIntegration = await db.organizationIntegration.findUnique({
      where: {
        organizationId_provider: {
          organizationId: org.id,
          provider: "notion",
        },
      },
    });

    if (existingIntegration) {
      return NextResponse.json(
        {
          error:
            "A Notion integration already exists for this organization. Disconnect it before switching the connection type.",
        },
        { status: 409 }
      );
    }

    // Verify token with Notion API
    const config = getProviderConfig("notion");
    const verifyResponse = await fetch(`${config.baseUrl}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": config.defaultHeaders["Notion-Version"],
      },
    });

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error("Notion token verification failed:", errorText);
      return NextResponse.json(
        { error: "Invalid or expired Notion token" },
        { status: 400 }
      );
    }

    const userData = await verifyResponse.json();

    // Extract account info (bot id and workspace name)
    const accountId = userData.bot?.id || userData.id;
    const accountName =
      userData.bot?.workspace_name || userData.name || "Notion Workspace";

    // Create integration
    await db.organizationIntegration.create({
      data: {
        organizationId: org.id,
        provider: "notion",
        connectionType: "internal",
        status: "connected",
        accountId,
        accountName,
        workspaceId: workspaceId || null,
        encryptedAccessToken: encryptSecret(token),
        encryptedRefreshToken: null,
        tokenType: "bearer",
        expiresAt: null,
        scope: null,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
    });

    // Log audit event
    await db.auditLog.create({
      data: {
        action: "integration.connected",
        userId: user.id,
        email: user.email,
        organizationId: org.id,
        metadata: {
          provider: "notion",
          connectionType: "internal",
          accountName,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error connecting Notion internal integration:", error);
    return NextResponse.json(
      { error: "Failed to connect integration" },
      { status: 500 }
    );
  }
}
