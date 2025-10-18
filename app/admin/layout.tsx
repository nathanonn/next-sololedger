import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isSuperadmin } from "@/lib/org-helpers";
import { DashboardShell } from "@/components/features/dashboard/dashboard-shell";
import { Building2, Settings } from "lucide-react";
import { env } from "@/lib/env";
import { db } from "@/lib/db";

/**
 * Admin layout - Superadmin-only access
 * Renders DashboardShell without organization context
 */

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  // Validate session
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/admin/organizations");
  }

  // Check if user is superadmin
  const userIsSuperadmin = await isSuperadmin(user.id);
  if (!userIsSuperadmin) {
    // Not a superadmin - redirect to home with error
    redirect("/?error=unauthorized");
  }

  // Fetch user's defaultOrganization slug for "Back to Dashboard" fallback
  let defaultOrgSlug: string | undefined = undefined;
  if (user.defaultOrganizationId) {
    const defaultOrg = await db.organization.findUnique({
      where: { id: user.defaultOrganizationId },
      select: { slug: true },
    });
    defaultOrgSlug = defaultOrg?.slug;
  }

  // Build sections and pages for admin area
  const sections = [
    {
      id: "admin",
      label: "Admin",
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  const pages = [
    {
      id: "organizations",
      label: "Organizations",
      href: "/admin/organizations",
      sectionId: "admin",
      icon: <Building2 className="h-4 w-4" />,
    },
  ];

  return (
    <DashboardShell
      userId={user.id}
      userEmail={user.email}
      sections={sections}
      pages={pages}
      isSuperadmin={true}
      canCreateOrganizations={true}
      lastOrgCookieName={env.LAST_ORG_COOKIE_NAME}
      defaultOrgSlug={defaultOrgSlug}
    >
      {children}
    </DashboardShell>
  );
}
