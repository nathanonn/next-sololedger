/**
 * Organization helpers for multi-tenant operations
 * Server-side only (Node runtime)
 */

import { db } from "@/lib/db";
import { getCurrentUser, type CurrentUser } from "@/lib/auth-helpers";
import type { Organization, Membership } from "@prisma/client";

/**
 * Get organization by slug
 */
export async function getOrgBySlug(
  slug: string
): Promise<Organization | null> {
  return db.organization.findUnique({
    where: { slug },
  });
}

/**
 * Get user's membership in an organization
 */
export async function getUserMembership(
  userId: string,
  orgId: string
): Promise<Membership | null> {
  return db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: orgId,
      },
    },
  });
}

/**
 * Get current user and organization context from pathname
 * Returns null if user not authenticated or not a member
 *
 * @param pathname - Current request pathname (e.g., /o/[orgSlug]/dashboard)
 * @returns Object with user, org, and membership, or null
 */
export async function getCurrentUserAndOrg(pathname: string): Promise<{
  user: CurrentUser;
  org: Organization;
  membership: Membership;
} | null> {
  // Get current user
  const user = await getCurrentUser();
  if (!user) return null;

  // Extract org slug from pathname: /o/[slug]/...
  const match = pathname.match(/^\/o\/([^/]+)/);
  if (!match) return null;

  const orgSlug = match[1];

  // Get organization
  const org = await getOrgBySlug(orgSlug);
  if (!org) return null;

  // Get user's membership
  const membership = await getUserMembership(user.id, org.id);
  if (!membership) return null;

  return { user, org, membership };
}

/**
 * Require user to be a member of the organization
 * Throws error if not a member
 */
export async function requireMembership(
  userId: string,
  orgId: string
): Promise<Membership> {
  const membership = await getUserMembership(userId, orgId);

  if (!membership) {
    throw new Error("Not a member of this organization");
  }

  return membership;
}

/**
 * Require user to be an admin of the organization
 * Throws error if not an admin
 */
export async function requireAdmin(
  userId: string,
  orgId: string
): Promise<Membership> {
  const membership = await requireMembership(userId, orgId);

  if (membership.role !== "admin") {
    throw new Error("Admin access required");
  }

  return membership;
}

/**
 * Check if user is the last admin of the organization
 * Used to prevent demoting or removing the last admin
 */
export async function isLastAdmin(
  userId: string,
  orgId: string
): Promise<boolean> {
  const adminCount = await db.membership.count({
    where: {
      organizationId: orgId,
      role: "admin",
    },
  });

  if (adminCount <= 1) {
    // Check if this user is an admin
    const membership = await getUserMembership(userId, orgId);
    return membership?.role === "admin";
  }

  return false;
}

/**
 * Get all organizations for a user
 */
export async function getUserOrganizations(userId: string): Promise<
  Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    createdAt: Date;
  }>
> {
  const memberships = await db.membership.findMany({
    where: { userId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
    createdAt: m.organization.createdAt,
  }));
}

/**
 * Helper to scope tenant queries with organizationId
 * Enforces data isolation at the query level
 *
 * @example
 * const records = await db.someModel.findMany({
 *   where: scopeTenant({ status: 'active' }, orgId)
 * })
 */
export function scopeTenant<T extends Record<string, unknown>>(
  where: T,
  orgId: string
): T & { organizationId: string } {
  return {
    ...where,
    organizationId: orgId,
  };
}

/**
 * Validate organization slug format
 * Must be kebab-case, 1-50 chars, alphanumeric + hyphens only
 */
export function validateSlug(slug: string): {
  valid: boolean;
  error?: string;
} {
  if (!slug || slug.length === 0) {
    return { valid: false, error: "Slug is required" };
  }

  if (slug.length > 50) {
    return { valid: false, error: "Slug must be 50 characters or less" };
  }

  // Must be kebab-case: lowercase alphanumeric + hyphens
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return {
      valid: false,
      error: "Only lowercase letters, numbers, and hyphens. No spaces.",
    };
  }

  // Cannot start or end with hyphen
  if (slug.startsWith("-") || slug.endsWith("-")) {
    return { valid: false, error: "Cannot start or end with a hyphen" };
  }

  return { valid: true };
}

/**
 * Check if slug is reserved
 */
export function isReservedSlug(slug: string): boolean {
  const reserved = process.env.ORG_RESERVED_SLUGS?.split(",") || [];
  return reserved.includes(slug);
}

/**
 * Generate a unique slug suggestion
 * Appends random suffix if slug is taken
 */
export async function generateUniqueSlug(baseName: string): Promise<string> {
  // Convert to slug format
  const slug = baseName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50);

  // Check if available
  const existing = await getOrgBySlug(slug);
  if (!existing && !isReservedSlug(slug)) {
    return slug;
  }

  // Try with random suffix
  for (let i = 0; i < 10; i++) {
    const suffix = Math.random().toString(36).substring(2, 8);
    const suffixedSlug = `${slug}-${suffix}`.substring(0, 50);

    const existingSuffixed = await getOrgBySlug(suffixedSlug);
    if (!existingSuffixed && !isReservedSlug(suffixedSlug)) {
      return suffixedSlug;
    }
  }

  // Fallback: timestamp
  return `${slug}-${Date.now()}`.substring(0, 50);
}
