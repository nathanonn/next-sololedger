import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, isSuperadmin } from "@/lib/org-helpers";
import { env } from "@/lib/env";
import { AiKeysManagement } from "@/components/features/ai/ai-keys-management";

/**
 * Admin AI API Keys Management Page
 * Allows superadmins to configure provider API keys and models for any organization
 */

type PageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export default async function AdminAiKeysPage({ params }: PageProps): Promise<React.JSX.Element> {
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
        <h2 className="text-2xl font-bold">AI API Keys</h2>
        <p className="text-muted-foreground">
          Configure AI provider API keys and manage curated models for {org.name}.
        </p>
      </div>

      <AiKeysManagement orgSlug={orgSlug} />
    </div>
  );
}
