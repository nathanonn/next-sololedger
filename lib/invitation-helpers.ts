/**
 * Invitation helpers
 * Token generation, verification, and rate limiting
 */

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import bcrypt from "bcrypt";
import crypto from "crypto";

/**
 * Generate a secure invitation token
 * Returns both the plaintext token (for URL) and hash (for DB)
 */
export function generateInvitationToken(): {
  token: string;
  tokenHash: string;
} {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = bcrypt.hashSync(token, 10);

  return { token, tokenHash };
}

/**
 * Verify invitation token against hash
 */
export function verifyInvitationToken(
  token: string,
  tokenHash: string
): boolean {
  return bcrypt.compareSync(token, tokenHash);
}

/**
 * Check rate limit for invitations per organization per day
 */
export async function checkOrgInviteRateLimit(
  orgId: string
): Promise<{ allowed: boolean; error?: string }> {
  const limit = env.INVITES_PER_ORG_PER_DAY;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  const count = await db.invitation.count({
    where: {
      organizationId: orgId,
      createdAt: {
        gte: since,
      },
    },
  });

  if (count >= limit) {
    return {
      allowed: false,
      error: `Organization invite limit reached (${limit} per day)`,
    };
  }

  return { allowed: true };
}

/**
 * Check rate limit for invitations per IP per 15 minutes
 */
export async function checkIpInviteRateLimit(
  ip: string
): Promise<{ allowed: boolean; error?: string }> {
  const limit = env.INVITES_PER_IP_15M;
  const since = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago

  // We'll use audit logs to track IP-based rate limiting for invitations
  const count = await db.auditLog.count({
    where: {
      action: "member_invited",
      ip,
      createdAt: {
        gte: since,
      },
    },
  });

  if (count >= limit) {
    return {
      allowed: false,
      error: "Too many invites sent. Please try again in 15 minutes.",
    };
  }

  return { allowed: true };
}

/**
 * Get client IP from request
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return "unknown";
}

/**
 * Check if invitation is valid (not expired, not consumed, not revoked)
 */
export interface InvitationValidation {
  valid: boolean;
  error?: string;
  invitation?: {
    id: string;
    organizationId: string;
    email: string;
    role: string;
    orgName: string;
  };
}

export async function validateInvitationToken(
  token: string
): Promise<InvitationValidation> {
  // Find all invitations that haven't been accepted or revoked
  const invitations = await db.invitation.findMany({
    where: {
      acceptedAt: null,
      revokedAt: null,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Find matching token
  for (const inv of invitations) {
    if (verifyInvitationToken(token, inv.tokenHash)) {
      // Check expiry
      if (inv.expiresAt < new Date()) {
        return {
          valid: false,
          error: "This invitation has expired. Ask an admin to resend.",
        };
      }

      return {
        valid: true,
        invitation: {
          id: inv.id,
          organizationId: inv.organizationId,
          email: inv.email,
          role: inv.role,
          orgName: inv.organization.name,
        },
      };
    }
  }

  return {
    valid: false,
    error: "Invalid or expired invitation link.",
  };
}
