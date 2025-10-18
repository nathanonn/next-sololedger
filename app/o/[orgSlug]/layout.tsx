import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, getUserMembership, isSuperadmin } from "@/lib/org-helpers";
import { DashboardShell } from "@/components/features/dashboard/dashboard-shell";
import { env } from "@/lib/env";
import { Home, Settings, Users } from "lucide-react";
import { db } from "@/lib/db";

/**
 * Organization-scoped protected layout
 * Validates session and organization membership server-side
 */

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}): Promise<React.JSX.Element> {
  const { orgSlug } = await params;

  // Validate session
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/o/${orgSlug}`);
  }

  // Get organization
  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    // Organization not found - redirect to default
    redirect("/");
  }

  // Check if user is superadmin
  const userIsSuperadmin = await isSuperadmin(user.id);

  // Check membership (superadmins bypass membership requirement)
  const membership = await getUserMembership(user.id, org.id);
  if (!membership && !userIsSuperadmin) {
    // Not a member and not superadmin - redirect
    redirect("/?error=not_a_member");
  }

  // Determine user's role (use membership role or 'superadmin')
  const userRole = userIsSuperadmin ? "superadmin" : membership?.role || "member";
  const isAdminOrSuperadmin = userRole === "admin" || userRole === "superadmin";

  // Compute canCreateOrganizations
  let canCreateOrganizations = false;
  if (userIsSuperadmin) {
    canCreateOrganizations = true;
  } else if (env.ORG_CREATION_ENABLED) {
    // Check if user hasn't reached the limit
    const orgCount = await db.organization.count({
      where: { createdById: user.id },
    });
    canCreateOrganizations = orgCount < env.ORG_CREATION_LIMIT;
  }

  // Build sections and pages with org-scoped URLs
  const sections = [
    {
      id: "main",
      label: "Main",
      icon: <Home className="h-4 w-4" />,
    },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  // Build all pages (will be filtered below)
  const allPages = [
    {
      id: "dashboard",
      label: "Dashboard",
      href: `/o/${orgSlug}/dashboard`,
      sectionId: "main",
    },
    {
      id: "profile",
      label: "Profile",
      href: `/o/${orgSlug}/settings/profile`,
      sectionId: "settings",
    },
    {
      id: "organization",
      label: "Organization",
      href: `/o/${orgSlug}/settings/organization`,
      sectionId: "settings",
      adminOnly: true, // Only visible to admins/superadmins
    },
    {
      id: "members",
      label: "Members",
      href: `/o/${orgSlug}/settings/members`,
      sectionId: "settings",
      icon: <Users className="h-4 w-4" />,
      adminOnly: true, // Only visible to admins/superadmins
    },
  ];

  // Filter pages based on role
  const pages = allPages.filter((page) => {
    if (page.adminOnly && !isAdminOrSuperadmin) {
      return false;
    }
    return true;
  });

  return (
    <DashboardShell
      userId={user.id}
      userEmail={user.email}
      sections={sections}
      pages={pages}
      // Pass org context for the org switcher
      currentOrg={{
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: userRole,
      }}
      lastOrgCookieName={env.LAST_ORG_COOKIE_NAME}
      canCreateOrganizations={canCreateOrganizations}
      isSuperadmin={userIsSuperadmin}
    >
      {children}
    </DashboardShell>
  );
}
