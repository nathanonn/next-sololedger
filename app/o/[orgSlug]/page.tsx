import { redirect } from "next/navigation";

/**
 * Organization root page
 * Redirects to the dashboard
 */
export default async function OrgPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<never> {
  const { orgSlug } = await params;
  redirect(`/o/${orgSlug}/dashboard`);
}
