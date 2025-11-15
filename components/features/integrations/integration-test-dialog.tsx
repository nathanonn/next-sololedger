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
  baseUrlOverride?: string;
};

// Client-safe provider base URLs for preview
const PROVIDER_BASE_URLS: Record<string, string> = {
  reddit: "https://oauth.reddit.com",
  notion: "https://api.notion.com/v1",
  linkedin: "https://api.linkedin.com/v2",
};

// Default test endpoints for each provider
const DEFAULT_ENDPOINTS: Record<string, string> = {
  reddit: "/api/v1/me",
  notion: "/v1/users/me",
  linkedin: "/me",
  wordpress: "/wp-json/",
};

type TestResult = {
  ok: boolean;
  httpStatus?: number;
  correlationId?: string;
  data?: unknown;
  code?: string;
  message?: string;
};

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

export function IntegrationTestDialog({
  open,
  onOpenChange,
  orgSlug,
  provider,
  displayName,
  baseUrlOverride,
}: IntegrationTestDialogProps): React.JSX.Element {
  const [method, setMethod] = useState<string>("GET");
  const [endpoint, setEndpoint] = useState<string>(
    DEFAULT_ENDPOINTS[provider] || "/"
  );
  const [headers, setHeaders] = useState<string>("{}");
  const [body, setBody] = useState<string>("{}");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const baseUrl =
    baseUrlOverride ||
    PROVIDER_BASE_URLS[provider] ||
    "https://api.example.com";
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
        } catch {
          toast.error("Invalid JSON in headers field");
          setIsLoading(false);
          return;
        }
      }

      if (showBodyField && body.trim()) {
        try {
          parsedBody = JSON.parse(body);
        } catch {
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
      <DialogContent
        className="max-w-[90vw] md:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        showCloseButton={!isLoading}
        onInteractOutside={(e) => {
          if (isLoading) {
            e.preventDefault();
            toast.info("Test in progress — please wait");
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isLoading) {
            e.preventDefault();
            toast.info("Test in progress — please wait");
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Test {displayName} Connection</DialogTitle>
          <DialogDescription>
            Send a test request to verify your integration is working correctly
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-6 flex-1 overflow-hidden">
          {/* Left Column: Inputs */}
          <div className="flex-1 space-y-4 overflow-y-auto pr-2">
            {/* Preview */}
            <div className="rounded-md bg-muted p-3 text-sm font-mono">
              {/* remove trailing slash from baseUrl if endpoint starts with slash */}
              <span className="font-semibold">{method}</span>{" "}
              {baseUrl.replace(/\/$/, "")}
              {endpoint}
            </div>

            {/* Method */}
            <div className="space-y-2">
              <Label htmlFor="method">Method</Label>
              <Select
                value={method}
                onValueChange={setMethod}
                disabled={isLoading}
              >
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

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleTest} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Run Test"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Close
              </Button>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="flex-1 flex flex-col overflow-hidden border rounded-lg">
            <div className="flex items-center justify-between p-3 border-b bg-muted/50">
              <span className="text-sm font-medium">Response</span>
              {result && (
                <div className="flex items-center gap-2">
                  <Badge
                    variant={result.ok ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {result.ok ? "Success" : "Error"}
                  </Badge>
                  {result.httpStatus && (
                    <span className="text-xs text-muted-foreground">
                      HTTP {result.httpStatus}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Testing connection...
                    </p>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!isLoading && !result && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">
                    Run a test to see results here
                  </p>
                </div>
              )}

              {/* Error State */}
              {!isLoading && result && !result.ok && (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-destructive">
                    {(() => {
                      const friendlyMsg = getErrorMessage(
                        result.code,
                        result.httpStatus
                      );
                      return friendlyMsg ?? result.message ?? "Test failed";
                    })()}
                  </div>
                  {result.correlationId && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        Correlation ID:{" "}
                        <code className="bg-secondary px-1 py-0.5 rounded">
                          {result.correlationId}
                        </code>
                      </p>
                    </div>
                  )}
                  {result.data != null && (
                    <pre className="text-xs font-mono bg-destructive/10 text-destructive p-4 rounded-lg overflow-x-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {/* Success State */}
              {!isLoading && result && result.ok && (
                <div className="space-y-3">
                  {result.data != null && (
                    <pre className="text-xs font-mono bg-secondary/50 p-4 rounded-lg whitespace-pre-wrap break-all">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  )}
                  {result.correlationId && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        Correlation ID:{" "}
                        <code className="bg-secondary px-1 py-0.5 rounded">
                          {result.correlationId}
                        </code>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
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
