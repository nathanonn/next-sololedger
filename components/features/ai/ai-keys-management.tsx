"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AiProviderTab } from "./AiProviderTab";

type Provider = {
  provider: string;
  displayName: string;
  status: "verified" | "missing";
  lastFour: string | null;
  lastVerifiedAt: string | null;
  defaultModel: { name: string; label: string } | null;
};

type AiKeysManagementProps = {
  orgSlug: string;
};

export function AiKeysManagement({ orgSlug }: AiKeysManagementProps): React.JSX.Element {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<string>("");

  // Fetch providers status
  const fetchProviders = async (): Promise<void> => {
    try {
      const res = await fetch(`/api/orgs/${orgSlug}/ai/keys`);
      if (!res.ok) throw new Error("Failed to fetch providers");
      const data = await res.json();
      setProviders(data.providers);

      // Set initial tab from localStorage or first provider
      if (data.providers.length > 0) {
        const storageKey = `app.v1.ai.providerTab:${orgSlug}`;
        const savedTab = localStorage.getItem(storageKey);
        const isValidTab = savedTab && data.providers.some((p: Provider) => p.provider === savedTab);
        setSelectedTab(isValidTab ? savedTab : data.providers[0].provider);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug]);

  // Save tab selection to localStorage
  const handleTabChange = (value: string): void => {
    setSelectedTab(value);
    const storageKey = `app.v1.ai.providerTab:${orgSlug}`;
    localStorage.setItem(storageKey, value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="text-center p-12">
        <p className="text-sm text-muted-foreground">No AI providers available</p>
      </div>
    );
  }

  return (
    <Tabs value={selectedTab} onValueChange={handleTabChange}>
      <TabsList className="w-full justify-start">
        {providers.map((provider) => (
          <TabsTrigger key={provider.provider} value={provider.provider} className="gap-2">
            {provider.displayName}
            <Badge
              variant={provider.status === "verified" ? "default" : "secondary"}
              className="ml-1"
            >
              {provider.status === "verified" ? "Verified" : "Missing"}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>

      {providers.map((provider) => (
        <TabsContent key={provider.provider} value={provider.provider} className="mt-6">
          <AiProviderTab
            orgSlug={orgSlug}
            provider={provider}
            onProvidersChanged={fetchProviders}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
