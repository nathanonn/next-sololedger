import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { env } from "@/lib/env";
import { AiKeysManagement } from "@/components/features/ai/ai-keys-management";

/**
 * AI API Keys Management Page
 * Allows organization admins to configure provider API keys and models
 */

type PageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export default async function AiKeysPage({ params }: PageProps): Promise<React.JSX.Element> {
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
        <h2 className="text-2xl font-bold">AI API Keys</h2>
        <p className="text-muted-foreground">
          Configure AI provider API keys and manage curated models for your organization.
        </p>
      </div>

      <AiKeysManagement orgSlug={orgSlug} />
    </div>
  );
}
