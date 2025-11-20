import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin, isLastAdmin, isSuperadmin } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";

export const runtime = "nodejs";

/**
 * PATCH /api/orgs/[orgSlug]/members/[userId]
 * Update member role and/or name
 * Requires: Admin or Superadmin role
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; userId: string }> }
): Promise<Response> {
  try {
    const { orgSlug, userId: targetUserId } = await params;

    // CSRF validation
    const csrfError = await validateCsrf(request);
    if (csrfError) {
      return NextResponse.json({ error: csrfError }, { status: 403 });
    }

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

    // Validate request body
    const updateMemberSchema = z.object({
      role: z.enum(["admin", "member"]).optional(),
      name: z.string().max(255, "Name too long").optional(),
    });

    const body = await request.json();
    const validation = updateMemberSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { role, name } = validation.data;

    // At least one field must be provided
    if (role === undefined && name === undefined) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Check if target user is a member
    const targetMembership = await db.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId: org.id,
        },
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: "User is not a member of this organization" },
        { status: 404 }
      );
    }

    // Check if requester is superadmin
    const userIsSuperadmin = await isSuperadmin(user.id);

    // Prevent admin self-demotion (if not superadmin)
    if (
      !userIsSuperadmin &&
      role !== undefined &&
      user.id === targetUserId &&
      targetMembership.role === "admin" &&
      role === "member"
    ) {
      return NextResponse.json(
        { error: "Cannot demote yourself. Ask another admin to change your role." },
        { status: 400 }
      );
    }

    // Prevent demoting last admin (only if role is being changed)
    if (role !== undefined && targetMembership.role === "admin" && role === "member") {
      const isLast = await isLastAdmin(targetUserId, org.id);
      if (isLast) {
        return NextResponse.json(
          { error: "Cannot demote the last admin. Promote another member first." },
          { status: 400 }
        );
      }
    }

    // Update member and/or user
    await db.$transaction(async (tx) => {
      // Update membership role if provided
      if (role !== undefined) {
        await tx.membership.update({
          where: {
            userId_organizationId: {
              userId: targetUserId,
              organizationId: org.id,
            },
          },
          data: { role },
        });

        // Audit log for role change
        await tx.auditLog.create({
          data: {
            action: "member_role_changed",
            userId: user.id,
            email: user.email,
            organizationId: org.id,
            metadata: {
              targetUserId,
              newRole: role,
              oldRole: targetMembership.role,
            },
          },
        });
      }

      // Update user name if provided (no audit per plan)
      if (name !== undefined) {
        await tx.user.update({
          where: { id: targetUserId },
          data: { name },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orgs/[orgSlug]/members/[userId]
 * Remove member from organization
 * Requires: Admin or Superadmin role
 * Users can remove themselves (leave) unless they're the last admin
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; userId: string }> }
): Promise<Response> {
  try {
    const { orgSlug, userId: targetUserId } = await params;

    // CSRF validation
    const csrfError = await validateCsrf(request);
    if (csrfError) {
      return NextResponse.json({ error: csrfError }, { status: 403 });
    }

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

    const isSelfLeave = user.id === targetUserId;

    // Verify permission: admin/superadmin OR self-leave
    if (!isSelfLeave) {
      try {
        await requireAdminOrSuperadmin(user.id, org.id);
      } catch {
        return NextResponse.json(
          { error: "Admin or superadmin access required to remove other members" },
          { status: 403 }
        );
      }
    }

    // Check if target user is a member
    const targetMembership = await db.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId: org.id,
        },
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: "User is not a member of this organization" },
        { status: 404 }
      );
    }

    // Check if requester is superadmin
    const userIsSuperadmin = await isSuperadmin(user.id);

    // Prevent admin self-removal (if not superadmin)
    if (
      !userIsSuperadmin &&
      isSelfLeave &&
      targetMembership.role === "admin"
    ) {
      return NextResponse.json(
        { error: "Cannot remove yourself as admin. Ask another admin to remove you." },
        { status: 400 }
      );
    }

    // Prevent removing last admin
    if (targetMembership.role === "admin") {
      const isLast = await isLastAdmin(targetUserId, org.id);
      if (isLast) {
        return NextResponse.json(
          {
            error: isSelfLeave
              ? "Cannot leave as the last admin. Promote another member first."
              : "Cannot remove the last admin. Promote another member first.",
          },
          { status: 400 }
        );
      }
    }

    // Remove membership
    await db.$transaction(async (tx) => {
      await tx.membership.delete({
        where: {
          userId_organizationId: {
            userId: targetUserId,
            organizationId: org.id,
          },
        },
      });

      // Clear default org if this was it
      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { defaultOrganizationId: true },
      });

      if (targetUser?.defaultOrganizationId === org.id) {
        await tx.user.update({
          where: { id: targetUserId },
          data: { defaultOrganizationId: null },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          action: isSelfLeave ? "member_left" : "member_removed",
          userId: user.id,
          email: user.email,
          organizationId: org.id,
          metadata: {
            targetUserId,
            targetRole: targetMembership.role,
          },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
