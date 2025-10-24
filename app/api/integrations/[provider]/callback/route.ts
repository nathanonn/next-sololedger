import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isIntegrationAllowed, PROVIDER_INFO } from "@/lib/integrations/providers";
import { exchangeCodeForToken } from "@/lib/integrations/oauth";
import type { IntegrationProvider } from "@/lib/integrations/providers";

export const runtime = "nodejs";

/**
 * GET /api/integrations/[provider]/callback
 * OAuth callback handler - exchanges code for tokens and redirects back to integrations page
 * Query params: code, state (from OAuth provider)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
): Promise<Response> {
  try {
    if (!env.INTEGRATIONS_ENABLED) {
      return new Response("Integrations are disabled", { status: 404 });
    }

    const { provider } = await params;
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Check for OAuth errors
    if (error) {
      console.error(`OAuth error for ${provider}:`, error);
      const errorDescription = searchParams.get("error_description") || error;

      // Redirect back to integrations page with error
      return NextResponse.redirect(
        new URL(
          `/o/unknown/settings/organization/integrations?error=${encodeURIComponent(errorDescription)}`,
          env.APP_URL
        )
      );
    }

    // Validate required params
    if (!code || !state) {
      return new Response("Missing code or state", { status: 400 });
    }

    // Validate provider
    if (!isIntegrationAllowed(provider)) {
      return new Response(`Provider "${provider}" is not allowed`, {
        status: 400,
      });
    }

    // Exchange code for token
    const result = await exchangeCodeForToken(
      provider as IntegrationProvider,
      code,
      state
    );

    // Get organization to build redirect URL
    const org = await db.organization.findUnique({
      where: { id: result.organizationId },
      select: { slug: true },
    });

    if (!org) {
      return new Response("Organization not found", { status: 404 });
    }

    // Write audit log
    await db.auditLog.create({
      data: {
        action: "integration.connected",
        userId: result.userId,
        organizationId: result.organizationId,
        metadata: {
          provider,
          accountName: result.accountName,
        },
      },
    });

    // Redirect back to integrations page with success message
    const providerName = PROVIDER_INFO[provider as IntegrationProvider].displayName;
    const redirectUrl = new URL(
      `/o/${org.slug}/settings/organization/integrations`,
      env.APP_URL
    );
    redirectUrl.searchParams.set("connected", provider);
    redirectUrl.searchParams.set("accountName", result.accountName || "");

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Error in OAuth callback:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to connect integration";

    // Try to redirect with error, fallback to generic path
    const redirectUrl = new URL(
      `/o/unknown/settings/organization/integrations`,
      env.APP_URL
    );
    redirectUrl.searchParams.set("error", errorMessage);

    return NextResponse.redirect(redirectUrl);
  }
}
