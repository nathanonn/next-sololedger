import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getUserOrganizations, isSuperadmin } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { OrgCreationDenied } from "./_components/org-creation-denied";

/**
 * Root page redirect logic
 * Determines which organization to redirect to based on:
 * 1. last_org cookie
 * 2. defaultOrganizationId
 * 3. First membership
 * 4. Redirect to onboarding if no organizations
 */

export default async function Home(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();

  // Not authenticated - redirect to login
  if (!user) {
    redirect("/login");
  }

  // Check if user is superadmin
  const userIsSuperadmin = await isSuperadmin(user.id);

  // Get last org from cookie
  const cookieStore = await cookies();
  const lastOrgCookieName = env.LAST_ORG_COOKIE_NAME;
  const lastOrgSlug = cookieStore.get(lastOrgCookieName)?.value;

  // If we have a last org cookie, verify it exists and user has access
  if (lastOrgSlug) {
    const org = await db.organization.findUnique({
      where: { slug: lastOrgSlug },
      include: {
        memberships: {
          where: { userId: user.id },
        },
      },
    });

    // Superadmins have access to all orgs, regular users need membership
    if (org && (userIsSuperadmin || org.memberships.length > 0)) {
      redirect(`/o/${lastOrgSlug}/dashboard`);
    }
  }

  // Try default organization
  if (user.defaultOrganizationId) {
    const defaultOrg = await db.organization.findUnique({
      where: { id: user.defaultOrganizationId },
      include: {
        memberships: {
          where: { userId: user.id },
        },
      },
    });

    // Superadmins have access to all orgs, regular users need membership
    if (defaultOrg && (userIsSuperadmin || defaultOrg.memberships.length > 0)) {
      redirect(`/o/${defaultOrg.slug}/dashboard`);
    }
  }

  // Get user's first organization
  const orgs = await getUserOrganizations(user.id);

  if (orgs.length > 0) {
    redirect(`/o/${orgs[0].slug}/dashboard`);
  }

  // If superadmin sees all orgs even without membership, check for any org
  if (userIsSuperadmin) {
    const anyOrg = await db.organization.findFirst({
      select: { slug: true },
    });

    if (anyOrg) {
      redirect(`/o/${anyOrg.slug}/dashboard`);
    }

    // Superadmin with no orgs - allow them to create
    redirect("/onboarding/create-organization");
  }

  // No organizations - check if user can create
  if (!env.ORG_CREATION_ENABLED) {
    // Cannot create org - show denial page with toast
    return <OrgCreationDenied />;
  }

  // Check org creation limit
  const orgCount = await db.organization.count({
    where: { createdById: user.id },
  });

  if (orgCount >= env.ORG_CREATION_LIMIT) {
    // Limit reached - show denial page with toast
    return <OrgCreationDenied />;
  }

  // User can create - redirect to onboarding
  redirect("/onboarding/create-organization");
}
