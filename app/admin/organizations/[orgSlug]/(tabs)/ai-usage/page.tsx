import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, isSuperadmin } from "@/lib/org-helpers";
import { env } from "@/lib/env";
import { AiUsageDashboard } from "@/components/features/ai/ai-usage-dashboard";

/**
 * Admin AI Usage Logs Page
 * Allows superadmins to view AI generation logs and analytics for any organization
 */

type PageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export default async function AdminAiUsagePage({ params }: PageProps): Promise<React.JSX.Element> {
  const { orgSlug } = await params;

  if (!env.AI_FEATURES_ENABLED) {
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
        <h2 className="text-2xl font-bold">AI Usage</h2>
        <p className="text-muted-foreground">
          View AI generation logs, analytics, and manage data retention for {org.name}.
        </p>
      </div>

      <AiUsageDashboard orgSlug={orgSlug} />
    </div>
  );
}
