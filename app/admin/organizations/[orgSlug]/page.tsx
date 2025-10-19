import { redirect } from "next/navigation";

/**
 * Organization Detail Page (Root)
 * Redirects to the General tab to maintain default behavior
 */

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function OrganizationPage({
  params,
}: PageProps): Promise<never> {
  const { orgSlug } = await params;
  redirect(`/admin/organizations/${orgSlug}/general`);
}
