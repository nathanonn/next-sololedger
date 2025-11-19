"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Plus, MoreVertical, Key, AlertCircle } from "lucide-react";
import { CreateApiKeyDialog } from "@/components/features/api-keys/create-api-key-dialog";
import { EditApiKeyDialog } from "@/components/features/api-keys/edit-api-key-dialog";
import { RevokeApiKeyDialog } from "@/components/features/api-keys/revoke-api-key-dialog";
import { CopyApiKeyDialog } from "@/components/features/api-keys/copy-api-key-dialog";
import { toast } from "sonner";

type ApiKey = {
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
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type NewApiKeyResponse = {
  apiKey: ApiKey;
  fullKey: string;
};

export default function ApiAccessPage(): JSX.Element {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [revokingKey, setRevokingKey] = useState<ApiKey | null>(null);
  const [newApiKeyData, setNewApiKeyData] = useState<NewApiKeyResponse | null>(null);
  const router = useRouter();

  // Load API keys
  const loadApiKeys = async (): Promise<void> => {
    try {
      const response = await fetch("/api/auth/api-keys");
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to load API keys");
      }
      const data = await response.json();
      setApiKeys(data.apiKeys || []);
    } catch {
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApiKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateSuccess = (data: NewApiKeyResponse): void => {
    setNewApiKeyData(data);
    setCreateDialogOpen(false);
    loadApiKeys();
  };

  const handleEditSuccess = (): void => {
    setEditingKey(null);
    loadApiKeys();
  };

  const handleRevokeSuccess = (): void => {
    setRevokingKey(null);
    loadApiKeys();
  };

  const getStatusBadge = (key: ApiKey): JSX.Element => {
    if (key.revokedAt) {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  const formatDate = (date: string | null): string => {
    if (!date) return "Never";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Access</h1>
          <p className="text-muted-foreground mt-2">
            Manage your personal API keys for MCP and integrations.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Your API Keys</CardTitle>
                <CardDescription>
                  Create and manage API keys to access your organizations programmatically
                </CardDescription>
              </div>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create API Key
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {apiKeys.length === 0 ? (
              <div className="text-center py-12">
                <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No API keys yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first API key to connect MCP or other tools to your SoloLedger workspace.
                </p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first API key
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell className="font-mono text-sm">{key.prefix}</TableCell>
                      <TableCell>{key.organization.name}</TableCell>
                      <TableCell>{getStatusBadge(key)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(key.lastUsedAt)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingKey(key)}>
                              Edit
                            </DropdownMenuItem>
                            {!key.revokedAt && (
                              <DropdownMenuItem
                                onClick={() => setRevokingKey(key)}
                                className="text-destructive"
                              >
                                Revoke
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <CardTitle className="text-amber-900">Security Notice</CardTitle>
                <CardDescription className="text-amber-800">
                  API keys provide full access to your organization data. Keep them secure and never share them publicly.
                  Revoke any keys that may have been compromised.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      <CreateApiKeyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />

      {editingKey && (
        <EditApiKeyDialog
          apiKey={editingKey}
          open={true}
          onOpenChange={(open) => !open && setEditingKey(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {revokingKey && (
        <RevokeApiKeyDialog
          apiKey={revokingKey}
          open={true}
          onOpenChange={(open) => !open && setRevokingKey(null)}
          onSuccess={handleRevokeSuccess}
        />
      )}

      {newApiKeyData && (
        <CopyApiKeyDialog
          data={newApiKeyData}
          open={true}
          onOpenChange={(open) => !open && setNewApiKeyData(null)}
        />
      )}
    </div>
  );
}
