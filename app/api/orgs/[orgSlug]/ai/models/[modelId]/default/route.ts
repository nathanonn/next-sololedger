import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { validateCsrf } from "@/lib/csrf";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * PATCH /api/orgs/[orgSlug]/ai/models/[modelId]/default
 * Set a model as the default for its provider
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; modelId: string }> }
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

    const { orgSlug, modelId } = await params;
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

    try {
      await requireAdminOrSuperadmin(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Admin or superadmin access required" },
        { status: 403 }
      );
    }

    // Get the model
    const model = await db.organizationAiModel.findUnique({
      where: { id: modelId },
    });

    if (!model || model.organizationId !== org.id) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    // Unset other defaults for this provider
    await db.organizationAiModel.updateMany({
      where: {
        organizationId: org.id,
        provider: model.provider,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });

    // Set this model as default
    await db.organizationAiModel.update({
      where: { id: modelId },
      data: { isDefault: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting default model:", error);
    return NextResponse.json(
      { error: "Failed to set default model" },
      { status: 500 }
    );
  }
}
