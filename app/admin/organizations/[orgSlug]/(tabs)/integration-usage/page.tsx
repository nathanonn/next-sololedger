import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, isSuperadmin } from "@/lib/org-helpers";
import { env } from "@/lib/env";
import { IntegrationUsageDashboard } from "@/components/features/integrations/integration-usage-dashboard";

/**
 * Admin Integration Usage Logs Page
 * Allows superadmins to view integration API call logs and analytics for any organization
 */

type PageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export default async function AdminIntegrationUsagePage({ params }: PageProps): Promise<React.JSX.Element> {
  const { orgSlug } = await params;

  if (!env.INTEGRATIONS_ENABLED || !env.INTEGRATIONS_USAGE_LOGGING_ENABLED) {
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
        <h2 className="text-2xl font-bold">Integration Usage</h2>
        <p className="text-muted-foreground">
          View integration API call logs and analytics for {org.name}.
        </p>
      </div>

      <IntegrationUsageDashboard orgSlug={orgSlug} />
    </div>
  );
}
