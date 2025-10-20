import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { env } from "@/lib/env";
import { AiUsageDashboard } from "@/components/features/ai/ai-usage-dashboard";

/**
 * AI Usage Logs Page
 * Allows organization admins to view AI generation logs and analytics
 */

type PageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export default async function AiUsagePage({ params }: PageProps): Promise<React.JSX.Element> {
  const { orgSlug } = await params;

  if (!env.AI_FEATURES_ENABLED) {
    redirect(`/o/${orgSlug}/settings/organization/general`);
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const org = await getOrgBySlug(orgSlug);
  if (!org) redirect("/dashboard");

  // Verify user is admin or superadmin
  try {
    await requireAdminOrSuperadmin(user.id, org.id);
  } catch {
    redirect(`/o/${orgSlug}/dashboard`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">AI Usage</h2>
        <p className="text-muted-foreground">
          View AI generation logs, analytics, and manage data retention for your organization.
        </p>
      </div>

      <AiUsageDashboard orgSlug={orgSlug} />
    </div>
  );
}
