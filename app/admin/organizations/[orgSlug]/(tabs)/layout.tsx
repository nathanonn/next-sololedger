import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrganizationTabs } from "@/components/features/admin/organization-tabs";

/**
 * Organization Tabs Layout
 * Server layout that renders header and tabs for org detail pages
 */

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
};

export default async function OrganizationTabsLayout({
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
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/admin/organizations">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Organizations
        </Button>
      </Link>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">{org.name}</h1>
        <p className="text-muted-foreground font-mono text-sm">{org.slug}</p>
      </div>

      {/* Tabs */}
      <OrganizationTabs orgSlug={orgSlug} membersCount={org._count.memberships} />

      {/* Tab content */}
      <div>{children}</div>
    </div>
  );
}
