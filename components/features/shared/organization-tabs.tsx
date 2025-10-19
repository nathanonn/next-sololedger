"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

/**
 * Generic organization tabs navigation
 * Client component that highlights active tab based on route segment
 * Reusable for both admin and org-level settings
 */

type OrganizationTabsProps = {
  baseHref: string;
  membersCount: number;
  showGeneral?: boolean;
  showMembers?: boolean;
};

export function OrganizationTabs({
  baseHref,
  membersCount,
  showGeneral = true,
  showMembers = true,
}: OrganizationTabsProps): React.JSX.Element {
  const segment = useSelectedLayoutSegment();
  const activeTab = segment || "general";

  return (
    <Tabs value={activeTab} className="w-full">
      <TabsList>
        {showGeneral && (
          <Link href={`${baseHref}/general`}>
            <TabsTrigger value="general">General</TabsTrigger>
          </Link>
        )}
        {showMembers && (
          <Link href={`${baseHref}/members`}>
            <TabsTrigger value="members" className="gap-2">
              Members
              <Badge variant="secondary" className="ml-1">
                {membersCount}
              </Badge>
            </TabsTrigger>
          </Link>
        )}
      </TabsList>
    </Tabs>
  );
}
