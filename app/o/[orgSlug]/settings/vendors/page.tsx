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

interface Vendor {
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

export default function VendorsPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  const [vendors, setVendors] = React.useState<Vendor[]>([]);
  const [settings, setSettings] = React.useState<OrgSettings | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [dateRange, setDateRange] = React.useState<"ytd" | "12months" | "custom">("12months");
  const [fromDate, setFromDate] = React.useState<string>("");
  const [toDate, setToDate] = React.useState<string>("");

  // Selection state
  const [selectedVendorIds, setSelectedVendorIds] = React.useState<Set<string>>(new Set());

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editingVendor, setEditingVendor] = React.useState<Vendor | null>(null);
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
  const [primaryVendorId, setPrimaryVendorId] = React.useState<string>("");
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

  // Fetch vendors
  const fetchVendors = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const url = new URL(`/api/orgs/${orgSlug}/vendors`, window.location.origin);
      url.searchParams.set("from", computedDateRange.from);
      url.searchParams.set("to", computedDateRange.to);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("Failed to fetch vendors");
      }

      const data = await response.json();
      setVendors(data.vendors || []);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      toast.error("Failed to load vendors");
    } finally {
      setIsLoading(false);
    }
  }, [orgSlug, computedDateRange]);

  React.useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  // Toggle vendor selection
  const toggleVendorSelection = (vendorId: string) => {
    const newSelection = new Set(selectedVendorIds);
    if (newSelection.has(vendorId)) {
      newSelection.delete(vendorId);
    } else {
      newSelection.add(vendorId);
    }
    setSelectedVendorIds(newSelection);
  };

  // Select/deselect all
  const toggleSelectAll = () => {
    if (selectedVendorIds.size === vendors.length) {
      setSelectedVendorIds(new Set());
    } else {
      setSelectedVendorIds(new Set(vendors.map((v) => v.id)));
    }
  };

  // Open edit dialog
  const openEditDialog = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setEditForm({
      name: vendor.name,
      email: vendor.email || "",
      phone: vendor.phone || "",
      notes: "",
      active: vendor.active,
    });
    setEditDialogOpen(true);
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingVendor) return;

    if (!editForm.name.trim()) {
      toast.error("Vendor name is required");
      return;
    }

    setIsSavingEdit(true);
    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/vendors/${editingVendor.id}`,
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
        throw new Error(error.error || "Failed to update vendor");
      }

      toast.success("Vendor updated successfully");
      setEditDialogOpen(false);
      fetchVendors();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update vendor");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open merge dialog
  const openMergeDialog = () => {
    if (selectedVendorIds.size < 2) {
      toast.error("Please select at least 2 vendors to merge");
      return;
    }
    setPrimaryVendorId("");
    setMergeDialogOpen(true);
  };

  // Perform merge
  const handleMerge = async () => {
    if (!primaryVendorId) {
      toast.error("Please select a primary vendor");
      return;
    }

    const secondaryIds = Array.from(selectedVendorIds).filter(
      (id) => id !== primaryVendorId
    );

    if (secondaryIds.length === 0) {
      toast.error("No secondary vendors to merge");
      return;
    }

    setIsMerging(true);
    try {
      const response = await fetch(`/api/orgs/${orgSlug}/vendors/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryId: primaryVendorId,
          ids: secondaryIds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to merge vendors");
      }

      const result = await response.json();
      toast.success(
        `Successfully merged ${secondaryIds.length} vendor(s). ${result.reassignedCount || 0} transaction(s) reassigned.`
      );
      setMergeDialogOpen(false);
      setSelectedVendorIds(new Set());
      fetchVendors();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to merge vendors");
    } finally {
      setIsMerging(false);
    }
  };

  const selectedVendors = vendors.filter((v) => selectedVendorIds.has(v.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendors</h1>
          <p className="text-muted-foreground">
            Manage your vendors and view spending analytics
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
            Select a date range to view vendor transaction totals
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
      {selectedVendorIds.size > 0 && (
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span className="font-medium">
                  {selectedVendorIds.size} vendor(s) selected
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedVendorIds(new Set())}
                >
                  Clear Selection
                </Button>
                <Button onClick={openMergeDialog} disabled={selectedVendorIds.size < 2}>
                  <GitMerge className="mr-2 h-4 w-4" />
                  Merge Vendors
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vendors Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Vendors</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
            >
              {selectedVendorIds.size === vendors.length ? "Deselect All" : "Select All"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="mx-auto h-12 w-12 mb-2 opacity-50" />
              <p>No vendors found for this period</p>
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
                {vendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedVendorIds.has(vendor.id)}
                        onCheckedChange={() => toggleVendorSelection(vendor.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm">
                        {vendor.email && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {vendor.email}
                          </div>
                        )}
                        {vendor.phone && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {vendor.phone}
                          </div>
                        )}
                        {!vendor.email && !vendor.phone && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {vendor.active ? (
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
                      {vendor.totals?.transactionCount || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {settings?.baseCurrency}{" "}
                      {(vendor.totals?.totalAmount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(vendor)}
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
            <DialogTitle>Edit Vendor</DialogTitle>
            <DialogDescription>
              Update vendor information and contact details
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
                placeholder="Vendor name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="vendor@example.com"
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
            <DialogTitle>Merge Vendors</DialogTitle>
            <DialogDescription>
              Select the primary vendor to keep. All transactions from secondary
              vendors will be reassigned to the primary vendor, and secondary vendors
              will be deactivated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Selected Vendors</Label>
              <div className="rounded-md border p-3 space-y-1">
                {selectedVendors.map((vendor) => (
                  <div key={vendor.id} className="text-sm">
                    {vendor.name}
                    {vendor.totals && (
                      <span className="text-muted-foreground ml-2">
                        ({vendor.totals.transactionCount} transactions, {settings?.baseCurrency}{" "}
                        {vendor.totals.totalAmount.toFixed(2)})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary-vendor">
                Primary Vendor <span className="text-destructive">*</span>
              </Label>
              <Select value={primaryVendorId} onValueChange={setPrimaryVendorId}>
                <SelectTrigger id="primary-vendor">
                  <SelectValue placeholder="Select primary vendor" />
                </SelectTrigger>
                <SelectContent>
                  {selectedVendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This vendor will be kept, and all others will be merged into it
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
            <Button onClick={handleMerge} disabled={isMerging || !primaryVendorId}>
              {isMerging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <GitMerge className="mr-2 h-4 w-4" />
                  Merge Vendors
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
