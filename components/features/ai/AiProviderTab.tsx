"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Loader2, Trash2, ExternalLink } from "lucide-react";
import { AiPlaygroundModal } from "./AiPlaygroundModal";
import Link from "next/link";

type Provider = {
  provider: string;
  displayName: string;
  status: "verified" | "missing";
  lastFour: string | null;
  lastVerifiedAt: string | null;
  defaultModel: { name: string; label: string } | null;
};

type CuratedModel = {
  id: string;
  label: string;
  maxOutputTokens: number;
  description?: string;
};

type ConfiguredModel = {
  id: string;
  name: string;
  label: string;
  maxOutputTokens: number;
  isDefault: boolean;
  provider: string;
};

type AiProviderTabProps = {
  orgSlug: string;
  provider: Provider;
  onProvidersChanged?: () => void;
};

export function AiProviderTab({
  orgSlug,
  provider,
  onProvidersChanged,
}: AiProviderTabProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [curatedModels, setCuratedModels] = useState<CuratedModel[]>([]);
  const [configuredModels, setConfiguredModels] = useState<ConfiguredModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [addingModel, setAddingModel] = useState<string | null>(null);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [deleteKeyConfirm, setDeleteKeyConfirm] = useState<boolean>(false);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);

  // Fetch models for this provider
  const fetchModels = async (): Promise<void> => {
    setLoadingModels(true);
    try {
      const res = await fetch(`/api/orgs/${orgSlug}/ai/models?provider=${provider.provider}`);
      if (!res.ok) throw new Error("Failed to fetch models");
      const data = await res.json();
      setCuratedModels(data.curatedModels || []);
      setConfiguredModels(
        data.configured?.filter((m: ConfiguredModel) => m.provider === provider.provider) ||
          []
      );
    } catch (error) {
      toast.error("Failed to load models");
      console.error(error);
    } finally {
      setLoadingModels(false);
    }
  };

  // Load models when provider is verified
  useEffect(() => {
    if (provider.status === "verified") {
      fetchModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.provider, provider.status]);

  // Verify and save API key
  const handleSaveKey = async (): Promise<void> => {
    if (!apiKey.trim()) {
      toast.error("API key is required");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch(`/api/orgs/${orgSlug}/ai/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provider.provider,
          apiKey: apiKey.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to verify API key");
        return;
      }

      toast.success(data.message);
      setApiKey("");
      onProvidersChanged?.();
      await fetchModels();
    } catch (error) {
      toast.error("Network error. Please try again.");
      console.error(error);
    } finally {
      setVerifying(false);
    }
  };

  // Delete API key
  const handleDeleteKey = async (): Promise<void> => {
    try {
      const res = await fetch(`/api/orgs/${orgSlug}/ai/keys`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.provider }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to delete API key");
        return;
      }

      toast.success(data.message);
      onProvidersChanged?.();
      setDeleteKeyConfirm(false);
      setCuratedModels([]);
      setConfiguredModels([]);
    } catch (error) {
      toast.error("Network error. Please try again.");
      console.error(error);
    }
  };

  // Add model
  const handleAddModel = async (modelId: string): Promise<void> => {
    setAddingModel(modelId);
    try {
      const res = await fetch(`/api/orgs/${orgSlug}/ai/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provider.provider,
          modelName: modelId,
          setAsDefault: configuredModels.length === 0, // First model is default
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to add model");
        return;
      }

      toast.success("Model added successfully");
      await fetchModels();
      onProvidersChanged?.();
    } catch (error) {
      toast.error("Network error. Please try again.");
      console.error(error);
    } finally {
      setAddingModel(null);
    }
  };

  // Remove model
  const handleRemoveModel = async (modelId: string): Promise<void> => {
    setDeletingModel(modelId);
    try {
      const res = await fetch(`/api/orgs/${orgSlug}/ai/models`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to remove model");
        return;
      }

      toast.success("Model removed successfully");
      await fetchModels();
      onProvidersChanged?.();
    } catch (error) {
      toast.error("Network error. Please try again.");
      console.error(error);
    } finally {
      setDeletingModel(null);
    }
  };

  // Set default model
  const handleSetDefault = async (modelId: string): Promise<void> => {
    setSettingDefault(modelId);
    try {
      const res = await fetch(`/api/orgs/${orgSlug}/ai/models/${modelId}/default`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to set default model");
        return;
      }

      toast.success("Default model updated");
      await fetchModels();
      onProvidersChanged?.();
    } catch (error) {
      toast.error("Network error. Please try again.");
      console.error(error);
    } finally {
      setSettingDefault(null);
    }
  };

  const canOpenPlayground = provider.status === "verified" && configuredModels.length > 0;

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className="flex items-center gap-2">
        <Badge variant={provider.status === "verified" ? "default" : "secondary"}>
          {provider.status === "verified" ? "Verified" : "Missing"}
        </Badge>
        {provider.lastFour && (
          <span className="text-sm text-muted-foreground">****{provider.lastFour}</span>
        )}
        {provider.lastVerifiedAt && (
          <span className="text-xs text-muted-foreground">
            Last verified: {new Date(provider.lastVerifiedAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* API Key Section */}
      <div className="space-y-3">
        <Label htmlFor="api-key">API Key</Label>
        <div className="flex gap-2">
          <Input
            id="api-key"
            type="password"
            placeholder={
              provider.status === "verified"
                ? `****${provider.lastFour} (verified)`
                : "Enter your API key"
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={verifying}
          />
          <Button onClick={handleSaveKey} disabled={verifying || !apiKey.trim()}>
            {verifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify & Save"
            )}
          </Button>
        </div>
        {provider.status === "missing" && (
          <p className="text-sm text-muted-foreground">
            Add an API key to enable models and playground.
          </p>
        )}
      </div>

      {/* Models Section */}
      {provider.status === "verified" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Configured Models</Label>
            {loadingModels && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>

          {configuredModels.length > 0 ? (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Max Tokens</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configuredModels.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell className="font-medium">{model.label}</TableCell>
                      <TableCell>{model.maxOutputTokens}</TableCell>
                      <TableCell>
                        {model.isDefault ? (
                          <Badge variant="default">Default</Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(model.id)}
                            disabled={settingDefault === model.id}
                          >
                            {settingDefault === model.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Set Default"
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveModel(model.id)}
                          disabled={
                            deletingModel === model.id ||
                            (configuredModels.length === 1 && model.isDefault)
                          }
                        >
                          {deletingModel === model.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No models configured yet. Add models from the curated list below.
            </p>
          )}

          {/* Curated Models */}
          <div className="space-y-2">
            <Label>Available Curated Models</Label>
            <div className="space-y-2">
              {curatedModels
                .filter((cm) => !configuredModels.some((cfg) => cfg.name === cm.id))
                .map((model) => (
                  <div
                    key={model.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{model.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {model.description} • Max {model.maxOutputTokens} tokens
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddModel(model.id)}
                      disabled={addingModel === model.id}
                    >
                      {addingModel === model.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Add"
                      )}
                    </Button>
                  </div>
                ))}
              {curatedModels.length === configuredModels.length && (
                <p className="text-sm text-muted-foreground">
                  All available models have been added.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Playground and Actions */}
      <div className="flex items-center gap-3 pt-4 border-t">
        <Button
          onClick={() => setPlaygroundOpen(true)}
          disabled={!canOpenPlayground}
          variant="default"
        >
          Open Playground
        </Button>

        <Button variant="outline" size="sm" asChild>
          <Link
            href={`/orgs/${orgSlug}/ai/usage?feature=playground&provider=${provider.provider}`}
          >
            View Usage
            <ExternalLink className="ml-2 h-3 w-3" />
          </Link>
        </Button>

        {provider.status === "verified" && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteKeyConfirm(true)}
            className="ml-auto"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove API Key
          </Button>
        )}
      </div>

      {!canOpenPlayground && provider.status === "verified" && (
        <p className="text-sm text-muted-foreground">
          Add at least one model to enable the playground.
        </p>
      )}

      {/* Playground Modal */}
      <AiPlaygroundModal
        orgSlug={orgSlug}
        provider={provider.provider}
        curatedModels={curatedModels}
        configuredModels={configuredModels}
        open={playgroundOpen}
        onOpenChange={setPlaygroundOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteKeyConfirm} onOpenChange={setDeleteKeyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the API key for {provider.displayName} and all configured
              models. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteKey}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
