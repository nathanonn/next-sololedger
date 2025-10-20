"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Copy } from "lucide-react";

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

type AiPlaygroundModalProps = {
  orgSlug: string;
  provider: string;
  curatedModels: CuratedModel[];
  configuredModels: ConfiguredModel[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AiPlaygroundModal({
  orgSlug,
  provider,
  curatedModels,
  configuredModels,
  open,
  onOpenChange,
}: AiPlaygroundModalProps): React.JSX.Element {
  // Find default model or use first
  const defaultModel =
    configuredModels.find((m) => m.isDefault) || configuredModels[0];

  const [selectedModelName, setSelectedModelName] = useState<string>(
    defaultModel?.name || ""
  );
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [userPrompt, setUserPrompt] = useState<string>("");
  const [maxOutputTokens, setMaxOutputTokens] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [resultJson, setResultJson] = useState<unknown | null>(null);
  const [errorJson, setErrorJson] = useState<unknown | null>(null);

  // Get curated model for max tokens
  const curatedModel = curatedModels.find((m) => m.id === selectedModelName);

  // Update maxOutputTokens when model changes
  useEffect(() => {
    if (curatedModel) {
      setMaxOutputTokens(curatedModel.maxOutputTokens);
    }
  }, [selectedModelName, curatedModel]);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      const defaultModel =
        configuredModels.find((m) => m.isDefault) || configuredModels[0];
      setSelectedModelName(defaultModel?.name || "");
      setSystemPrompt("");
      setUserPrompt("");
      setResultJson(null);
      setErrorJson(null);
      setLoading(false);
    }
  }, [open, configuredModels]);

  const handleSubmit = async (): Promise<void> => {
    if (!userPrompt.trim()) {
      toast.error("User prompt is required");
      return;
    }

    if (!selectedModelName) {
      toast.error("Please select a model");
      return;
    }

    setLoading(true);
    setResultJson(null);
    setErrorJson(null);

    try {
      // Concatenate system + user prompts
      let finalPrompt = userPrompt.trim();
      if (systemPrompt.trim()) {
        finalPrompt = `${systemPrompt.trim()}\n\n${userPrompt.trim()}`;
      }

      const res = await fetch(`/api/orgs/${orgSlug}/ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature: "playground",
          provider,
          modelName: selectedModelName,
          prompt: finalPrompt,
          maxOutputTokens,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorJson(data);
        toast.error(data.error || "Failed to generate text");
        return;
      }

      setResultJson(data);
      toast.success("Generation complete");
    } catch (error) {
      const errorData = {
        error: error instanceof Error ? error.message : "Network error",
      };
      setErrorJson(errorData);
      toast.error("Network error. Please try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (): Promise<void> => {
    const dataToCopy = resultJson || errorJson;
    if (!dataToCopy) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
      toast.success("Copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy");
      console.error(error);
    }
  };

  const maxTokensLimit = curatedModel?.maxOutputTokens || 16384;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[90vw] md:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        showCloseButton={!loading}
        onInteractOutside={(e) => {
          if (loading) {
            e.preventDefault();
            toast.info("Generation in progress — please wait");
          }
        }}
        onEscapeKeyDown={(e) => {
          if (loading) {
            e.preventDefault();
            toast.info("Generation in progress — please wait");
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Playground: {provider}</DialogTitle>
          <DialogDescription>
            Test AI models with custom prompts. Results are logged with
            feature=&quot;playground&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-6 flex-1 overflow-hidden">
          {/* Left Column: Inputs */}
          <div className="flex-1 space-y-4 overflow-y-auto pr-2">
            {/* Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select
                value={selectedModelName}
                onValueChange={setSelectedModelName}
                disabled={loading}
              >
                <SelectTrigger id="model">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {configuredModels.map((model) => (
                    <SelectItem key={model.id} value={model.name}>
                      {model.label} {model.isDefault && "(Default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* System Prompt */}
            <div className="space-y-2">
              <Label htmlFor="system-prompt">System Prompt (Optional)</Label>
              <Textarea
                id="system-prompt"
                placeholder="Enter system instructions..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                disabled={loading}
                rows={4}
              />
            </div>

            {/* User Prompt */}
            <div className="space-y-2">
              <Label htmlFor="user-prompt">
                User Prompt <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="user-prompt"
                placeholder="Enter your prompt..."
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                disabled={loading}
                rows={6}
                required
              />
            </div>

            {/* Max Output Tokens */}
            <div className="space-y-2">
              <Label htmlFor="max-tokens">
                Max Output Tokens (1 - {maxTokensLimit})
              </Label>
              <Input
                id="max-tokens"
                type="number"
                min={1}
                max={maxTokensLimit}
                value={maxOutputTokens}
                onChange={(e) =>
                  setMaxOutputTokens(
                    Math.min(
                      maxTokensLimit,
                      Math.max(1, parseInt(e.target.value) || 1)
                    )
                  )
                }
                disabled={loading}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={loading || !userPrompt.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="flex-1 flex flex-col overflow-hidden border rounded-lg">
            <div className="flex items-center justify-between p-3 border-b bg-muted/50">
              <span className="text-sm font-medium">Response</span>
              {(resultJson !== null || errorJson !== null) && (
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy JSON
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Generating response...
                    </p>
                  </div>
                </div>
              )}

              {!loading && resultJson === null && errorJson === null && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">
                    Submit a prompt to see results here
                  </p>
                </div>
              )}

              {!loading && resultJson !== null && (
                <div className="space-y-3">
                  <pre className="text-xs font-mono bg-secondary/50 p-4 rounded-lg whitespace-pre-wrap break-all">
                    {JSON.stringify(resultJson, null, 2)}
                  </pre>
                  {typeof resultJson === "object" &&
                    resultJson !== null &&
                    "correlationId" in resultJson && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>
                          Correlation ID:{" "}
                          <code className="bg-secondary px-1 py-0.5 rounded">
                            {String(resultJson.correlationId)}
                          </code>
                        </p>
                        {"latencyMs" in resultJson && (
                          <p>
                            Latency:{" "}
                            <code className="bg-secondary px-1 py-0.5 rounded">
                              {String(resultJson.latencyMs)}ms
                            </code>
                          </p>
                        )}
                      </div>
                    )}
                </div>
              )}

              {!loading && errorJson !== null && (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-destructive">
                    Error
                  </div>
                  <pre className="text-xs font-mono bg-destructive/10 text-destructive p-4 rounded-lg overflow-x-auto">
                    {JSON.stringify(errorJson, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
