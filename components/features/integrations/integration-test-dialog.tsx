"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type IntegrationTestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  provider: string;
  displayName: string;
};

// Client-safe provider base URLs for preview
const PROVIDER_BASE_URLS: Record<string, string> = {
  reddit: "https://oauth.reddit.com",
  notion: "https://api.notion.com/v1",
};

// Default test endpoints for each provider
const DEFAULT_ENDPOINTS: Record<string, string> = {
  reddit: "/api/v1/me",
  notion: "/users/me",
};

type TestResult = {
  ok: boolean;
  httpStatus?: number;
  correlationId?: string;
  data?: unknown;
  code?: string;
  message?: string;
};

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

export function IntegrationTestDialog({
  open,
  onOpenChange,
  orgSlug,
  provider,
  displayName,
}: IntegrationTestDialogProps): React.JSX.Element {
  const [method, setMethod] = useState<string>("GET");
  const [endpoint, setEndpoint] = useState<string>(DEFAULT_ENDPOINTS[provider] || "/");
  const [headers, setHeaders] = useState<string>("{}");
  const [body, setBody] = useState<string>("{}");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const baseUrl = PROVIDER_BASE_URLS[provider] || "https://api.example.com";
  const showBodyField = method !== "GET" && method !== "HEAD";

  const handleTest = async (): Promise<void> => {
    setIsLoading(true);
    setResult(null);

    try {
      // Validate endpoint
      if (!endpoint.startsWith("/")) {
        toast.error("Endpoint must start with /");
        setIsLoading(false);
        return;
      }

      // Parse and validate JSON fields
      let parsedHeaders: Record<string, string> | undefined;
      let parsedBody: unknown | undefined;

      if (headers.trim()) {
        try {
          parsedHeaders = JSON.parse(headers);
        } catch (error) {
          toast.error("Invalid JSON in headers field");
          setIsLoading(false);
          return;
        }
      }

      if (showBodyField && body.trim()) {
        try {
          parsedBody = JSON.parse(body);
        } catch (error) {
          toast.error("Invalid JSON in body field");
          setIsLoading(false);
          return;
        }
      }

      // Call test endpoint
      const response = await fetch(
        `/api/orgs/${orgSlug}/integrations/${provider}/test`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            method,
            endpoint,
            headers: parsedHeaders,
            body: parsedBody,
          }),
        }
      );

      const data = await response.json();
      setResult(data);

      if (!data.ok) {
        // Show user-friendly error message
        const friendlyMessage = getErrorMessage(data.code, data.httpStatus);
        toast.error(friendlyMessage || data.message || "Test failed");
      }
    } catch (error) {
      console.error("Test connection error:", error);
      toast.error("Network error. Please try again.");
      setResult({
        ok: false,
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Network error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = (): void => {
    onOpenChange(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setMethod("GET");
      setEndpoint(DEFAULT_ENDPOINTS[provider] || "/");
      setHeaders("{}");
      setBody("{}");
      setResult(null);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test {displayName} Connection</DialogTitle>
          <DialogDescription>
            Send a test request to verify your integration is working correctly
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <div className="rounded-md bg-muted p-3 text-sm font-mono">
            <span className="font-semibold">{method}</span> {baseUrl}
            {endpoint}
          </div>

          {/* Method */}
          <div className="space-y-2">
            <Label htmlFor="method">Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger id="method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HTTP_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Endpoint */}
          <div className="space-y-2">
            <Label htmlFor="endpoint">Endpoint</Label>
            <Input
              id="endpoint"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="/api/v1/endpoint"
              disabled={isLoading}
            />
          </div>

          {/* Headers */}
          <div className="space-y-2">
            <Label htmlFor="headers">Headers (JSON, optional)</Label>
            <Textarea
              id="headers"
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              placeholder='{"Accept": "application/json"}'
              className="font-mono text-sm"
              rows={3}
              disabled={isLoading}
            />
          </div>

          {/* Body (shown for non-GET/HEAD methods) */}
          {showBodyField && (
            <div className="space-y-2">
              <Label htmlFor="body">Body (JSON, optional)</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="{}"
                className="font-mono text-sm"
                rows={4}
                disabled={isLoading}
              />
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <Badge variant={result.ok ? "default" : "destructive"}>
                  {result.ok ? "Success" : "Error"}
                </Badge>
                {result.httpStatus && (
                  <span className="text-sm text-muted-foreground">
                    HTTP {result.httpStatus}
                  </span>
                )}
                {result.correlationId && (
                  <span className="text-xs text-muted-foreground font-mono">
                    ID: {result.correlationId}
                  </span>
                )}
              </div>

              {/* Error message */}
              {(() => {
                if (!result.ok && result.message) {
                  const friendlyMsg = getErrorMessage(result.code, result.httpStatus);
                  const displayMsg = friendlyMsg ?? result.message;
                  return (
                    <div className="text-sm text-destructive">
                      {displayMsg}
                    </div>
                  );
                }
                return null;
              })()}

              {/* Response data */}
              {result.data != null && (
                <div className="space-y-2">
                  <Label>Response</Label>
                  <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Close
            </Button>
            <Button onClick={handleTest} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Testing..." : "Run Test"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Map error codes to user-friendly messages
 */
function getErrorMessage(code?: string, httpStatus?: number): string | null {
  if (httpStatus === 401 || code === "UNAUTHORIZED") {
    return "Authentication expired. Please reconnect the integration.";
  }

  if (httpStatus === 403 || code === "FORBIDDEN") {
    return "Permission denied. Check your integration scopes.";
  }

  if (httpStatus === 404 || code === "NOT_FOUND") {
    return "Resource not found. Check the endpoint path.";
  }

  if (httpStatus === 429 || code === "RATE_LIMITED") {
    return "Rate limit exceeded. Please try again later.";
  }

  return null;
}
