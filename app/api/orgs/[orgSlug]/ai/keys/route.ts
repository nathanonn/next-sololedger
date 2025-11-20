import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { validateCsrf } from "@/lib/csrf";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  type AiProvider,
  isProviderAllowed,
  getAllowedProviders,
  verifyApiKey,
  PROVIDER_CAPS,
} from "@/lib/ai/providers";
import { encryptSecret, getLastChars } from "@/lib/secrets";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/ai/keys
 * List all providers with their status (Verified/Missing) and default model
 * Requires: Admin or Superadmin role
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    if (!env.AI_FEATURES_ENABLED) {
      return NextResponse.json(
        { error: "AI features are disabled" },
        { status: 404 }
      );
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

    // Get all allowed providers
    const allowedProviders = getAllowedProviders();

    // Fetch all API keys for this org
    const apiKeys = await db.organizationAiApiKey.findMany({
      where: { organizationId: org.id },
      include: {
        models: {
          where: { isDefault: true },
          select: {
            name: true,
            label: true,
          },
        },
      },
    });

    // Build provider status map
    const providersWithStatus = allowedProviders.map((provider) => {
      const apiKey = apiKeys.find((k) => k.provider === provider);

      return {
        provider,
        displayName: PROVIDER_CAPS[provider].displayName,
        status: apiKey ? "verified" : "missing",
        lastFour: apiKey?.lastFour ?? null,
        lastVerifiedAt: apiKey?.lastVerifiedAt ?? null,
        defaultModel: apiKey?.models[0] ?? null,
      };
    });

    return NextResponse.json({ providers: providersWithStatus });
  } catch (error) {
    console.error("Error fetching AI keys:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI keys" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orgs/[orgSlug]/ai/keys
 * Upsert an API key for a provider (verify before saving)
 * Requires: Admin or Superadmin role, CSRF validation
 * Body: { provider: string, apiKey: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    if (!env.AI_FEATURES_ENABLED) {
      return NextResponse.json(
        { error: "AI features are disabled" },
        { status: 404 }
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

    // Parse and validate request body
    const body = await request.json();
    const { provider, apiKey } = body;

    if (!provider || typeof provider !== "string") {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      );
    }

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    if (!isProviderAllowed(provider)) {
      return NextResponse.json(
        { error: `Provider "${provider}" is not allowed` },
        { status: 400 }
      );
    }

    // Verify the API key by making a test call
    try {
      await verifyApiKey(provider as AiProvider, apiKey);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to verify API key",
        },
        { status: 400 }
      );
    }

    // Encrypt the key
    const encryptedKey = encryptSecret(apiKey);
    const lastFour = getLastChars(apiKey, 4);

    // Upsert the API key
    await db.organizationAiApiKey.upsert({
      where: {
        organizationId_provider: {
          organizationId: org.id,
          provider,
        },
      },
      create: {
        organizationId: org.id,
        provider,
        encryptedKey,
        lastFour,
        lastVerifiedAt: new Date(),
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
      update: {
        encryptedKey,
        lastFour,
        lastVerifiedAt: new Date(),
        updatedByUserId: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: `API key for ${PROVIDER_CAPS[provider as AiProvider].displayName} verified and saved`,
    });
  } catch (error) {
    console.error("Error saving AI key:", error);
    return NextResponse.json(
      { error: "Failed to save API key" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orgs/[orgSlug]/ai/keys
 * Remove an API key for a provider (and all associated models)
 * Requires: Admin or Superadmin role, CSRF validation
 * Body: { provider: string }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    if (!env.AI_FEATURES_ENABLED) {
      return NextResponse.json(
        { error: "AI features are disabled" },
        { status: 404 }
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

    // Parse and validate request body
    const body = await request.json();
    const { provider } = body;

    if (!provider || typeof provider !== "string") {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      );
    }

    if (!isProviderAllowed(provider)) {
      return NextResponse.json(
        { error: `Provider "${provider}" is not allowed` },
        { status: 400 }
      );
    }

    // Delete the API key (cascade will delete associated models)
    const deleted = await db.organizationAiApiKey.deleteMany({
      where: {
        organizationId: org.id,
        provider,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "API key not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `API key for ${PROVIDER_CAPS[provider as AiProvider].displayName} removed`,
    });
  } catch (error) {
    console.error("Error deleting AI key:", error);
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    );
  }
}
