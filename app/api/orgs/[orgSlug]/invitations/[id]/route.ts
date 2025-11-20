import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";

export const runtime = "nodejs";

/**
 * DELETE /api/orgs/[orgSlug]/invitations/[id]
 * Revoke an invitation
 * Requires: Admin or Superadmin role
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; id: string }> }
): Promise<Response> {
  try {
    const { orgSlug, id } = await params;

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

    // Find invitation
    const invitation = await db.invitation.findUnique({
      where: { id },
    });

    if (!invitation || invitation.organizationId !== org.id) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "Invitation has already been accepted" },
        { status: 400 }
      );
    }

    if (invitation.revokedAt) {
      return NextResponse.json(
        { error: "Invitation has already been revoked" },
        { status: 400 }
      );
    }

    // Revoke invitation
    await db.$transaction(async (tx) => {
      await tx.invitation.update({
        where: { id },
        data: { revokedAt: new Date() },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          action: "invite_revoked",
          userId: user.id,
          email: user.email,
          organizationId: org.id,
          metadata: {
            invitationId: id,
            invitedEmail: invitation.email,
          },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking invitation:", error);
    return NextResponse.json(
      { error: "Failed to revoke invitation" },
      { status: 500 }
    );
  }
}
