import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isIntegrationAllowed } from "@/lib/integrations/providers";
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
  let orgSlug: string | null = null;

  try {
    if (!env.INTEGRATIONS_ENABLED) {
      return new Response("Integrations are disabled", { status: 404 });
    }

    const { provider } = await params;
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Validate provider first
    if (!isIntegrationAllowed(provider)) {
      return new Response(`Provider "${provider}" is not allowed`, {
        status: 400,
      });
    }

    // Look up organization slug from state (needed for all redirect paths)
    if (state) {
      const authState = await db.integrationAuthState.findFirst({
        where: {
          state,
          provider,
        },
        select: {
          organizationId: true,
        },
      });

      if (authState) {
        const org = await db.organization.findUnique({
          where: { id: authState.organizationId },
          select: { slug: true },
        });

        if (org) {
          orgSlug = org.slug;
        }
      }
    }

    // Check for OAuth errors from provider
    if (error) {
      console.error(`OAuth error for ${provider}:`, error);
      const errorDescription = searchParams.get("error_description") || error;

      // If we can't resolve orgSlug, return 500 (no safe redirect destination)
      if (!orgSlug) {
        return new Response(
          `OAuth error: ${errorDescription}. Unable to redirect - invalid or expired state.`,
          { status: 500 }
        );
      }

      // Redirect back to integrations page with error
      const redirectUrl = new URL(
        `/o/${orgSlug}/settings/organization/integrations`,
        env.APP_URL
      );
      redirectUrl.searchParams.set("error", errorDescription);

      return NextResponse.redirect(redirectUrl);
    }

    // Validate required params
    if (!code || !state) {
      // If we have orgSlug, redirect with error instead of returning 400
      if (orgSlug) {
        const redirectUrl = new URL(
          `/o/${orgSlug}/settings/organization/integrations`,
          env.APP_URL
        );
        redirectUrl.searchParams.set("error", "Missing code or state from OAuth provider");
        return NextResponse.redirect(redirectUrl);
      }
      // No orgSlug available - return error response
      return new Response("Missing code or state", { status: 400 });
    }

    // If we couldn't find org slug, cannot safely redirect
    if (!orgSlug) {
      return new Response("Invalid or expired state. Please try connecting again.", { status: 500 });
    }

    // Exchange code for token
    const result = await exchangeCodeForToken(
      provider as IntegrationProvider,
      code,
      state
    );

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
    const redirectUrl = new URL(
      `/o/${orgSlug}/settings/organization/integrations`,
      env.APP_URL
    );
    redirectUrl.searchParams.set("connected", provider);
    redirectUrl.searchParams.set("accountName", result.accountName || "");

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Error in OAuth callback:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to connect integration";

    // Redirect with error to org page if we have the slug, otherwise 500
    if (orgSlug) {
      const redirectUrl = new URL(
        `/o/${orgSlug}/settings/organization/integrations`,
        env.APP_URL
      );
      redirectUrl.searchParams.set("error", errorMessage);

      return NextResponse.redirect(redirectUrl);
    }

    // No org slug available - return error response
    return new Response(`OAuth callback error: ${errorMessage}`, {
      status: 500,
    });
  }
}
