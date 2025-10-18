"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditOrganizationDialog } from "./edit-organization-dialog";

export type EditOrganizationButtonProps = {
  orgName: string;
  orgSlug: string;
  appUrl: string;
  lastOrgCookieName: string;
};

/**
 * Button that opens the Edit Organization dialog
 */
export function EditOrganizationButton({
  orgName,
  orgSlug,
  appUrl,
  lastOrgCookieName,
}: EditOrganizationButtonProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        <Pencil className="h-4 w-4 mr-2" />
        Edit Organization
      </Button>
      <EditOrganizationDialog
        open={open}
        onOpenChange={setOpen}
        orgName={orgName}
        orgSlug={orgSlug}
        appUrl={appUrl}
        lastOrgCookieName={lastOrgCookieName}
      />
    </>
  );
}
