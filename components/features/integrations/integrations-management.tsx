"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ChevronDown, Loader2 } from "lucide-react";
import { IntegrationTestDialog } from "@/components/features/integrations/integration-test-dialog";
import { NotionInternalConnectDialog } from "@/components/features/integrations/notion-internal-connect-dialog";
import { WordPressInternalConnectDialog } from "@/components/features/integrations/wordpress-internal-connect-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type IntegrationProvider = {
  provider: string;
  displayName: string;
  connected: boolean;
  status: string;
  accountId: string | null;
  accountName: string | null;
  scope: string | null;
  lastUpdated: string | null;
  variantsAllowed?: { public: boolean; internal: boolean };
  connectionType?: string | null;
};

type IntegrationsManagementProps = {
  orgSlug: string;
};

export function IntegrationsManagement({ orgSlug }: IntegrationsManagementProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [disconnectDialog, setDisconnectDialog] = useState<{
    provider: string;
    displayName: string;
  } | null>(null);
  const [testDialog, setTestDialog] = useState<{
    provider: string;
    displayName: string;
    accountId: string | null;
  } | null>(null);
  const [notionInternalDialog, setNotionInternalDialog] = useState<{
    mode: "connect" | "update";
  } | null>(null);
  const [wordpressInternalDialog, setWordpressInternalDialog] = useState<{
    mode: "connect" | "update";
  } | null>(null);

  // Fetch integrations
  useEffect(() => {
    fetchIntegrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle OAuth callback messages
  useEffect(() => {
    const connected = searchParams.get("connected");
    const accountName = searchParams.get("accountName");
    const error = searchParams.get("error");

    if (connected) {
      const providerName = providers.find((p) => p.provider === connected)?.displayName || connected;
      toast.success(`${providerName} connected successfully${accountName ? ` as ${accountName}` : ""}`);

      // Clean URL
      router.replace(`/o/${orgSlug}/settings/organization/integrations`);

      // Refresh data
      fetchIntegrations();
    }

    if (error) {
      toast.error(`Connection failed: ${error}`);
      router.replace(`/o/${orgSlug}/settings/organization/integrations`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function fetchIntegrations(): Promise<void> {
    try {
      setLoading(true);
      const response = await fetch(`/api/orgs/${orgSlug}/integrations`);

      if (!response.ok) {
        throw new Error("Failed to fetch integrations");
      }

      const data = await response.json();
      setProviders(data.providers || []);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      toast.error("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(provider: string): Promise<void> {
    try {
      setConnectingProvider(provider);

      const response = await fetch(
        `/api/orgs/${orgSlug}/integrations/${provider}/authorize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to initiate connection");
      }

      const data = await response.json();

      // Redirect to provider OAuth page
      window.location.href = data.url;
    } catch (error) {
      console.error("Error connecting integration:", error);
      toast.error(error instanceof Error ? error.message : "Failed to connect");
      setConnectingProvider(null);
    }
  }

  async function handleDisconnect(): Promise<void> {
    if (!disconnectDialog) return;

    const { provider, displayName } = disconnectDialog;

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/integrations/${provider}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to disconnect");
      }

      toast.success(`${displayName} disconnected successfully`);
      setDisconnectDialog(null);

      // Refresh data
      fetchIntegrations();
    } catch (error) {
      console.error("Error disconnecting integration:", error);
      toast.error(error instanceof Error ? error.message : "Failed to disconnect");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Integrations Available</CardTitle>
          <CardDescription>
            No integration providers are currently enabled for this deployment.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {providers.map((integration) => (
        <Card key={integration.provider}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {integration.displayName}
                  {integration.connected && (
                    <Badge variant="default">Connected</Badge>
                  )}
                  {integration.status === "error" && (
                    <Badge variant="destructive">Error</Badge>
                  )}
                  {integration.provider === "notion" && integration.connectionType && (
                    <Badge variant="outline">
                      Type: {integration.connectionType === "public" ? "Public" : "Internal"}
                    </Badge>
                  )}
                </CardTitle>
                {integration.accountName && (
                  <CardDescription>
                    Account: {integration.accountName}
                  </CardDescription>
                )}
                {integration.lastUpdated && (
                  <CardDescription className="text-xs mt-1">
                    Last updated: {new Date(integration.lastUpdated).toLocaleString()}
                  </CardDescription>
                )}
                {integration.provider === "notion" && integration.connectionType === "internal" && integration.connected && (
                  <CardDescription className="text-xs mt-2 text-amber-600">
                    Ensure required pages/databases are shared with the integration in Notion.
                  </CardDescription>
                )}
              </div>
              <div className="flex gap-2">
                {!integration.connected || integration.status === "error" ? (
                  // Not connected or in error state
                  integration.provider === "notion" && integration.variantsAllowed ? (
                    // Notion with variants - show dropdown
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button disabled={connectingProvider === integration.provider}>
                          {connectingProvider === integration.provider && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          {integration.status === "error" ? "Reconnect" : "Connect"}
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {integration.variantsAllowed.public && (
                          <DropdownMenuItem onClick={() => handleConnect(integration.provider)}>
                            {integration.status === "error" && integration.connectionType === "public"
                              ? "Reconnect with OAuth (Public)"
                              : "Connect with OAuth (Public)"}
                          </DropdownMenuItem>
                        )}
                        {integration.variantsAllowed.internal && (
                          <DropdownMenuItem onClick={() => setNotionInternalDialog({ mode: integration.status === "error" && integration.connectionType === "internal" ? "update" : "connect" })}>
                            {integration.status === "error" && integration.connectionType === "internal"
                              ? "Update Token (Internal)"
                              : "Connect with Token (Internal)"}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : integration.provider === "wordpress" ? (
                    // WordPress uses internal connection dialog
                    <Button
                      onClick={() => setWordpressInternalDialog({ mode: integration.status === "error" ? "update" : "connect" })}
                      disabled={connectingProvider === integration.provider}
                    >
                      {integration.status === "error" ? "Reconnect" : "Connect"}
                    </Button>
                  ) : (
                    // Standard connect button for OAuth providers (Reddit, LinkedIn)
                    <Button
                      onClick={() => handleConnect(integration.provider)}
                      disabled={connectingProvider === integration.provider}
                    >
                      {connectingProvider === integration.provider && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {integration.status === "error" ? "Reconnect" : "Connect"}
                    </Button>
                  )
                ) : (
                  // Connected
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setTestDialog({
                          provider: integration.provider,
                          displayName: integration.displayName,
                          accountId: integration.accountId,
                        })
                      }
                    >
                      Test Connection
                    </Button>
                    {integration.provider === "notion" && integration.connectionType === "internal" && (
                      <Button
                        variant="outline"
                        onClick={() => setNotionInternalDialog({ mode: "update" })}
                      >
                        Update Token
                      </Button>
                    )}
                    {integration.provider === "wordpress" && (
                      <Button
                        variant="outline"
                        onClick={() => setWordpressInternalDialog({ mode: "update" })}
                      >
                        Update Credentials
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() =>
                        setDisconnectDialog({
                          provider: integration.provider,
                          displayName: integration.displayName,
                        })
                      }
                    >
                      Disconnect
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          {integration.scope && (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Scopes: {integration.scope}
              </p>
            </CardContent>
          )}
        </Card>
      ))}

      {/* Disconnect confirmation dialog */}
      <AlertDialog
        open={!!disconnectDialog}
        onOpenChange={(open) => {
          if (!open) setDisconnectDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Integration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect {disconnectDialog?.displayName}?
              This will revoke access and remove all tokens.
              {disconnectDialog?.provider === "notion" && (
                <span className="block mt-2">
                  You may also need to disconnect the integration in your Notion
                  workspace settings.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect}>
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test connection dialog */}
      {testDialog && (
        <IntegrationTestDialog
          open={!!testDialog}
          onOpenChange={(open) => {
            if (!open) setTestDialog(null);
          }}
          orgSlug={orgSlug}
          provider={testDialog.provider}
          displayName={testDialog.displayName}
          baseUrlOverride={
            testDialog.provider === "wordpress" && testDialog.accountId
              ? testDialog.accountId
              : undefined
          }
        />
      )}

      {/* Notion internal connect/update dialog */}
      {notionInternalDialog && (
        <NotionInternalConnectDialog
          open={!!notionInternalDialog}
          onOpenChange={(open) => {
            if (!open) {
              setNotionInternalDialog(null);
              setTimeout(() => {
                document.body.style.pointerEvents = "";
              }, 300);
            }
          }}
          orgSlug={orgSlug}
          mode={notionInternalDialog.mode}
          onSuccess={() => {
            setNotionInternalDialog(null);
            fetchIntegrations();
          }}
        />
      )}

      {/* WordPress internal connect/update dialog */}
      {wordpressInternalDialog && (
        <WordPressInternalConnectDialog
          open={!!wordpressInternalDialog}
          onOpenChange={(open) => {
            if (!open) {
              setWordpressInternalDialog(null);
              setTimeout(() => {
                document.body.style.pointerEvents = "";
              }, 300);
            }
          }}
          orgSlug={orgSlug}
          mode={wordpressInternalDialog.mode}
          onSuccess={() => {
            setWordpressInternalDialog(null);
            fetchIntegrations();
          }}
        />
      )}
    </div>
  );
}
