"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateOrganizationDialog } from "./create-organization-dialog";

export type CreateOrganizationButtonProps = {
  appUrl: string;
};

/**
 * Button that opens the Create Organization dialog
 */
export function CreateOrganizationButton({
  appUrl,
}: CreateOrganizationButtonProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Create Organization
      </Button>
      <CreateOrganizationDialog
        open={open}
        onOpenChange={setOpen}
        appUrl={appUrl}
      />
    </>
  );
}
