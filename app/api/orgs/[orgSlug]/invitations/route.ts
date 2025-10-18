import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";
import {
  generateInvitationToken,
  checkOrgInviteRateLimit,
  checkIpInviteRateLimit,
  getClientIp,
} from "@/lib/invitation-helpers";
import { sendInvitationEmail } from "@/lib/email";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/invitations
 * List all pending invitations for an organization
 * Requires: Admin or Superadmin role
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    const { orgSlug } = await params;
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

    // Get pending invitations
    const invitations = await db.invitation.findMany({
      where: {
        organizationId: org.id,
        acceptedAt: null,
        revokedAt: null,
      },
      include: {
        invitedBy: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedInvitations = invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      name: inv.name,
      role: inv.role,
      expiresAt: inv.expiresAt,
      invitedBy: inv.invitedBy.email,
      invitedByName: inv.invitedBy.name,
      createdAt: inv.createdAt,
    }));

    return NextResponse.json({ invitations: formattedInvitations });
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orgs/[orgSlug]/invitations
 * Create a new invitation
 * Requires: Admin or Superadmin role
 * Rate limited: org/day and IP/15min
 */
export async function POST(
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
    const inviteSchema = z.object({
      email: z.string().email("Invalid email address"),
      role: z.enum(["admin", "member"]),
      name: z.string().max(255, "Name too long").optional(),
      sendEmail: z.boolean().optional(),
    });

    const body = await request.json();
    const validation = inviteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, role, name, sendEmail } = validation.data;

    // Check if user is already a member
    const existingUser = await db.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { organizationId: org.id },
        },
      },
    });

    if (existingUser && existingUser.memberships.length > 0) {
      return NextResponse.json(
        { error: "User is already a member of this organization" },
        { status: 400 }
      );
    }

    // Check for existing active invitation
    const existingInvite = await db.invitation.findFirst({
      where: {
        organizationId: org.id,
        email,
        acceptedAt: null,
        revokedAt: null,
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "An invitation for this email already exists" },
        { status: 400 }
      );
    }

    // Rate limit: org/day
    const orgRateCheck = await checkOrgInviteRateLimit(org.id);
    if (!orgRateCheck.allowed) {
      return NextResponse.json(
        { error: orgRateCheck.error },
        { status: 429 }
      );
    }

    // Rate limit: IP/15min
    const ip = getClientIp(request);
    const ipRateCheck = await checkIpInviteRateLimit(ip);
    if (!ipRateCheck.allowed) {
      return NextResponse.json({ error: ipRateCheck.error }, { status: 429 });
    }

    // Generate token
    const { token, tokenHash } = generateInvitationToken();

    // Calculate expiry
    const expiresAt = new Date(
      Date.now() + env.INVITE_EXP_MINUTES * 60 * 1000
    );

    // Create invitation
    const invitation = await db.$transaction(async (tx) => {
      const inv = await tx.invitation.create({
        data: {
          organizationId: org.id,
          email,
          role,
          ...(name && { name }),
          tokenHash,
          expiresAt,
          invitedById: user.id,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          action: "member_invited",
          userId: user.id,
          email: user.email,
          ip,
          organizationId: org.id,
          metadata: {
            invitedEmail: email,
            role,
            ...(name && { name }),
          },
        },
      });

      return inv;
    });

    // Generate invitation URL
    const appUrl = env.APP_URL;
    const inviteUrl = `${appUrl}/invite?token=${token}`;

    // Send email if requested and configured
    let emailSent = false;
    if (sendEmail === true) {
      try {
        await sendInvitationEmail({
          to: email,
          orgName: org.name,
          inviteUrl,
          role,
          invitedBy: user.email,
        });
        emailSent = true;
      } catch (error) {
        // Log error but don't fail the request
        // In development without Resend, this will log to console
        console.error("Failed to send invitation email:", error);
      }
    }

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          name: invitation.name,
          expiresAt: invitation.expiresAt,
          inviteUrl,
          sent: emailSent,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating invitation:", error);
    return NextResponse.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }
}
