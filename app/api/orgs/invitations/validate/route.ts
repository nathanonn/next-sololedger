import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { validateInvitationToken } from "@/lib/invitation-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/orgs/invitations/validate?token=...
 * Validate an invitation token and return invitation details
 * Optionally includes user membership status if authenticated
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token is required" },
        { status: 400 }
      );
    }

    // Validate token
    const tokenValidation = await validateInvitationToken(token);

    if (!tokenValidation.valid || !tokenValidation.invitation) {
      return NextResponse.json({
        valid: false,
        error: tokenValidation.error || "Invalid invitation",
      });
    }

    const invitation = tokenValidation.invitation;

    // Check if user is authenticated
    const user = await getCurrentUser(request);

    let alreadyMember = false;
    let userIsSuperadmin = false;

    if (user) {
      // Check if user is a superadmin
      userIsSuperadmin = user.role === "superadmin";

      // Check if user is already a member of the organization
      const membership = await db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: invitation.organizationId,
          },
        },
      });

      alreadyMember = !!membership;
    }

    return NextResponse.json({
      valid: true,
      invitation: {
        id: invitation.id,
        orgId: invitation.organizationId,
        orgSlug: invitation.orgSlug,
        orgName: invitation.orgName,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
      ...(user && { alreadyMember, userIsSuperadmin }),
    });
  } catch (error) {
    console.error("Error validating invitation:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to validate invitation" },
      { status: 500 }
    );
  }
}
