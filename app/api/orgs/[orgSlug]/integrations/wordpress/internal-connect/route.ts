import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { validateCsrf } from "@/lib/csrf";
import { env } from "@/lib/env";
import { isIntegrationAllowed } from "@/lib/integrations/providers";
import { encryptSecret } from "@/lib/secrets";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const connectSchema = z.object({
  siteUrl: z.string().url("Valid site URL is required"),
  username: z.string().min(1, "Username is required"),
  applicationPassword: z.string().min(1, "Application password is required"),
  defaults: z
    .object({
      status: z.enum(["draft", "publish"]).optional(),
      categoryId: z.number().optional(),
      authorId: z.number().optional(),
    })
    .optional(),
});

/**
 * POST /api/orgs/[orgSlug]/integrations/wordpress/internal-connect
 * Connect WordPress using Application Passwords (Basic Auth)
 * Requires: Admin or Superadmin role, CSRF validation, wordpress enabled, HTTPS (unless dev flag)
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

    // Verify wordpress is enabled
    if (!isIntegrationAllowed("wordpress")) {
      return NextResponse.json(
        { error: "WordPress integration is not enabled" },
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
    // Validate API key organization access
    if (!validateApiKeyOrgAccess(user, org.id)) {
      return NextResponse.json(
        { error: "API key not authorized for this organization" },
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

    const { siteUrl, username, applicationPassword, defaults } =
      parseResult.data;

    // Validate HTTPS requirement (unless dev flag allows HTTP)
    const url = new URL(siteUrl);
    const isHttps = url.protocol === "https:";
    const isDevHttpAllowed =
      env.NODE_ENV === "development" && env.WORDPRESS_ALLOW_HTTP_DEV;

    if (!isHttps && !isDevHttpAllowed) {
      return NextResponse.json(
        {
          error:
            "WordPress sites must use HTTPS. If testing locally, set WORDPRESS_ALLOW_HTTP_DEV=true in development.",
        },
        { status: 400 }
      );
    }

    // Build Basic Auth token for testing
    const credentials = `${username}:${applicationPassword}`;
    const basicAuthToken = Buffer.from(credentials).toString("base64");

    // Test connectivity: GET /wp-json/ (WordPress REST API root)
    const testUrl = `${siteUrl.replace(/\/$/, "")}/wp-json/`;
    let siteInfo: { name?: string; description?: string };

    try {
      const testResponse = await fetch(testUrl, {
        headers: {
          Authorization: `Basic ${basicAuthToken}`,
        },
      });

      if (!testResponse.ok) {
        const errorText = await testResponse.text();
        console.error("WordPress site test failed:", errorText);
        return NextResponse.json(
          {
            error: `Failed to connect to WordPress site (${testResponse.status}). Check site URL and credentials.`,
          },
          { status: 400 }
        );
      }

      siteInfo = await testResponse.json();
    } catch (error) {
      console.error("WordPress connection error:", error);
      return NextResponse.json(
        {
          error:
            "Failed to connect to WordPress site. Check site URL and network connectivity.",
        },
        { status: 400 }
      );
    }

    // Optionally verify user credentials with /wp/v2/users/me
    try {
      const userVerifyUrl = `${siteUrl.replace(/\/$/, "")}/wp-json/wp/v2/users/me`;
      const userVerifyResponse = await fetch(userVerifyUrl, {
        headers: {
          Authorization: `Basic ${basicAuthToken}`,
        },
      });

      if (!userVerifyResponse.ok) {
        return NextResponse.json(
          {
            error:
              "Invalid credentials. Please check username and application password.",
          },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error("WordPress user verification error:", error);
      // Non-fatal: continue with site connection
    }

    const accountId = siteUrl; // Use site URL as accountId
    const accountName = siteInfo.name || "WordPress Site";

    // Prepare scope JSON with defaults
    const scopeData = defaults || {};
    const scopeJson = JSON.stringify(scopeData);

    // Upsert integration
    await db.organizationIntegration.upsert({
      where: {
        organizationId_provider: {
          organizationId: org.id,
          provider: "wordpress",
        },
      },
      create: {
        organizationId: org.id,
        provider: "wordpress",
        connectionType: "internal",
        status: "connected",
        accountId,
        accountName,
        encryptedAccessToken: encryptSecret(credentials), // Store raw username:password encrypted
        encryptedRefreshToken: null,
        tokenType: "basic",
        expiresAt: null,
        scope: scopeJson,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
      update: {
        status: "connected",
        accountName,
        encryptedAccessToken: encryptSecret(credentials),
        scope: scopeJson,
        updatedByUserId: user.id,
        updatedAt: new Date(),
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
          provider: "wordpress",
          connectionType: "internal",
          accountName,
          siteUrl,
        },
      },
    });

    return NextResponse.json({ ok: true, accountName });
  } catch (error) {
    console.error("Error connecting WordPress integration:", error);
    return NextResponse.json(
      { error: "Failed to connect integration" },
      { status: 500 }
    );
  }
}
