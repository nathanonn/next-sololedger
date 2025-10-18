import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
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
