import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { MembersList } from "@/components/features/organization/members-list";
import { PendingInvitationsList } from "@/components/features/organization/pending-invitations-list";

/**
 * Organization Members Settings Tab
 * Server component with reusable members and invitations lists
 * Excludes superadmins from the members list
 */

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function OrganizationMembersPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { orgSlug } = await params;

  // Load organization
  const org = await db.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (!org) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <MembersList
        orgSlug={org.slug}
        orgName={org.name}
        context="org"
        excludeSuperadmins={true}
      />

      <PendingInvitationsList orgSlug={org.slug} />
    </div>
  );
}
