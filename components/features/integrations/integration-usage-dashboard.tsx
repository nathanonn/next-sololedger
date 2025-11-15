"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type IntegrationLog = {
  id: string;
  provider: string;
  endpoint: string;
  method: string;
  status: string;
  httpStatus: number | null;
  latencyMs: number;
  correlationId: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type IntegrationUsageProps = {
  orgSlug: string;
};

export function IntegrationUsageDashboard({ orgSlug }: IntegrationUsageProps): React.JSX.Element {
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [provider, setProvider] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, page]);

  async function fetchLogs(): Promise<void> {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });

      if (provider !== "all") {
        params.set("provider", provider);
      }

      if (search) {
        params.set("q", search);
      }

      const response = await fetch(
        `/api/orgs/${orgSlug}/integrations/logs?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch logs");
      }

      const data = await response.json();

      if (data.disabled) {
        setDisabled(true);
        setLogs([]);
      } else {
        setLogs(data.logs || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast.error("Failed to load usage logs");
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(): void {
    setPage(1);
    fetchLogs();
  }

  if (disabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Integration Usage Logging Disabled</CardTitle>
          <CardDescription>
            Integration usage logging is currently disabled. Enable it in your
            environment configuration to view logs.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Select value={provider} onValueChange={(value) => { setProvider(value); setPage(1); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All providers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All providers</SelectItem>
              <SelectItem value="reddit">Reddit</SelectItem>
              <SelectItem value="notion">Notion</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2 flex-1">
            <Input
              placeholder="Search endpoint or correlation ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs table */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Calls</CardTitle>
          <CardDescription>
            Recent API calls to integrated services
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No logs found
            </p>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Latency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.provider}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.method}
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-xs truncate">
                        {log.endpoint}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={log.status === "ok" ? "default" : "destructive"}
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.httpStatus || "-"}</TableCell>
                      <TableCell>{log.latencyMs}ms</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
