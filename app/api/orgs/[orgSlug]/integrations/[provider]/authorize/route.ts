import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { validateCsrf } from "@/lib/csrf";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import {
  isIntegrationAllowed,
  getNotionVariantFlags,
} from "@/lib/integrations/providers";
import { buildAuthorizeUrl } from "@/lib/integrations/oauth";
import type { IntegrationProvider } from "@/lib/integrations/providers";

export const runtime = "nodejs";

/**
 * POST /api/orgs/[orgSlug]/integrations/[provider]/authorize
 * Initiate OAuth flow for an integration provider
 * Requires: Admin or Superadmin role, CSRF validation
 * Returns: { url } for client redirect
 */
export async function POST(
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

    // Validate provider
    if (!isIntegrationAllowed(provider)) {
      return NextResponse.json(
        { error: `Provider "${provider}" is not allowed` },
        { status: 400 }
      );
    }

    // For Notion, require notion_public to be enabled
    if (provider === "notion") {
      const notionVariants = getNotionVariantFlags();
      if (!notionVariants.public) {
        return NextResponse.json(
          { error: "Notion public OAuth is not enabled" },
          { status: 400 }
        );
      }

      // Check if a Notion integration already exists (prevent switching variants)
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
    }

    // Build authorization URL
    const { url } = await buildAuthorizeUrl(
      org.id,
      user.id,
      provider as IntegrationProvider
    );

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error building authorize URL:", error);
    return NextResponse.json(
      { error: "Failed to initiate authorization" },
      { status: 500 }
    );
  }
}
