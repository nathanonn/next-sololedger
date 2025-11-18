import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import {
  getOrgBySlug,
  getUserMembership,
  isSuperadmin,
} from "@/lib/org-helpers";
import { DashboardShell } from "@/components/features/dashboard/dashboard-shell";
import { env } from "@/lib/env";
import { Settings, Building2 } from "lucide-react";
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
  const userRole = userIsSuperadmin
    ? "superadmin"
    : membership?.role || "member";
  const isAdminOrSuperadmin = userRole === "admin" || userRole === "superadmin";

  // Onboarding guard: redirect to onboarding if not complete
  // Superadmins can bypass for debugging
  if (!org.onboardingComplete && !userIsSuperadmin) {
    // Get organization settings to determine which step to redirect to
    const settings = await db.organizationSettings.findUnique({
      where: { organizationId: org.id },
    });

    // Determine next incomplete step
    if (!settings) {
      // No settings yet, redirect to business details (step 2)
      redirect(`/onboarding/${orgSlug}/business`);
    } else if (!settings.baseCurrency || !settings.fiscalYearStartMonth) {
      // Financial config incomplete, redirect to step 3
      redirect(`/onboarding/${orgSlug}/financial`);
    } else {
      // Check if categories exist
      const categoryCount = await db.category.count({
        where: { organizationId: org.id },
      });

      if (categoryCount === 0) {
        // No categories, redirect to step 4
        redirect(`/onboarding/${orgSlug}/categories`);
      } else {
        // All steps done but not marked complete, redirect to categories to finish
        redirect(`/onboarding/${orgSlug}/categories`);
      }
    }
  }

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
      id: "business",
      label: "Business",
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  // Build all pages (will be filtered below)
  const allPages = [
    // Business section
    {
      id: "dashboard",
      label: "Dashboard",
      href: `/o/${orgSlug}/dashboard`,
      sectionId: "business",
    },
    {
      id: "transactions",
      label: "Transactions",
      href: `/o/${orgSlug}/transactions`,
      sectionId: "business",
    },
    {
      id: "documents",
      label: "Documents",
      href: `/o/${orgSlug}/documents`,
      sectionId: "business",
    },
    {
      id: "accounts",
      label: "Accounts",
      href: `/o/${orgSlug}/settings/accounts`,
      sectionId: "business",
      adminOnly: true, // Only admins can manage accounts
    },
    {
      id: "categories",
      label: "Categories",
      href: `/o/${orgSlug}/settings/categories`,
      sectionId: "business",
      // Members can manage categories
    },
    {
      id: "vendors",
      label: "Vendors",
      href: `/o/${orgSlug}/settings/vendors`,
      sectionId: "business",
      // Members can manage vendors
    },
    {
      id: "clients",
      label: "Clients",
      href: `/o/${orgSlug}/settings/clients`,
      sectionId: "business",
      // Members can manage clients
    },
    {
      id: "reports",
      label: "Reports",
      href: `/o/${orgSlug}/reports`,
      sectionId: "business",
      // All members can view reports
    },
    // Settings section
    {
      id: "profile",
      label: "Profile",
      href: `/o/${orgSlug}/settings/profile`,
      sectionId: "settings",
    },
    {
      id: "organization",
      label: "Organization",
      href: `/o/${orgSlug}/settings/organization/general`,
      sectionId: "settings",
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
