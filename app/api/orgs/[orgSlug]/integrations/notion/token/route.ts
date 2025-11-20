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

const tokenUpdateSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

/**
 * PATCH /api/orgs/[orgSlug]/integrations/notion/token
 * Rotate Notion internal integration token
 * Requires: Admin or Superadmin role, CSRF validation, existing internal connection
 */
export async function PATCH(
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
    const user = await getCurrentUser(request);

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
    const parseResult = tokenUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0].message },
        { status: 400 }
      );
    }

    const { token } = parseResult.data;

    // Check if a Notion internal integration exists
    const existingIntegration = await db.organizationIntegration.findUnique({
      where: {
        organizationId_provider: {
          organizationId: org.id,
          provider: "notion",
        },
      },
    });

    if (!existingIntegration) {
      return NextResponse.json(
        { error: "No Notion integration found for this organization" },
        { status: 404 }
      );
    }

    if (existingIntegration.connectionType !== "internal") {
      return NextResponse.json(
        {
          error:
            "Token rotation is only available for internal integrations. This is a public OAuth integration.",
        },
        { status: 409 }
      );
    }

    // Verify new token with Notion API
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

    // Extract account info (to optionally refresh workspace name)
    const accountName =
      userData.bot?.workspace_name || userData.name || "Notion Workspace";

    // Update integration with new token
    await db.organizationIntegration.update({
      where: { id: existingIntegration.id },
      data: {
        encryptedAccessToken: encryptSecret(token),
        accountName, // Refresh workspace name
        status: "connected", // Reset to connected if it was in error state
        updatedByUserId: user.id,
        updatedAt: new Date(),
      },
    });

    // Log audit event
    await db.auditLog.create({
      data: {
        action: "integration.token_rotated",
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
    console.error("Error rotating Notion token:", error);
    return NextResponse.json(
      { error: "Failed to rotate token" },
      { status: 500 }
    );
  }
}
