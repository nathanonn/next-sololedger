import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import {
  getOrgBySlug,
  isSuperadmin,
  getUserMembership,
} from "@/lib/org-helpers";
import { OrganizationSettingsLayout } from "@/components/features/organization/organization-settings-layout";

/**
 * Organization Settings Tabs Layout
 * Server layout that renders tabs for organization settings pages
 * Requires admin or superadmin role
 */

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
};

export default async function OrganizationSettingsTabsLayout({
  children,
  params,
}: LayoutProps): Promise<React.JSX.Element> {
  const { orgSlug } = await params;

  // Validate session
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/o/${orgSlug}/settings/organization`);
  }

  // Get organization
  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    redirect("/");
  }

  // Check if user is superadmin
  const userIsSuperadmin = await isSuperadmin(user.id);

  if (!userIsSuperadmin) {
    // Not a superadmin - check if admin
    const membership = await getUserMembership(user.id, org.id);

    if (!membership || membership.role !== "admin") {
      // Not an admin - redirect with notice
      redirect(`/o/${orgSlug}/dashboard?notice=forbidden`);
    }
  }

  // Load members count for badge
  const membersCount = await db.membership.count({
    where: {
      organizationId: org.id,
      user: {
        role: {
          not: "superadmin",
        },
      },
    },
  });

  return (
    <OrganizationSettingsLayout
      title="Organization Settings"
      description="Manage your organization details and members"
      orgSlug={orgSlug}
      membersCount={membersCount}
      baseHref={`/o/${orgSlug}/settings/organization`}
    >
      {children}
    </OrganizationSettingsLayout>
  );
}
