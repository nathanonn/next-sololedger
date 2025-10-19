"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

/**
 * Organization tabs navigation
 * Client component that highlights active tab based on route segment
 */

type OrganizationTabsProps = {
  orgSlug: string;
  membersCount: number;
};

export function OrganizationTabs({
  orgSlug,
  membersCount,
}: OrganizationTabsProps): React.JSX.Element {
  const segment = useSelectedLayoutSegment();
  const activeTab = segment || "general";

  return (
    <Tabs value={activeTab} className="w-full">
      <TabsList>
        <Link href={`/admin/organizations/${orgSlug}/general`}>
          <TabsTrigger value="general">General</TabsTrigger>
        </Link>
        <Link href={`/admin/organizations/${orgSlug}/members`}>
          <TabsTrigger value="members" className="gap-2">
            Members
            <Badge variant="secondary" className="ml-1">
              {membersCount}
            </Badge>
          </TabsTrigger>
        </Link>
      </TabsList>
    </Tabs>
  );
}
