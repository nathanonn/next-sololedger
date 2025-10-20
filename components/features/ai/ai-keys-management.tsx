"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, Check, X, Trash2 } from "lucide-react";

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

type AiKeysManagementProps = {
  orgSlug: string;
};

export function AiKeysManagement({ orgSlug }: AiKeysManagementProps): React.JSX.Element {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [curatedModels, setCuratedModels] = useState<CuratedModel[]>([]);
  const [configuredModels, setConfiguredModels] = useState<ConfiguredModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [addingModel, setAddingModel] = useState<string | null>(null);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [deleteKeyConfirm, setDeleteKeyConfirm] = useState<Provider | null>(null);

  // Fetch providers status
  const fetchProviders = async (): Promise<void> => {
    try {
      const res = await fetch(`/api/orgs/${orgSlug}/ai/keys`);
      if (!res.ok) throw new Error("Failed to fetch providers");
      const data = await res.json();
      setProviders(data.providers);
    } catch (error) {
      toast.error("Failed to load AI providers");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch models for a provider
  const fetchModels = async (provider: string): Promise<void> => {
    setLoadingModels(true);
    try {
      const res = await fetch(`/api/orgs/${orgSlug}/ai/models?provider=${provider}`);
      if (!res.ok) throw new Error("Failed to fetch models");
      const data = await res.json();
      setCuratedModels(data.curatedModels || []);
      setConfiguredModels(
        data.configured?.filter((m: ConfiguredModel) => m.provider === provider) || []
      );
    } catch (error) {
      toast.error("Failed to load models");
      console.error(error);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  // Open manage dialog
  const handleManage = async (provider: Provider): Promise<void> => {
    setSelectedProvider(provider);
    setApiKey("");
    if (provider.status === "verified") {
      await fetchModels(provider.provider);
    }
  };

  // Close dialog
  const handleClose = (): void => {
    setSelectedProvider(null);
    setApiKey("");
    setCuratedModels([]);
    setConfiguredModels([]);
  };

  // Verify and save API key
  const handleSaveKey = async (): Promise<void> => {
    if (!selectedProvider || !apiKey.trim()) {
      toast.error("API key is required");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch(`/api/orgs/${orgSlug}/ai/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider.provider,
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
      await fetchProviders();
      await fetchModels(selectedProvider.provider);
    } catch (error) {
      toast.error("Network error. Please try again.");
      console.error(error);
    } finally {
      setVerifying(false);
    }
  };

  // Delete API key
  const handleDeleteKey = async (provider: Provider): Promise<void> => {
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
      await fetchProviders();
      setDeleteKeyConfirm(null);
      handleClose();
    } catch (error) {
      toast.error("Network error. Please try again.");
      console.error(error);
    }
  };

  // Add model
  const handleAddModel = async (modelId: string): Promise<void> => {
    if (!selectedProvider) return;

    setAddingModel(modelId);
    try {
      const res = await fetch(`/api/orgs/${orgSlug}/ai/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider.provider,
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
      await fetchModels(selectedProvider.provider);
      await fetchProviders();
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
      await fetchModels(selectedProvider!.provider);
      await fetchProviders();
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
      await fetchModels(selectedProvider!.provider);
      await fetchProviders();
    } catch (error) {
      toast.error("Network error. Please try again.");
      console.error(error);
    } finally {
      setSettingDefault(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Default Model</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.map((provider) => (
              <TableRow key={provider.provider}>
                <TableCell className="font-medium">{provider.displayName}</TableCell>
                <TableCell>
                  {provider.status === "verified" ? (
                    <Badge variant="default" className="gap-1">
                      <Check className="h-3 w-3" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <X className="h-3 w-3" />
                      Missing
                    </Badge>
                  )}
                  {provider.lastFour && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ****{provider.lastFour}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {provider.defaultModel ? (
                    <span className="text-sm">{provider.defaultModel.label}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleManage(provider)}
                  >
                    Manage
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Manage Provider Dialog */}
      <Dialog open={!!selectedProvider} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage: {selectedProvider?.displayName}</DialogTitle>
            <DialogDescription>
              Configure API key and manage curated models for this provider.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* API Key Section */}
            <div className="space-y-3">
              <Label htmlFor="api-key">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="api-key"
                  type="password"
                  placeholder={
                    selectedProvider?.status === "verified"
                      ? `****${selectedProvider.lastFour} (verified)`
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
              {selectedProvider?.status === "verified" && (
                <p className="text-xs text-muted-foreground">
                  Last verified:{" "}
                  {selectedProvider.lastVerifiedAt
                    ? new Date(selectedProvider.lastVerifiedAt).toLocaleString()
                    : "Unknown"}
                </p>
              )}
            </div>

            {/* Models Section */}
            {selectedProvider?.status === "verified" && (
              <div className="space-y-3">
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
                                disabled={deletingModel === model.id}
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

                <div className="mt-4">
                  <Label>Available Curated Models</Label>
                  <div className="mt-2 space-y-2">
                    {curatedModels
                      .filter(
                        (cm) => !configuredModels.some((cfg) => cfg.name === cm.id)
                      )
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

            {/* Delete Key Button */}
            {selectedProvider?.status === "verified" && (
              <div className="border-t pt-4">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteKeyConfirm(selectedProvider)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove API Key
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteKeyConfirm}
        onOpenChange={(open) => !open && setDeleteKeyConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the API key for {deleteKeyConfirm?.displayName} and all
              configured models. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteKeyConfirm && handleDeleteKey(deleteKeyConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
