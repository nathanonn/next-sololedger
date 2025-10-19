import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteOrganizationDialog } from "@/components/features/admin/delete-organization-dialog";

/**
 * Reusable Organization Danger Zone Card
 * Conditionally rendered based on user permissions
 * Only visible to superadmins
 */

type OrganizationDangerZoneProps = {
  orgSlug: string;
  orgName: string;
  show: boolean;
};

export function OrganizationDangerZone({
  orgSlug,
  orgName,
  show,
}: OrganizationDangerZoneProps): React.JSX.Element | null {
  if (!show) {
    return null;
  }

  return (
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

        <DeleteOrganizationDialog orgSlug={orgSlug} orgName={orgName} />
      </CardContent>
    </Card>
  );
}
