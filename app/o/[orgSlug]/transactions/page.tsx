"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { formatDate, formatTransactionAmount } from "@/lib/sololedger-formatters";
import type { DateFormat, DecimalSeparator, ThousandsSeparator } from "@prisma/client";
import { ChevronsUpDown, Trash2 } from "lucide-react";

interface Transaction {
  id: string;
  type: "INCOME" | "EXPENSE";
  status: "DRAFT" | "POSTED";
  date: string;
  description: string;
  amountBase: string;
  currencyBase?: string | null;
  amountSecondary?: string | null;
  currencySecondary?: string | null;
  category: { id: string; name: string };
  account: { id: string; name: string };
  client?: { id: string; name: string } | null;
  vendor?: { id: string; name: string } | null;
  clientName?: string | null;
  vendorName?: string | null;
}

interface OrgSettings {
  baseCurrency: string;
  dateFormat: DateFormat;
  decimalSeparator: DecimalSeparator;
  thousandsSeparator: ThousandsSeparator;
}

interface Category {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
}

interface Vendor {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
}

export default function TransactionsPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [settings, setSettings] = React.useState<OrgSettings | null>(null);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [vendors, setVendors] = React.useState<Vendor[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);

  // Basic filters
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [dateFromFilter, setDateFromFilter] = React.useState<string>("");
  const [dateToFilter, setDateToFilter] = React.useState<string>("");
  const [searchFilter, setSearchFilter] = React.useState<string>("");

  // Advanced filters
  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<string[]>([]);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = React.useState(false);
  const [vendorFilter, setVendorFilter] = React.useState<string>("all");
  const [clientFilter, setClientFilter] = React.useState<string>("all");
  const [amountMinFilter, setAmountMinFilter] = React.useState<string>("");
  const [amountMaxFilter, setAmountMaxFilter] = React.useState<string>("");
  const [currencyFilter, setCurrencyFilter] = React.useState<string>("all");

  // Selection state for bulk actions
  const [selectedTransactionIds, setSelectedTransactionIds] = React.useState<string[]>([]);

  // Bulk action dialog states
  const [bulkCategoryDialogOpen, setBulkCategoryDialogOpen] = React.useState(false);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = React.useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const [bulkCategoryId, setBulkCategoryId] = React.useState<string>("");
  const [bulkStatus, setBulkStatus] = React.useState<string>("POSTED");
  const [bulkActionLoading, setBulkActionLoading] = React.useState(false);

  // Single transaction delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [transactionToDelete, setTransactionToDelete] = React.useState<string | null>(null);

  // Load organization, settings, and lookup data
  React.useEffect(() => {
    async function loadOrgAndData() {
      try {
        // Load settings
        const settingsResponse = await fetch(
          `/api/orgs/${orgSlug}/settings/financial`
        );
        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          setSettings(settingsData.settings);
        } else if (settingsResponse.status === 404) {
          toast.error("Organization not found");
          router.push("/");
          return;
        }

        // Load categories
        const categoriesResponse = await fetch(`/api/orgs/${orgSlug}/categories`);
        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json();
          setCategories(categoriesData.categories || []);
        }

        // Load vendors
        const vendorsResponse = await fetch(`/api/orgs/${orgSlug}/vendors`);
        if (vendorsResponse.ok) {
          const vendorsData = await vendorsResponse.json();
          setVendors(vendorsData.vendors || []);
        }

        // Load clients
        const clientsResponse = await fetch(`/api/orgs/${orgSlug}/clients`);
        if (clientsResponse.ok) {
          const clientsData = await clientsResponse.json();
          setClients(clientsData.clients || []);
        }

        await loadTransactions();
      } catch (error) {
        console.error("Error loading organization:", error);
        toast.error("Failed to load organization");
      } finally {
        setIsInitialLoading(false);
      }
    }

    loadOrgAndData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, router]);

  // Read URL params and apply filters on mount (for dashboard drill-down)
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    // Apply date filters from URL
    const fromDate = urlParams.get("from");
    const toDate = urlParams.get("to");
    if (fromDate) setDateFromFilter(fromDate);
    if (toDate) setDateToFilter(toDate);

    // Apply type filter from URL
    const typeParam = urlParams.get("type");
    if (typeParam) setTypeFilter(typeParam);

    // Apply status filter from URL
    const statusParam = urlParams.get("status");
    if (statusParam) setStatusFilter(statusParam);

    // Apply category filter from URL
    const categoryIdsParam = urlParams.get("categoryIds");
    if (categoryIdsParam) {
      const ids = categoryIdsParam.split(",").filter(Boolean);
      setSelectedCategoryIds(ids);
    }

    // Apply currency filter from URL
    const currencyParam = urlParams.get("currency");
    if (currencyParam) setCurrencyFilter(currencyParam);

    // Apply vendor filter from URL
    const vendorParam = urlParams.get("vendorId");
    if (vendorParam) setVendorFilter(vendorParam);

    // Apply client filter from URL
    const clientParam = urlParams.get("clientId");
    if (clientParam) setClientFilter(clientParam);
  }, []);

  async function loadTransactions() {
    try {
      setIsLoading(true);

      // Build query params
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (dateFromFilter) params.append("dateFrom", dateFromFilter);
      if (dateToFilter) params.append("dateTo", dateToFilter);
      if (vendorFilter !== "all") params.append("vendorId", vendorFilter);
      if (clientFilter !== "all") params.append("clientId", clientFilter);
      if (selectedCategoryIds.length > 0) {
        params.append("categoryIds", selectedCategoryIds.join(","));
      }
      if (amountMinFilter) params.append("amountMin", amountMinFilter);
      if (amountMaxFilter) params.append("amountMax", amountMaxFilter);
      if (currencyFilter !== "all") params.append("currency", currencyFilter);

      const response = await fetch(
        `/api/orgs/${orgSlug}/transactions?${params.toString()}`
      );

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
        // Clear selection when reloading transactions
        setSelectedTransactionIds([]);
      }
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleClearFilters() {
    setTypeFilter("all");
    setStatusFilter("all");
    setDateFromFilter("");
    setDateToFilter("");
    setSearchFilter("");
    setSelectedCategoryIds([]);
    setVendorFilter("all");
    setClientFilter("all");
    setAmountMinFilter("");
    setAmountMaxFilter("");
    setCurrencyFilter("all");
    loadTransactions();
  }

  function toggleCategorySelection(categoryId: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  }

  function toggleTransactionSelection(transactionId: string) {
    setSelectedTransactionIds((prev) =>
      prev.includes(transactionId)
        ? prev.filter((id) => id !== transactionId)
        : [...prev, transactionId]
    );
  }

  function toggleSelectAll() {
    if (selectedTransactionIds.length === filteredTransactions.length) {
      setSelectedTransactionIds([]);
    } else {
      setSelectedTransactionIds(filteredTransactions.map((t) => t.id));
    }
  }

  async function handleDelete() {
    if (!transactionToDelete) return;

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/transactions/${transactionToDelete}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error || "Failed to delete transaction");
        return;
      }

      toast.success("Transaction deleted");
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
      await loadTransactions();
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  async function handleBulkChangeCategory() {
    if (!bulkCategoryId) {
      toast.error("Please select a category");
      return;
    }

    try {
      setBulkActionLoading(true);

      const response = await fetch(`/api/orgs/${orgSlug}/transactions/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionIds: selectedTransactionIds,
          action: "changeCategory",
          categoryId: bulkCategoryId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to change category");
        return;
      }

      toast.success(
        `${result.successCount} transaction(s) updated${
          result.failureCount > 0 ? `, ${result.failureCount} failed` : ""
        }`
      );

      setBulkCategoryDialogOpen(false);
      setBulkCategoryId("");
      await loadTransactions();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function handleBulkChangeStatus() {
    try {
      setBulkActionLoading(true);

      const response = await fetch(`/api/orgs/${orgSlug}/transactions/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionIds: selectedTransactionIds,
          action: "changeStatus",
          status: bulkStatus,
          allowSoftClosedOverride: true, // User confirmed via dialog
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to change status");
        return;
      }

      toast.success(
        `${result.successCount} transaction(s) updated${
          result.failureCount > 0 ? `, ${result.failureCount} failed` : ""
        }`
      );

      setBulkStatusDialogOpen(false);
      await loadTransactions();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function handleBulkDelete() {
    try {
      setBulkActionLoading(true);

      const response = await fetch(`/api/orgs/${orgSlug}/transactions/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionIds: selectedTransactionIds,
          action: "delete",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to delete transactions");
        return;
      }

      toast.success(
        `${result.successCount} transaction(s) deleted${
          result.failureCount > 0 ? `, ${result.failureCount} failed` : ""
        }`
      );

      setBulkDeleteDialogOpen(false);
      await loadTransactions();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBulkActionLoading(false);
    }
  }

  function handleBulkExportCSV() {
    if (selectedTransactionIds.length === 0) {
      toast.error("No transactions selected");
      return;
    }

    const exportUrl = `/api/orgs/${orgSlug}/transactions/export?ids=${selectedTransactionIds.join(",")}`;
    window.location.href = exportUrl;
    toast.success("Export started");
  }

  // Apply search filter client-side
  const filteredTransactions = React.useMemo(() => {
    if (!searchFilter.trim()) return transactions;

    const search = searchFilter.toLowerCase();
    return transactions.filter(
      (t) =>
        t.description.toLowerCase().includes(search) ||
        t.category.name.toLowerCase().includes(search) ||
        t.account.name.toLowerCase().includes(search) ||
        (t.clientName && t.clientName.toLowerCase().includes(search)) ||
        (t.client?.name && t.client.name.toLowerCase().includes(search)) ||
        (t.vendorName && t.vendorName.toLowerCase().includes(search)) ||
        (t.vendor?.name && t.vendor.name.toLowerCase().includes(search))
    );
  }, [transactions, searchFilter]);

  const allSelected =
    filteredTransactions.length > 0 &&
    selectedTransactionIds.length === filteredTransactions.length;
  const someSelected = selectedTransactionIds.length > 0;

  if (isInitialLoading || !settings) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">
            Manage your income and expenses
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/o/${orgSlug}/transactions/trash`}>
              <Trash2 className="h-4 w-4 mr-2" />
              Trash
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/o/${orgSlug}/transactions/new`}>
              + New Transaction
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter and search transactions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Date, Type, Status */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="INCOME">Income</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="POSTED">Posted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Category, Vendor, Client, Currency */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={categoryPopoverOpen}
                    className="w-full justify-between"
                  >
                    {selectedCategoryIds.length === 0
                      ? "All categories"
                      : `${selectedCategoryIds.length} selected`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search categories..." />
                    <CommandEmpty>No category found.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {categories.map((category) => (
                        <CommandItem
                          key={category.id}
                          onSelect={() => toggleCategorySelection(category.id)}
                        >
                          <Checkbox
                            checked={selectedCategoryIds.includes(category.id)}
                            className="mr-2"
                          />
                          {category.name}
                          <Badge variant="outline" className="ml-2 text-xs">
                            {category.type}
                          </Badge>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Select value={vendorFilter} onValueChange={setVendorFilter}>
                <SelectTrigger id="vendor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All vendors</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger id="client">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All currencies</SelectItem>
                  <SelectItem value={settings.baseCurrency}>
                    {settings.baseCurrency}
                  </SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Amount range, Search */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="amountMin">Amount Min (Base)</Label>
              <Input
                id="amountMin"
                type="number"
                placeholder="0.00"
                value={amountMinFilter}
                onChange={(e) => setAmountMinFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amountMax">Amount Max (Base)</Label>
              <Input
                id="amountMax"
                type="number"
                placeholder="0.00"
                value={amountMaxFilter}
                onChange={(e) => setAmountMaxFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Description, category, client, vendor..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => loadTransactions()} disabled={isLoading}>
              {isLoading ? "Loading..." : "Apply Filters"}
            </Button>
            <Button variant="outline" onClick={handleClearFilters}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Selection Toolbar - shown when items are selected */}
      {someSelected && (
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {selectedTransactionIds.length} selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkCategoryDialogOpen(true)}
                >
                  Change category
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkStatusDialogOpen(true)}
                >
                  Change status
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                >
                  Delete selected
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkExportCSV}
                >
                  Export CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Transactions ({filteredTransactions.length})
          </CardTitle>
          <CardDescription>All your business transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No transactions found.{" "}
              <Link
                href={`/o/${orgSlug}/transactions/new`}
                className="underline"
              >
                Create your first transaction
              </Link>
            </p>
          ) : (
            <div className="space-y-2">
              {/* Header row with select all */}
              <div className="flex items-center gap-2 p-2 border-b">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
                <span className="text-sm text-muted-foreground">
                  Select all
                </span>
              </div>

              {/* Transaction rows */}
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedTransactionIds.includes(transaction.id)}
                    onCheckedChange={() => toggleTransactionSelection(transaction.id)}
                    onClick={(e) => e.stopPropagation()}
                  />

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {transaction.description}
                      </span>
                      <Badge
                        variant={
                          transaction.type === "INCOME"
                            ? "default"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {transaction.type}
                      </Badge>
                      <Badge
                        variant={
                          transaction.status === "POSTED"
                            ? "default"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {transaction.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {formatDate(
                        new Date(transaction.date),
                        settings.dateFormat
                      )}{" "}
                      • {transaction.category.name} • {transaction.account.name}
                      {transaction.type === "INCOME" &&
                        (transaction.clientName || transaction.client?.name) && (
                          <> • Client: {transaction.clientName || transaction.client?.name}</>
                        )}
                      {transaction.type === "EXPENSE" &&
                        (transaction.vendorName || transaction.vendor?.name) && (
                          <> • Vendor: {transaction.vendorName || transaction.vendor?.name}</>
                        )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div
                      className={`text-lg font-semibold ${
                        transaction.type === "INCOME"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {transaction.type === "INCOME" ? "+" : "-"}
                      {formatTransactionAmount(
                        transaction,
                        settings.baseCurrency,
                        settings.decimalSeparator,
                        settings.thousandsSeparator
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                      >
                        <Link
                          href={`/o/${orgSlug}/transactions/${transaction.id}`}
                        >
                          Edit
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTransactionToDelete(transaction.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Change Category Dialog */}
      <Dialog open={bulkCategoryDialogOpen} onOpenChange={setBulkCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Change Category for {selectedTransactionIds.length} Transaction(s)
            </DialogTitle>
            <DialogDescription>
              Select a new category for the selected transactions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-category">Category</Label>
              <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
                <SelectTrigger id="bulk-category">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name} ({category.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkCategoryDialogOpen(false)}
              disabled={bulkActionLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleBulkChangeCategory} disabled={bulkActionLoading}>
              {bulkActionLoading ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Change Status Dialog */}
      <Dialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Change Status for {selectedTransactionIds.length} Transaction(s)
            </DialogTitle>
            <DialogDescription>
              Select a new status for the selected transactions. If any are
              POSTED in soft-closed periods, this will override the soft-closed
              protection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-status">Status</Label>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger id="bulk-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="POSTED">Posted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkStatusDialogOpen(false)}
              disabled={bulkActionLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleBulkChangeStatus} disabled={bulkActionLoading}>
              {bulkActionLoading ? "Updating..." : "Confirm & Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {selectedTransactionIds.length} Transaction(s)
            </DialogTitle>
            <DialogDescription>
              These transactions will be moved to Trash. You can restore them
              later from the Trash.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteDialogOpen(false)}
              disabled={bulkActionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
            >
              {bulkActionLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Transaction Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              This transaction will be moved to Trash. You can restore it later
              from the Trash.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setTransactionToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
