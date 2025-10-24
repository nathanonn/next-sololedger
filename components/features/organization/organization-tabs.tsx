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
  showAiKeys?: boolean;
  showAiUsage?: boolean;
  showIntegrations?: boolean;
  showIntegrationUsage?: boolean;
  aiEnabled?: boolean;
  integrationsEnabled?: boolean;
  integrationsUsageLoggingEnabled?: boolean;
};

export function OrganizationTabs({
  baseHref,
  membersCount,
  showGeneral = true,
  showMembers = true,
  showAiKeys = true,
  showAiUsage = true,
  showIntegrations = true,
  showIntegrationUsage = true,
  aiEnabled = false,
  integrationsEnabled = false,
  integrationsUsageLoggingEnabled = false,
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
        {aiEnabled && showAiKeys && (
          <Link href={`${baseHref}/ai-keys`}>
            <TabsTrigger value="ai-keys">AI API Keys</TabsTrigger>
          </Link>
        )}
        {aiEnabled && showAiUsage && (
          <Link href={`${baseHref}/ai-usage`}>
            <TabsTrigger value="ai-usage">AI Usage</TabsTrigger>
          </Link>
        )}
        {integrationsEnabled && showIntegrations && (
          <Link href={`${baseHref}/integrations`}>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </Link>
        )}
        {integrationsEnabled && integrationsUsageLoggingEnabled && showIntegrationUsage && (
          <Link href={`${baseHref}/integration-usage`}>
            <TabsTrigger value="integration-usage">Integration Usage</TabsTrigger>
          </Link>
        )}
      </TabsList>
    </Tabs>
  );
}
