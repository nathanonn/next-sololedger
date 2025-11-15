"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Users,
  Edit2,
  GitMerge,
  Loader2,
  Calendar,
  Mail,
  Phone,
  CircleCheck,
  CircleX,
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  totals?: {
    transactionCount: number;
    totalAmount: number;
  };
}

interface OrgSettings {
  baseCurrency: string;
}

export default function ClientsPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  const [clients, setClients] = React.useState<Client[]>([]);
  const [settings, setSettings] = React.useState<OrgSettings | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [dateRange, setDateRange] = React.useState<"ytd" | "12months" | "custom">("12months");
  const [fromDate, setFromDate] = React.useState<string>("");
  const [toDate, setToDate] = React.useState<string>("");

  // Selection state
  const [selectedClientIds, setSelectedClientIds] = React.useState<Set<string>>(new Set());

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editingClient, setEditingClient] = React.useState<Client | null>(null);
  const [editForm, setEditForm] = React.useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    active: true,
  });
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);

  // Merge dialog state
  const [mergeDialogOpen, setMergeDialogOpen] = React.useState(false);
  const [primaryClientId, setPrimaryClientId] = React.useState<string>("");
  const [isMerging, setIsMerging] = React.useState(false);

  // Compute date range for API calls
  const computedDateRange = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateRange === "custom" && fromDate && toDate) {
      return { from: fromDate, to: toDate };
    }

    if (dateRange === "12months") {
      const from = new Date(today);
      from.setFullYear(from.getFullYear() - 1);
      return {
        from: from.toISOString().split("T")[0],
        to: today.toISOString().split("T")[0],
      };
    }

    // YTD based on fiscal year would require org settings
    // For now, default to calendar YTD
    const from = new Date(today.getFullYear(), 0, 1);
    return {
      from: from.toISOString().split("T")[0],
      to: today.toISOString().split("T")[0],
    };
  }, [dateRange, fromDate, toDate]);

  // Fetch settings
  React.useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch(`/api/orgs/${orgSlug}/settings/financial`);
        if (response.ok) {
          const data = await response.json();
          if (data.settings) {
            setSettings({ baseCurrency: data.settings.baseCurrency });
          }
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      }
    }
    fetchSettings();
  }, [orgSlug]);

  // Fetch clients
  const fetchClients = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const url = new URL(`/api/orgs/${orgSlug}/clients`, window.location.origin);
      url.searchParams.set("from", computedDateRange.from);
      url.searchParams.set("to", computedDateRange.to);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("Failed to fetch clients");
      }

      const data = await response.json();
      setClients(data.clients || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to load clients");
    } finally {
      setIsLoading(false);
    }
  }, [orgSlug, computedDateRange]);

  React.useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Toggle client selection
  const toggleClientSelection = (clientId: string) => {
    const newSelection = new Set(selectedClientIds);
    if (newSelection.has(clientId)) {
      newSelection.delete(clientId);
    } else {
      newSelection.add(clientId);
    }
    setSelectedClientIds(newSelection);
  };

  // Select/deselect all
  const toggleSelectAll = () => {
    if (selectedClientIds.size === clients.length) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(clients.map((c) => c.id)));
    }
  };

  // Open edit dialog
  const openEditDialog = (client: Client) => {
    setEditingClient(client);
    setEditForm({
      name: client.name,
      email: client.email || "",
      phone: client.phone || "",
      notes: "",
      active: client.active,
    });
    setEditDialogOpen(true);
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingClient) return;

    if (!editForm.name.trim()) {
      toast.error("Client name is required");
      return;
    }

    setIsSavingEdit(true);
    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/clients/${editingClient.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editForm.name,
            email: editForm.email || null,
            phone: editForm.phone || null,
            notes: editForm.notes || null,
            active: editForm.active,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update client");
      }

      toast.success("Client updated successfully");
      setEditDialogOpen(false);
      fetchClients();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update client");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open merge dialog
  const openMergeDialog = () => {
    if (selectedClientIds.size < 2) {
      toast.error("Please select at least 2 clients to merge");
      return;
    }
    setPrimaryClientId("");
    setMergeDialogOpen(true);
  };

  // Perform merge
  const handleMerge = async () => {
    if (!primaryClientId) {
      toast.error("Please select a primary client");
      return;
    }

    const secondaryIds = Array.from(selectedClientIds).filter(
      (id) => id !== primaryClientId
    );

    if (secondaryIds.length === 0) {
      toast.error("No secondary clients to merge");
      return;
    }

    setIsMerging(true);
    try {
      const response = await fetch(`/api/orgs/${orgSlug}/clients/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryId: primaryClientId,
          ids: secondaryIds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to merge clients");
      }

      const result = await response.json();
      toast.success(
        `Successfully merged ${secondaryIds.length} client(s). ${result.reassignedCount || 0} transaction(s) reassigned.`
      );
      setMergeDialogOpen(false);
      setSelectedClientIds(new Set());
      fetchClients();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to merge clients");
    } finally {
      setIsMerging(false);
    }
  };

  const selectedClients = clients.filter((c) => selectedClientIds.has(c.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            Manage your clients and view income analytics
          </p>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date Range
          </CardTitle>
          <CardDescription>
            Select a date range to view client transaction totals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <RadioGroup
              value={dateRange}
              onValueChange={(v) => setDateRange(v as typeof dateRange)}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="12months" id="12months" />
                <Label htmlFor="12months" className="font-normal">
                  Last 12 Months
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ytd" id="ytd" />
                <Label htmlFor="ytd" className="font-normal">
                  Year to Date
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="font-normal">
                  Custom Range
                </Label>
              </div>
            </RadioGroup>
          </div>

          {dateRange === "custom" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fromDate">From</Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toDate">To</Label>
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            Viewing data from {computedDateRange.from} to {computedDateRange.to}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {selectedClientIds.size > 0 && (
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span className="font-medium">
                  {selectedClientIds.size} client(s) selected
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedClientIds(new Set())}
                >
                  Clear Selection
                </Button>
                <Button onClick={openMergeDialog} disabled={selectedClientIds.size < 2}>
                  <GitMerge className="mr-2 h-4 w-4" />
                  Merge Clients
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Clients</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
            >
              {selectedClientIds.size === clients.length ? "Deselect All" : "Select All"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="mx-auto h-12 w-12 mb-2 opacity-50" />
              <p>No clients found for this period</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedClientIds.has(client.id)}
                        onCheckedChange={() => toggleClientSelection(client.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm">
                        {client.email && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {client.email}
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {client.phone}
                          </div>
                        )}
                        {!client.email && !client.phone && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.active ? (
                        <Badge variant="outline" className="gap-1">
                          <CircleCheck className="h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <CircleX className="h-3 w-3" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {client.totals?.transactionCount || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {settings?.baseCurrency}{" "}
                      {(client.totals?.totalAmount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(client)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Update client information and contact details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Client name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="client@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="+1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-active">Status</Label>
              <Select
                value={editForm.active ? "active" : "inactive"}
                onValueChange={(v) => setEditForm({ ...editForm, active: v === "active" })}
              >
                <SelectTrigger id="edit-active">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={isSavingEdit}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Clients</DialogTitle>
            <DialogDescription>
              Select the primary client to keep. All transactions from secondary
              clients will be reassigned to the primary client, and secondary clients
              will be deactivated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Selected Clients</Label>
              <div className="rounded-md border p-3 space-y-1">
                {selectedClients.map((client) => (
                  <div key={client.id} className="text-sm">
                    {client.name}
                    {client.totals && (
                      <span className="text-muted-foreground ml-2">
                        ({client.totals.transactionCount} transactions, {settings?.baseCurrency}{" "}
                        {client.totals.totalAmount.toFixed(2)})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary-client">
                Primary Client <span className="text-destructive">*</span>
              </Label>
              <Select value={primaryClientId} onValueChange={setPrimaryClientId}>
                <SelectTrigger id="primary-client">
                  <SelectValue placeholder="Select primary client" />
                </SelectTrigger>
                <SelectContent>
                  {selectedClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This client will be kept, and all others will be merged into it
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMergeDialogOpen(false)}
              disabled={isMerging}
            >
              Cancel
            </Button>
            <Button onClick={handleMerge} disabled={isMerging || !primaryClientId}>
              {isMerging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <GitMerge className="mr-2 h-4 w-4" />
                  Merge Clients
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
