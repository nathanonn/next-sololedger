import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { validateCsrf } from "@/lib/csrf";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isIntegrationAllowed, PROVIDER_INFO } from "@/lib/integrations/providers";
import { revokeIntegration } from "@/lib/integrations/oauth";
import type { IntegrationProvider } from "@/lib/integrations/providers";

export const runtime = "nodejs";

/**
 * DELETE /api/orgs/[orgSlug]/integrations/[provider]
 * Disconnect an integration (revoke tokens and delete from database)
 * Requires: Admin or Superadmin role, CSRF validation
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; provider: string }> }
): Promise<Response> {
  try {
    if (!env.INTEGRATIONS_ENABLED) {
      return NextResponse.json(
        { error: "Integrations are disabled" },
        { status: 404 }
      );
    }

    // CSRF validation
    const csrfError = await validateCsrf(request);
    if (csrfError) {
      return NextResponse.json({ error: csrfError }, { status: 403 });
    }

    const { orgSlug, provider } = await params;
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

    // Validate provider
    if (!isIntegrationAllowed(provider)) {
      return NextResponse.json(
        { error: `Provider "${provider}" is not allowed` },
        { status: 400 }
      );
    }

    // Find integration
    const integration = await db.organizationIntegration.findUnique({
      where: {
        organizationId_provider: {
          organizationId: org.id,
          provider,
        },
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    // Revoke and delete integration
    await revokeIntegration(provider as IntegrationProvider, integration.id);

    // Write audit log
    await db.auditLog.create({
      data: {
        action: "integration.disconnected",
        userId: user.id,
        organizationId: org.id,
        metadata: {
          provider,
          accountName: integration.accountName,
        },
      },
    });

    const providerName = PROVIDER_INFO[provider as IntegrationProvider].displayName;

    return NextResponse.json({
      success: true,
      message: `${providerName} integration disconnected`,
    });
  } catch (error) {
    console.error("Error deleting integration:", error);
    return NextResponse.json(
      { error: "Failed to disconnect integration" },
      { status: 500 }
    );
  }
}
