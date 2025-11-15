import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { OrganizationTabs } from "./organization-tabs";

/**
 * Reusable Organization Settings Layout
 * Works for both admin and org-level settings
 */

type OrganizationSettingsLayoutProps = {
  title: string;
  description?: string;
  backLink?: {
    href: string;
    label: string;
  };
  orgSlug: string;
  membersCount: number;
  baseHref: string;
  maxWidth?: string;
  aiEnabled?: boolean;
  integrationsEnabled?: boolean;
  integrationsUsageLoggingEnabled?: boolean;
  children: React.ReactNode;
};

export function OrganizationSettingsLayout({
  title,
  description,
  backLink,
  membersCount,
  baseHref,
  maxWidth = "max-w-4xl",
  aiEnabled = false,
  integrationsEnabled = false,
  integrationsUsageLoggingEnabled = false,
  children,
}: OrganizationSettingsLayoutProps): React.JSX.Element {
  return (
    <div className={`space-y-6 ${maxWidth}`}>
      {/* Optional Back Link */}
      {backLink && (
        <Link href={backLink.href}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {backLink.label}
          </Button>
        </Link>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Tabs */}
      <OrganizationTabs
        baseHref={baseHref}
        membersCount={membersCount}
        aiEnabled={aiEnabled}
        integrationsEnabled={integrationsEnabled}
        integrationsUsageLoggingEnabled={integrationsUsageLoggingEnabled}
      />

      {/* Tab Content */}
      <div>{children}</div>
    </div>
  );
}
