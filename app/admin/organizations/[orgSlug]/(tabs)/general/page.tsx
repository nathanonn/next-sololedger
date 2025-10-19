import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditOrganizationButton } from "@/components/features/admin/edit-organization-button";
import { DeleteOrganizationDialog } from "@/components/features/admin/delete-organization-dialog";

/**
 * Organization General Tab
 * Server component showing organization metadata and danger zone
 */

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function OrganizationGeneralPage({
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
      {/* Organization Details */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>
            View and manage organization information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="grid grid-cols-[120px_1fr] items-center gap-4">
              <span className="text-sm font-medium">Name</span>
              <span className="text-sm">{org.name}</span>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-center gap-4">
              <span className="text-sm font-medium">Slug</span>
              <span className="text-sm font-mono text-muted-foreground">
                {org.slug}
              </span>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-center gap-4">
              <span className="text-sm font-medium">Created</span>
              <span className="text-sm">
                {new Date(org.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="pt-4">
            <EditOrganizationButton
              orgName={org.name}
              orgSlug={org.slug}
              appUrl={env.APP_URL}
              lastOrgCookieName={env.LAST_ORG_COOKIE_NAME}
            />
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions that affect this organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Deleting this organization is irreversible. It will remove all
              memberships and invitations. Audit logs will be retained for
              compliance purposes.
            </p>
          </div>

          <DeleteOrganizationDialog orgSlug={org.slug} orgName={org.name} />
        </CardContent>
      </Card>
    </div>
  );
}
