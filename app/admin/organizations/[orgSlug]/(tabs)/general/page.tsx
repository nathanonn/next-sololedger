import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isSuperadmin } from "@/lib/org-helpers";
import { OrganizationGeneralCard } from "@/components/features/organization/organization-general-card";
import { OrganizationDangerZone } from "@/components/features/organization/organization-danger-zone";

/**
 * Admin Organization General Tab
 * Server component showing organization metadata and danger zone (superadmin only)
 */

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function AdminOrganizationGeneralPage({
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

  // Check if current user is superadmin
  const user = await getCurrentUser();
  const userIsSuperadmin = user ? await isSuperadmin(user.id) : false;

  return (
    <div className="space-y-6">
      <OrganizationGeneralCard
        org={org}
        showEdit={true}
        appUrl={env.APP_URL}
        lastOrgCookieName={env.LAST_ORG_COOKIE_NAME}
      />

      <OrganizationDangerZone
        orgSlug={org.slug}
        orgName={org.name}
        show={userIsSuperadmin}
      />
    </div>
  );
}
