import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { ApiAccessClient } from "@/components/features/api-keys/api-access-client";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function ApiAccessPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { orgSlug } = await params;

  // Load organization
  const org = await db.organization.findUnique({
    where: { slug: orgSlug },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  if (!org) {
    notFound();
  }

  return <ApiAccessClient org={org} />;
}
