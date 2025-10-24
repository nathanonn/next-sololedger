import { IntegrationsManagement } from "@/components/features/integrations/integrations-management";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function IntegrationsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { orgSlug } = await params;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
        <p className="text-muted-foreground">
          Connect external services to your organization
        </p>
      </div>

      <IntegrationsManagement orgSlug={orgSlug} />
    </div>
  );
}
