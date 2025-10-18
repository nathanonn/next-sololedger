import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isSuperadmin } from "@/lib/org-helpers";
import { env } from "@/lib/env";
import { db } from "@/lib/db";

/**
 * Create organization onboarding layout with guard
 * Checks if user is allowed to create organizations
 */

export default async function CreateOrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  // Validate session
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/onboarding/create-organization");
  }

  // Check if user is superadmin (always allowed)
  const userIsSuperadmin = await isSuperadmin(user.id);

  if (!userIsSuperadmin) {
    // Check if org creation is enabled
    if (!env.ORG_CREATION_ENABLED) {
      redirect("/login?notice=org_creation_disabled");
    }

    // Check if user hasn't reached the limit
    const orgCount = await db.organization.count({
      where: { createdById: user.id },
    });

    if (orgCount >= env.ORG_CREATION_LIMIT) {
      redirect("/login?notice=org_creation_disabled");
    }
  }

  return <>{children}</>;
}
