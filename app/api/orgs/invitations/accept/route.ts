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

    const user = await getCurrentUser(request);
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

    const validatedInvitation = tokenValidation.invitation;

    // Check if user email matches invitation email
    if (user.email.toLowerCase() !== validatedInvitation.email.toLowerCase()) {
      return NextResponse.json(
        {
          error:
            "This invitation is for a different email address. Please sign in with the invited email.",
        },
        { status: 403 }
      );
    }

    // Fetch full invitation details (including name field)
    const invitation = await db.invitation.findUnique({
      where: { id: validatedInvitation.id },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
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

      // Get organization details for redirect
      const org = await db.organization.findUnique({
        where: { id: invitation.organizationId },
        select: { id: true, name: true, slug: true },
      });

      return NextResponse.json({
        message: "You are already a member of this organization",
        organizationId: invitation.organizationId,
        alreadyMember: true,
        organization: {
          id: org!.id,
          name: org!.name,
          slug: org!.slug,
        },
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

      // Get current user details
      const currentUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { defaultOrganizationId: true, name: true },
      });

      // Apply invited name if user has no name and invitation has one
      const shouldSetName = invitation.name && (!currentUser?.name || currentUser.name.trim() === "");

      // Update user: set default org and/or name
      if (!currentUser?.defaultOrganizationId || shouldSetName) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            ...((!currentUser?.defaultOrganizationId) && { defaultOrganizationId: invitation.organizationId }),
            ...(shouldSetName && { name: invitation.name }),
          },
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
