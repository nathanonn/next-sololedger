import { IntegrationUsageDashboard } from "@/components/features/integrations/integration-usage-dashboard";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function IntegrationUsagePage({ params }: PageProps): Promise<React.JSX.Element> {
  const { orgSlug } = await params;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Integration Usage</h2>
        <p className="text-muted-foreground">
          Monitor API calls to integrated services
        </p>
      </div>

      <IntegrationUsageDashboard orgSlug={orgSlug} />
    </div>
  );
}
