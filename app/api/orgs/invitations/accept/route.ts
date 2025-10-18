import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";
import { validateInvitationToken } from "@/lib/invitation-helpers";

export const runtime = "nodejs";

/**
 * POST /api/orgs/invitations/accept
 * Accept an invitation
 * Requires: Authenticated user with email matching invitation
 */
export async function POST(request: Request): Promise<Response> {
  try {
    // CSRF validation
    const csrfError = await validateCsrf(request);
    if (csrfError) {
      return NextResponse.json({ error: csrfError }, { status: 403 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to accept an invitation" },
        { status: 401 }
      );
    }

    // Validate request body
    const acceptSchema = z.object({
      token: z.string().min(1, "Token is required"),
    });

    const body = await request.json();
    const validation = acceptSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { token } = validation.data;

    // Validate token
    const tokenValidation = await validateInvitationToken(token);

    if (!tokenValidation.valid || !tokenValidation.invitation) {
      return NextResponse.json(
        { error: tokenValidation.error || "Invalid invitation" },
        { status: 400 }
      );
    }

    const invitation = tokenValidation.invitation;

    // Check if user email matches invitation email
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        {
          error:
            "This invitation is for a different email address. Please sign in with the invited email.",
        },
        { status: 403 }
      );
    }

    // Check if user is already a member
    const existingMembership = await db.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: invitation.organizationId,
        },
      },
    });

    if (existingMembership) {
      // Already a member - mark invitation as accepted anyway
      await db.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      return NextResponse.json({
        message: "You are already a member of this organization",
        organizationId: invitation.organizationId,
        alreadyMember: true,
      });
    }

    // Create membership and mark invitation as accepted
    const result = await db.$transaction(async (tx) => {
      // Create membership
      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      });

      // Mark invitation as accepted
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      // Set as default org if user has none
      const currentUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { defaultOrganizationId: true },
      });

      if (!currentUser?.defaultOrganizationId) {
        await tx.user.update({
          where: { id: user.id },
          data: { defaultOrganizationId: invitation.organizationId },
        });
      }

      // Get org details
      const org = await tx.organization.findUnique({
        where: { id: invitation.organizationId },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          action: "invite_accepted",
          userId: user.id,
          email: user.email,
          organizationId: invitation.organizationId,
          metadata: {
            invitationId: invitation.id,
            role: invitation.role,
          },
        },
      });

      return org;
    });

    return NextResponse.json({
      message: "Invitation accepted successfully",
      organization: {
        id: result!.id,
        name: result!.name,
        slug: result!.slug,
      },
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}
