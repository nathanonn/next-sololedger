import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  getAllowedIntegrations,
  getNotionVariantFlags,
  PROVIDER_INFO,
} from "@/lib/integrations/providers";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/integrations
 * List all allowed integration providers with their connection status
 * Requires: Admin or Superadmin role
 */
export async function GET(
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

    // Get all allowed providers
    const allowedProviders = getAllowedIntegrations();

    // Fetch all integrations for this org
    const integrations = await db.organizationIntegration.findMany({
      where: { organizationId: org.id },
      select: {
        provider: true,
        connectionType: true,
        status: true,
        accountId: true,
        accountName: true,
        scope: true,
        updatedAt: true,
      },
    });

    // Get Notion variant flags
    const notionVariants = getNotionVariantFlags();

    // Build provider status map
    const providersWithStatus = allowedProviders.map((provider) => {
      const integration = integrations.find((i) => i.provider === provider);

      const baseInfo = {
        provider,
        displayName: PROVIDER_INFO[provider].displayName,
        connected: integration?.status === "connected",
        status: integration?.status ?? "disconnected",
        accountId: integration?.accountId ?? null,
        accountName: integration?.accountName ?? null,
        scope: integration?.scope ?? null,
        lastUpdated: integration?.updatedAt ?? null,
      };

      // Add Notion-specific fields
      if (provider === "notion") {
        return {
          ...baseInfo,
          variantsAllowed: notionVariants,
          connectionType: integration?.connectionType ?? null,
        };
      }

      return baseInfo;
    });

    return NextResponse.json({ providers: providersWithStatus });
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}
