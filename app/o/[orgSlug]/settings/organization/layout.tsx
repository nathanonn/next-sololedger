import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, isSuperadmin, getUserMembership } from "@/lib/org-helpers";

/**
 * Organization settings layout with admin/superadmin guard
 * Only admins and superadmins can access organization settings
 */

export default async function OrganizationSettingsLayout({
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

  return <>{children}</>;
}
