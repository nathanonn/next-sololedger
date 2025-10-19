import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditOrganizationButton } from "@/components/features/admin/edit-organization-button";

/**
 * Reusable Organization General Details Card
 * Shows organization name, slug, and created date
 * Optionally shows edit button
 */

type Organization = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
};

type OrganizationGeneralCardProps = {
  org: Organization;
  showEdit?: boolean;
  appUrl?: string;
  lastOrgCookieName?: string;
  canEditSlug?: boolean;
};

export function OrganizationGeneralCard({
  org,
  showEdit = true,
  appUrl,
  lastOrgCookieName,
  canEditSlug = true,
}: OrganizationGeneralCardProps): React.JSX.Element {
  return (
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

        {showEdit && appUrl && lastOrgCookieName && (
          <div className="pt-4">
            <EditOrganizationButton
              orgName={org.name}
              orgSlug={org.slug}
              appUrl={appUrl}
              lastOrgCookieName={lastOrgCookieName}
              canEditSlug={canEditSlug}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
