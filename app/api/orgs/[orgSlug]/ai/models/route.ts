import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { validateCsrf } from "@/lib/csrf";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  type AiProvider,
  getCuratedModels,
  isCuratedModel,
  getCuratedModel,
} from "@/lib/ai/providers";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/ai/models
 * List all configured models grouped by provider
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


    // Get all models for this org
    const models = await db.organizationAiModel.findMany({
      where: { organizationId: org.id },
      include: {
        apiKey: {
          select: {
            provider: true,
            lastFour: true,
          },
        },
      },
      orderBy: [{ provider: "asc" }, { isDefault: "desc" }, { name: "asc" }],
    });

    // Get curated models for each provider
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    if (provider) {
      const curatedModels = getCuratedModels(provider as AiProvider);
      return NextResponse.json({ curatedModels, configured: models });
    }

    return NextResponse.json({ models });
  } catch (error) {
    console.error("Error fetching AI models:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI models" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orgs/[orgSlug]/ai/models
 * Add a curated model to the organization
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

    const body = await request.json();
    const { provider, modelName, setAsDefault } = body;

    if (!provider || !modelName) {
      return NextResponse.json(
        { error: "Provider and model name are required" },
        { status: 400 }
      );
    }

    // Verify model is curated
    if (!isCuratedModel(provider, modelName)) {
      return NextResponse.json(
        { error: "Model is not in the curated list" },
        { status: 400 }
      );
    }

    const curatedModel = getCuratedModel(provider, modelName);
    if (!curatedModel) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    // Get the API key for this provider
    const apiKey = await db.organizationAiApiKey.findUnique({
      where: {
        organizationId_provider: {
          organizationId: org.id,
          provider,
        },
      },
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: `No API key configured for provider "${provider}"` },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults for this provider
    if (setAsDefault) {
      await db.organizationAiModel.updateMany({
        where: {
          organizationId: org.id,
          provider,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Create the model
    const model = await db.organizationAiModel.create({
      data: {
        organizationId: org.id,
        provider,
        name: modelName,
        label: curatedModel.label,
        maxOutputTokens: curatedModel.maxOutputTokens,
        isDefault: setAsDefault ?? false,
        apiKeyId: apiKey.id,
      },
    });

    return NextResponse.json({ success: true, model });
  } catch (error) {
    console.error("Error adding AI model:", error);
    return NextResponse.json(
      { error: "Failed to add AI model" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orgs/[orgSlug]/ai/models
 * Remove a model (prevent if it's the default)
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

    const body = await request.json();
    const { modelId } = body;

    if (!modelId) {
      return NextResponse.json(
        { error: "Model ID is required" },
        { status: 400 }
      );
    }

    // Get the model
    const model = await db.organizationAiModel.findUnique({
      where: { id: modelId },
    });

    if (!model || model.organizationId !== org.id) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    // Prevent deleting if it's the only default for this provider
    if (model.isDefault) {
      const otherModels = await db.organizationAiModel.count({
        where: {
          organizationId: org.id,
          provider: model.provider,
          id: { not: modelId },
        },
      });

      if (otherModels === 0) {
        return NextResponse.json(
          {
            error:
              "Cannot delete the only model for this provider. Add another model first.",
          },
          { status: 400 }
        );
      }
    }

    await db.organizationAiModel.delete({
      where: { id: modelId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting AI model:", error);
    return NextResponse.json(
      { error: "Failed to delete AI model" },
      { status: 500 }
    );
  }
}
