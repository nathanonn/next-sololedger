import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, isSuperadmin, getUserMembership } from "@/lib/org-helpers";
import { OrganizationTabs as GenericOrganizationTabs } from "@/components/features/shared/organization-tabs";

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
    where: { organizationId: org.id },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Organization Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your organization details and members
        </p>
      </div>

      {/* Tabs */}
      <GenericOrganizationTabs
        baseHref={`/o/${orgSlug}/settings/organization`}
        membersCount={membersCount}
      />

      {/* Tab content */}
      <div>{children}</div>
    </div>
  );
}
