import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { OrganizationSettingsLayout } from "@/components/features/organization/organization-settings-layout";
import { env } from "@/lib/env";

/**
 * Admin Organization Tabs Layout
 * Server layout that renders header and tabs for admin org detail pages
 */

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
};

export default async function AdminOrganizationTabsLayout({
  children,
  params,
}: LayoutProps): Promise<React.JSX.Element> {
  const { orgSlug } = await params;

  // Load organization with members count
  const org = await db.organization.findUnique({
    where: { slug: orgSlug },
    include: {
      _count: {
        select: { memberships: true },
      },
    },
  });

  if (!org) {
    notFound();
  }

  return (
    <OrganizationSettingsLayout
      title={org.name}
      description={org.slug}
      backLink={{
        href: "/admin/organizations",
        label: "Back to Organizations",
      }}
      orgSlug={orgSlug}
      membersCount={org._count.memberships}
      baseHref={`/admin/organizations/${orgSlug}`}
      maxWidth=""
      aiEnabled={env.AI_FEATURES_ENABLED}
      integrationsEnabled={env.INTEGRATIONS_ENABLED}
      integrationsUsageLoggingEnabled={env.INTEGRATIONS_USAGE_LOGGING_ENABLED}
    >
      {children}
    </OrganizationSettingsLayout>
  );
}
