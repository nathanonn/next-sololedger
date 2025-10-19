import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { MembersList } from "@/components/features/organization/members-list";
import { PendingInvitationsList } from "@/components/features/organization/pending-invitations-list";

/**
 * Admin Organization Members Tab
 * Server component with reusable members and invitations lists
 */

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function AdminOrganizationMembersPage({
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
        context="admin"
        excludeSuperadmins={false}
      />

      <PendingInvitationsList orgSlug={org.slug} />
    </div>
  );
}
