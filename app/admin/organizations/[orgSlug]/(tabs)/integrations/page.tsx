import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, isSuperadmin } from "@/lib/org-helpers";
import { env } from "@/lib/env";
import { IntegrationsManagement } from "@/components/features/integrations/integrations-management";

/**
 * Admin Integrations Management Page
 * Allows superadmins to connect and manage external integrations for any organization
 */

type PageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export default async function AdminIntegrationsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { orgSlug } = await params;

  if (!env.INTEGRATIONS_ENABLED) {
    redirect(`/admin/organizations/${orgSlug}/general`);
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Verify user is superadmin
  const userIsSuperadmin = await isSuperadmin(user.id);
  if (!userIsSuperadmin) redirect("/dashboard");

  const org = await getOrgBySlug(orgSlug);
  if (!org) redirect("/admin/organizations");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Integrations</h2>
        <p className="text-muted-foreground">
          Connect external services for {org.name}.
        </p>
      </div>

      <IntegrationsManagement orgSlug={orgSlug} />
    </div>
  );
}
