"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type NewApiKeyResponse = {
  apiKey: {
    id: string;
    name: string;
    prefix: string;
    organizationId: string;
    organization: {
      id: string;
      name: string;
      slug: string;
    };
    scopes: string[] | null;
    expiresAt: string | null;
    createdAt: string;
  };
  fullKey: string;
};

type Props = {
  data: NewApiKeyResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CopyApiKeyDialog({ data, open, onOpenChange }: Props): JSX.Element {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(data.fullKey);
      setCopied(true);
      toast.success("API key copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const formatExpiry = (expiresAt: string | null): string => {
    if (!expiresAt) return "Never";
    const date = new Date(expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return `in ${diffDays} days`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Your New API Key</DialogTitle>
          <DialogDescription>
            This key is shown only once. Copy and store it securely. If you lose it, you must create a new key.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-medium mb-1">Security Warning</p>
              <p>
                This is the only time you will see the full API key. Make sure to copy it now and store it in a secure location.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="api-key"
                value={data.fullKey}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyToClipboard}
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <Label className="text-muted-foreground">Organization</Label>
              <p className="font-medium">{data.apiKey.organization.name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Prefix</Label>
              <p className="font-mono text-sm">{data.apiKey.prefix}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <div>
                <Badge variant="default">Active</Badge>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Expires</Label>
              <p className="font-medium">{formatExpiry(data.apiKey.expiresAt)}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
