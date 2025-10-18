import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getUserOrganizations } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Root page redirect logic
 * Determines which organization to redirect to based on:
 * 1. last_org cookie
 * 2. defaultOrganizationId
 * 3. First membership
 * 4. Redirect to onboarding if no organizations
 */

export default async function Home(): Promise<JSX.Element> {
  const user = await getCurrentUser();

  // Not authenticated - redirect to login
  if (!user) {
    redirect("/login");
  }

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

    if (org && org.memberships.length > 0) {
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

    if (defaultOrg && defaultOrg.memberships.length > 0) {
      redirect(`/o/${defaultOrg.slug}/dashboard`);
    }
  }

  // Get user's first organization
  const orgs = await getUserOrganizations(user.id);

  if (orgs.length > 0) {
    redirect(`/o/${orgs[0].slug}/dashboard`);
  }

  // No organizations - redirect to onboarding
  redirect("/onboarding/create-organization");
}
