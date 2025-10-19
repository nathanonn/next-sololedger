"use client";

import { OrganizationTabs as GenericOrganizationTabs } from "@/components/features/shared/organization-tabs";

/**
 * Admin organization tabs navigation
 * Wrapper around generic OrganizationTabs with admin-specific base href
 */

type OrganizationTabsProps = {
  orgSlug: string;
  membersCount: number;
};

export function OrganizationTabs({
  orgSlug,
  membersCount,
}: OrganizationTabsProps): React.JSX.Element {
  return (
    <GenericOrganizationTabs
      baseHref={`/admin/organizations/${orgSlug}`}
      membersCount={membersCount}
    />
  );
}
