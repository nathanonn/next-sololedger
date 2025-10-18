import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdmin } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { validateCsrf } from "@/lib/csrf";
import { generateInvitationToken } from "@/lib/invitation-helpers";

export const runtime = "nodejs";

/**
 * POST /api/orgs/[orgSlug]/invitations/[id]/resend
 * Resend an invitation with a new token
 * Requires: Admin role
 */
export async function POST(
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

    // Verify user is admin
    try {
      await requireAdmin(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Admin access required" },
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
        { error: "Invitation has been revoked" },
        { status: 400 }
      );
    }

    // Generate new token
    const { token, tokenHash } = generateInvitationToken();

    // Calculate new expiry
    const expiresAt = new Date(
      Date.now() + env.INVITE_EXP_MINUTES * 60 * 1000
    );

    // Update invitation with new token and expiry
    const updatedInvitation = await db.$transaction(async (tx) => {
      const updated = await tx.invitation.update({
        where: { id },
        data: {
          tokenHash,
          expiresAt,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          action: "invite_resend",
          userId: user.id,
          email: user.email,
          organizationId: org.id,
          metadata: {
            invitationId: id,
            invitedEmail: invitation.email,
          },
        },
      });

      return updated;
    });

    // Generate invitation URL
    const appUrl = env.APP_URL;
    const inviteUrl = `${appUrl}/invite?token=${token}`;

    // TODO: Send email via Resend
    console.log(`Resent invitation URL: ${inviteUrl}`);

    return NextResponse.json({
      invitation: {
        id: updatedInvitation.id,
        email: updatedInvitation.email,
        role: updatedInvitation.role,
        expiresAt: updatedInvitation.expiresAt,
        inviteUrl,
      },
    });
  } catch (error) {
    console.error("Error resending invitation:", error);
    return NextResponse.json(
      { error: "Failed to resend invitation" },
      { status: 500 }
    );
  }
}
