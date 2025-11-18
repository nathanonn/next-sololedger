"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

interface RunExtractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
  orgSlug: string;
}

type TemplateKey = "standard_receipt" | "invoice" | "bank_statement_page" | "custom";

const TEMPLATE_OPTIONS = [
  {
    value: "standard_receipt" as TemplateKey,
    label: "Standard Receipt",
    description: "For retail receipts, restaurant bills, and simple transactions",
  },
  {
    value: "invoice" as TemplateKey,
    label: "Invoice",
    description: "For business invoices and bills",
  },
  {
    value: "bank_statement_page" as TemplateKey,
    label: "Bank Statement Page",
    description: "For bank statements and transaction lists",
  },
  {
    value: "custom" as TemplateKey,
    label: "Custom",
    description: "Flexible extraction with user-provided instructions",
  },
];

export function RunExtractionDialog({
  open,
  onOpenChange,
  documentId,
  documentName,
  orgSlug,
}: RunExtractionDialogProps): React.JSX.Element {
  const router = useRouter();
  const [isRunning, setIsRunning] = React.useState(false);
  const [template, setTemplate] = React.useState<TemplateKey>("standard_receipt");
  const [customPrompt, setCustomPrompt] = React.useState("");
  const [provider, setProvider] = React.useState<string>("default");
  const [modelName, setModelName] = React.useState<string>("default");

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setTemplate("standard_receipt");
      setCustomPrompt("");
      setProvider("default");
      setModelName("default");
    }
  }, [open]);

  const handleRunExtraction = async () => {
    setIsRunning(true);

    try {
      const requestBody: Record<string, unknown> = {
        templateKey: template,
      };

      if (customPrompt.trim()) {
        requestBody.customPrompt = customPrompt.trim();
      }

      if (provider !== "default") {
        requestBody.provider = provider;
      }

      if (modelName !== "default") {
        requestBody.modelName = modelName;
      }

      const response = await fetch(
        `/api/orgs/${orgSlug}/documents/${documentId}/ai/extract`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const error = await response.json();

        // Handle AI configuration errors with helpful messages
        if (error.code && error.code.startsWith("AI_CONFIG")) {
          toast.error(error.message || "AI configuration error");
          return;
        }

        throw new Error(error.message || "Failed to run extraction");
      }

      const data = await response.json();

      toast.success("Extraction completed successfully");

      // Close dialog
      onOpenChange(false);

      // Navigate to AI review page
      router.push(`/o/${orgSlug}/documents/${documentId}/ai`);
    } catch (error) {
      console.error("Error running extraction:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to run extraction"
      );
    } finally {
      setIsRunning(false);
    }
  };

  const selectedTemplate = TEMPLATE_OPTIONS.find((t) => t.value === template);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Run AI Extraction
          </DialogTitle>
          <DialogDescription>
            Extract structured data from: <strong>{documentName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Selection */}
          <div className="space-y-2">
            <Label htmlFor="template">Template</Label>
            <Select
              value={template}
              onValueChange={(value) => setTemplate(value as TemplateKey)}
            >
              <SelectTrigger id="template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <p className="text-sm text-muted-foreground">
                {selectedTemplate.description}
              </p>
            )}
          </div>

          {/* Custom Prompt */}
          <div className="space-y-2">
            <Label htmlFor="customPrompt">
              Custom prompt <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="customPrompt"
              placeholder='e.g., "This invoice includes discounts and multiple tax rates..."'
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground">
              Add specific instructions to help the AI understand your document
            </p>
          </div>

          {/* Advanced Options (collapsed) */}
          <Accordion type="single" collapsible>
            <AccordionItem value="advanced" className="border-none">
              <AccordionTrigger className="text-sm text-muted-foreground hover:no-underline py-2">
                Advanced Options
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger id="provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default (Org Setting)</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="gemini">Google Gemini</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Select value={modelName} onValueChange={setModelName}>
                    <SelectTrigger id="model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default (Org Setting)</SelectItem>
                      <SelectItem value="gpt-5-mini">GPT-5 Mini</SelectItem>
                      <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                      <SelectItem value="claude-sonnet-4-5-20250929">
                        Claude Sonnet 4.5
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Override the organization's default model for this extraction
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRunning}
          >
            Cancel
          </Button>
          <Button onClick={handleRunExtraction} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Run Extraction
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
