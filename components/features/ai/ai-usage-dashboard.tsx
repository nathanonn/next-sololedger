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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";

type LogEntry = {
  id: string;
  correlationId: string;
  provider: string;
  model: string;
  feature: string;
  status: string;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number;
  rawInputTruncated: string;
  rawOutputTruncated: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  user: {
    email: string;
    name: string | null;
  };
};

type Totals = {
  requests: number;
  tokensIn: number;
  tokensOut: number;
  avgLatencyMs: number;
};

type AiUsageDashboardProps = {
  orgSlug: string;
};

export function AiUsageDashboard({ orgSlug }: AiUsageDashboardProps): React.JSX.Element {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totals, setTotals] = useState<Totals>({
    requests: 0,
    tokensIn: 0,
    tokensOut: 0,
    avgLatencyMs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(20);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // Filters
  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [feature, setFeature] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");

  // Fetch logs
  const fetchLogs = async (): Promise<void> => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (provider) params.append("provider", provider);
      if (model) params.append("model", model);
      if (feature) params.append("feature", feature);
      if (status) params.append("status", status);
      if (search) params.append("search", search);

      const res = await fetch(`/api/orgs/${orgSlug}/ai/logs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch logs");

      const data = await res.json();
      setLogs(data.logs);
      setTotals(data.totals);
      setTotalPages(data.totalPages);
    } catch (error) {
      toast.error("Failed to load AI usage logs");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, provider, model, feature, status, search]);

  // Handle search
  const handleSearch = (): void => {
    setSearch(searchInput);
    setPage(1); // Reset to first page
  };

  // Handle filter change
  const handleFilterChange = (key: string, value: string): void => {
    setPage(1); // Reset to first page
    // Map "all" to empty string to clear the filter
    const filterValue = value === "all" ? "" : value;
    switch (key) {
      case "provider":
        setProvider(filterValue);
        break;
      case "model":
        setModel(filterValue);
        break;
      case "feature":
        setFeature(filterValue);
        break;
      case "status":
        setStatus(filterValue);
        break;
    }
  };

  // Clear filters
  const handleClearFilters = (): void => {
    setProvider("");
    setModel("");
    setFeature("");
    setStatus("");
    setSearch("");
    setSearchInput("");
    setPage(1);
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  // Get status badge
  const getStatusBadge = (status: string): React.JSX.Element => {
    switch (status) {
      case "ok":
        return <Badge variant="default">OK</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "canceled":
        return <Badge variant="secondary">Canceled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Format tokens
  const formatNumber = (num: number | null): string => {
    if (num === null) return "—";
    return num.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Totals Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.requests)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tokens In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.tokensIn)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tokens Out
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.tokensOut)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.avgLatencyMs}ms</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="filter-provider">Provider</Label>
              <Select value={provider || "all"} onValueChange={(v) => handleFilterChange("provider", v)}>
                <SelectTrigger id="filter-provider">
                  <SelectValue placeholder="All providers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All providers</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-feature">Feature</Label>
              <Select value={feature || "all"} onValueChange={(v) => handleFilterChange("feature", v)}>
                <SelectTrigger id="filter-feature">
                  <SelectValue placeholder="All features" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All features</SelectItem>
                  <SelectItem value="generic-text">Generic Text</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-status">Status</Label>
              <Select value={status || "all"} onValueChange={(v) => handleFilterChange("status", v)}>
                <SelectTrigger id="filter-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="ok">OK</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="flex gap-2">
                <Input
                  id="search"
                  placeholder="Correlation ID or text..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <div className="rounded-lg border">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-muted-foreground">No logs found</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try adjusting your filters or make some AI generation requests
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Correlation ID</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Feature</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="font-mono text-xs">
                      {log.correlationId.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(log.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.provider.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.model}</TableCell>
                    <TableCell className="text-sm">{log.feature}</TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-right text-sm">{log.latencyMs}ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t px-4 py-3">
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Log Detail Sheet */}
      <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Log Details</SheetTitle>
            <SheetDescription>
              Correlation ID: {selectedLog?.correlationId}
            </SheetDescription>
          </SheetHeader>

          {selectedLog && (
            <div className="mt-6 space-y-6">
              {/* Metadata */}
              <div className="space-y-2">
                <h3 className="font-semibold">Metadata</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">User:</dt>
                  <dd>{selectedLog.user.name || selectedLog.user.email}</dd>

                  <dt className="text-muted-foreground">Provider:</dt>
                  <dd>{selectedLog.provider}</dd>

                  <dt className="text-muted-foreground">Model:</dt>
                  <dd>{selectedLog.model}</dd>

                  <dt className="text-muted-foreground">Feature:</dt>
                  <dd>{selectedLog.feature}</dd>

                  <dt className="text-muted-foreground">Status:</dt>
                  <dd>{getStatusBadge(selectedLog.status)}</dd>

                  <dt className="text-muted-foreground">Latency:</dt>
                  <dd>{selectedLog.latencyMs}ms</dd>

                  <dt className="text-muted-foreground">Tokens In:</dt>
                  <dd>{formatNumber(selectedLog.tokensIn)}</dd>

                  <dt className="text-muted-foreground">Tokens Out:</dt>
                  <dd>{formatNumber(selectedLog.tokensOut)}</dd>

                  <dt className="text-muted-foreground">Time:</dt>
                  <dd>{formatDate(selectedLog.createdAt)}</dd>
                </dl>
              </div>

              {/* Error Info */}
              {selectedLog.status === "error" && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-destructive">Error Information</h3>
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm">
                    <p className="font-medium">{selectedLog.errorCode || "Unknown Error"}</p>
                    {selectedLog.errorMessage && (
                      <p className="mt-1 text-muted-foreground">{selectedLog.errorMessage}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="space-y-2">
                <h3 className="font-semibold">Input (sanitized & truncated)</h3>
                <div className="rounded-lg bg-muted p-3">
                  <pre className="whitespace-pre-wrap text-xs font-mono">
                    {selectedLog.rawInputTruncated || "(empty)"}
                  </pre>
                </div>
              </div>

              {/* Output */}
              <div className="space-y-2">
                <h3 className="font-semibold">Output (sanitized & truncated)</h3>
                <div className="rounded-lg bg-muted p-3">
                  <pre className="whitespace-pre-wrap text-xs font-mono">
                    {selectedLog.rawOutputTruncated || "(empty)"}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
