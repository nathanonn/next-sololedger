import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, getUserMembership } from "@/lib/org-helpers";
import { DashboardShell } from "@/components/features/dashboard/dashboard-shell";
import { env } from "@/lib/env";
import { Home, Settings, Users } from "lucide-react";

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

  // Check membership
  const membership = await getUserMembership(user.id, org.id);
  if (!membership) {
    // Not a member - show access denied or redirect
    redirect("/?error=not_a_member");
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

  const pages = [
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
    },
    {
      id: "members",
      label: "Members",
      href: `/o/${orgSlug}/settings/members`,
      sectionId: "settings",
      icon: <Users className="h-4 w-4" />,
      badge: membership.role === "admin" ? undefined : undefined,
    },
  ];

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
        role: membership.role,
      }}
      lastOrgCookieName={env.LAST_ORG_COOKIE_NAME}
    >
      {children}
    </DashboardShell>
  );
}
