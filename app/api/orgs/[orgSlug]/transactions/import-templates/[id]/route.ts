import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership } from "@/lib/org-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/transactions/import-templates/[id]
 * Get a specific import template with full config
 * Requires: Member or Admin
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; id: string }> }
): Promise<Response> {
  try {
    const { orgSlug, id } = await params;
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

    // Verify user is member
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Organization membership required" },
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

    // Fetch template
    const template = await db.csvImportTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        config: true,
        createdAt: true,
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Verify template belongs to this organization
    const templateOrg = await db.csvImportTemplate.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (templateOrg?.organizationId !== org.id) {
      return NextResponse.json(
        { error: "Template not found in this organization" },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Error fetching import template:", error);
    return NextResponse.json(
      { error: "Failed to fetch import template" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orgs/[orgSlug]/transactions/import-templates/[id]
 * Delete an import template
 * Requires: Member or Admin
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; id: string }> }
): Promise<Response> {
  try {
    const { orgSlug, id } = await params;
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

    // Verify user is member
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Organization membership required" },
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

    // Verify template belongs to this organization
    const template = await db.csvImportTemplate.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (template.organizationId !== org.id) {
      return NextResponse.json(
        { error: "Template not found in this organization" },
        { status: 404 }
      );
    }

    // Delete template
    await db.csvImportTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting import template:", error);
    return NextResponse.json(
      { error: "Failed to delete import template" },
      { status: 500 }
    );
  }
}
