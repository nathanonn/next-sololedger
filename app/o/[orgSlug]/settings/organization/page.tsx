import { redirect } from "next/navigation";

/**
 * Organization Settings Page (Root)
 * Redirects to the General tab to maintain default behavior
 */

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function OrganizationSettingsPage({
  params,
}: PageProps): Promise<never> {
  const { orgSlug } = await params;
  redirect(`/o/${orgSlug}/settings/organization/general`);
}
