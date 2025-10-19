import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isSuperadmin } from "@/lib/org-helpers";
import { OrganizationGeneralCard } from "@/components/features/organization/organization-general-card";

/**
 * Organization General Settings Tab
 * Server component showing organization metadata (no Danger Zone)
 */

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function OrganizationGeneralPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { orgSlug } = await params;

  // Load organization
  const org = await db.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (!org) {
    notFound();
  }

  // Check if current user is superadmin (for slug editing)
  const user = await getCurrentUser();
  const userIsSuperadmin = user ? await isSuperadmin(user.id) : false;

  return (
    <div className="space-y-6">
      <OrganizationGeneralCard
        org={org}
        showEdit={true}
        appUrl={env.APP_URL}
        lastOrgCookieName={env.LAST_ORG_COOKIE_NAME}
        canEditSlug={userIsSuperadmin}
      />
    </div>
  );
}
