import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin, isSuperadmin } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";

export const runtime = "nodejs";

/**
 * PATCH /api/orgs/[orgSlug]
 * Update organization details
 * Requires: Admin or Superadmin role
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    const { orgSlug } = await params;

    // CSRF validation
    const csrfError = await validateCsrf(request);
    if (csrfError) {
      return NextResponse.json({ error: csrfError }, { status: 403 });
    }

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

    // Validate request body
    const updateOrgSchema = z.object({
      name: z
        .string()
        .min(1, "Name is required")
        .max(255, "Name too long")
        .optional(),
    });

    const body = await request.json();
    const validation = updateOrgSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name } = validation.data;

    // Update organization
    const updatedOrg = await db.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: org.id },
        data: {
          name: name || org.name,
          updatedAt: new Date(),
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          action: "org_updated",
          userId: user.id,
          email: user.email,
          organizationId: org.id,
          metadata: {
            oldName: org.name,
            newName: name || org.name,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        slug: updatedOrg.slug,
        updatedAt: updatedOrg.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orgs/[orgSlug]
 * Delete organization (superadmin only)
 * Cascades memberships and invitations, clears defaultOrganizationId
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    const { orgSlug } = await params;

    // CSRF validation
    const csrfError = await validateCsrf(request);
    if (csrfError) {
      return NextResponse.json({ error: csrfError }, { status: 403 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only superadmins can delete organizations
    const userIsSuperadmin = await isSuperadmin(user.id);
    if (!userIsSuperadmin) {
      return NextResponse.json(
        { error: "Superadmin access required" },
        { status: 403 }
      );
    }

    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Delete organization in a transaction
    await db.$transaction(async (tx) => {
      // Count members for audit metadata
      const memberCount = await tx.membership.count({
        where: { organizationId: org.id },
      });

      // Clear defaultOrganizationId for users who have this org as default
      await tx.user.updateMany({
        where: { defaultOrganizationId: org.id },
        data: { defaultOrganizationId: null },
      });

      // Create audit log entry BEFORE deleting the organization
      // (since AuditLog.organization has onDelete: SetNull, we can reference it)
      await tx.auditLog.create({
        data: {
          action: "org_deleted",
          userId: user.id,
          email: user.email,
          organizationId: org.id,
          metadata: {
            slug: org.slug,
            name: org.name,
            memberCount,
          },
        },
      });

      // Delete organization (cascades memberships and invitations)
      await tx.organization.delete({
        where: { id: org.id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting organization:", error);
    return NextResponse.json(
      { error: "Failed to delete organization" },
      { status: 500 }
    );
  }
}
