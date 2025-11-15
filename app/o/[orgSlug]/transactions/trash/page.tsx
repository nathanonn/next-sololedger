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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDate, formatCurrency } from "@/lib/sololedger-formatters";
import type { DateFormat, DecimalSeparator, ThousandsSeparator } from "@prisma/client";
import { ArrowLeft } from "lucide-react";

interface Transaction {
  id: string;
  type: "INCOME" | "EXPENSE";
  status: "DRAFT" | "POSTED";
  date: string;
  deletedAt: string;
  description: string;
  amountBase: string;
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

export default function TransactionsTrashPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [settings, setSettings] = React.useState<OrgSettings | null>(null);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);

  // Filters
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [deletedFromFilter, setDeletedFromFilter] = React.useState<string>("");
  const [deletedToFilter, setDeletedToFilter] = React.useState<string>("");
  const [searchFilter, setSearchFilter] = React.useState<string>("");

  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [transactionToDelete, setTransactionToDelete] = React.useState<string | null>(null);

  // Load organization and transactions
  React.useEffect(() => {
    async function loadOrgAndTransactions() {
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

        await loadTrashTransactions();
      } catch (error) {
        console.error("Error loading organization:", error);
        toast.error("Failed to load organization");
      } finally {
        setIsInitialLoading(false);
      }
    }

    loadOrgAndTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, router]);

  async function loadTrashTransactions() {
    try {
      setIsLoading(true);

      // Build query params
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (deletedFromFilter) params.append("deletedFrom", deletedFromFilter);
      if (deletedToFilter) params.append("deletedTo", deletedToFilter);
      if (searchFilter) params.append("search", searchFilter);

      const response = await fetch(
        `/api/orgs/${orgSlug}/transactions/trash?${params.toString()}`
      );

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error("Error loading trash transactions:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleClearFilters() {
    setTypeFilter("all");
    setDeletedFromFilter("");
    setDeletedToFilter("");
    setSearchFilter("");
    loadTrashTransactions();
  }

  async function handleRestore(transactionId: string) {
    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/transactions/${transactionId}/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error || "Failed to restore transaction");
        return;
      }

      toast.success("Transaction restored");
      await loadTrashTransactions();
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  async function handlePermanentDelete() {
    if (!transactionToDelete) return;

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/transactions/${transactionToDelete}/hard-delete`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error || "Failed to permanently delete transaction");
        return;
      }

      toast.success("Transaction permanently deleted");
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
      await loadTrashTransactions();
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  function openDeleteDialog(transactionId: string) {
    setTransactionToDelete(transactionId);
    setDeleteDialogOpen(true);
  }

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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/o/${orgSlug}/transactions`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Transactions
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold mt-2">Trash</h1>
          <p className="text-muted-foreground">
            Restore or permanently delete transactions
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter deleted transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="deletedFrom">Deleted From</Label>
              <Input
                id="deletedFrom"
                type="date"
                value={deletedFromFilter}
                onChange={(e) => setDeletedFromFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deletedTo">Deleted To</Label>
              <Input
                id="deletedTo"
                type="date"
                value={deletedToFilter}
                onChange={(e) => setDeletedToFilter(e.target.value)}
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

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Description, vendor, client..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={() => loadTrashTransactions()} disabled={isLoading}>
              {isLoading ? "Loading..." : "Apply Filters"}
            </Button>
            <Button variant="outline" onClick={handleClearFilters}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Trash List */}
      <Card>
        <CardHeader>
          <CardTitle>Deleted Transactions ({transactions.length})</CardTitle>
          <CardDescription>
            Transactions can be restored or permanently deleted
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No deleted transactions found.
            </p>
          ) : (
            <div className="space-y-2">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-start justify-between p-4 border rounded-lg"
                >
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
                      Transaction Date:{" "}
                      {formatDate(
                        new Date(transaction.date),
                        settings.dateFormat
                      )}{" "}
                      • Deleted:{" "}
                      {formatDate(
                        new Date(transaction.deletedAt),
                        settings.dateFormat
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {transaction.category.name} • {transaction.account.name}
                      {transaction.type === "INCOME" &&
                        (transaction.clientName || transaction.client?.name) && (
                          <> • Client: {transaction.clientName || transaction.client?.name}</>
                        )}
                      {transaction.type === "EXPENSE" &&
                        (transaction.vendorName || transaction.vendor?.name) && (
                          <> • Vendor: {transaction.vendorName || transaction.vendor?.name}</>
                        )}
                    </div>
                    <div className="text-sm font-semibold mt-2">
                      {transaction.type === "INCOME" ? "+" : "-"}
                      {formatCurrency(
                        Number(transaction.amountBase),
                        settings.baseCurrency,
                        settings.decimalSeparator,
                        settings.thousandsSeparator
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(transaction.id)}
                    >
                      Restore
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteDialog(transaction.id)}
                    >
                      Delete Forever
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently Delete Transaction</DialogTitle>
            <DialogDescription>
              This will permanently delete the transaction and any related
              links. This action cannot be undone.
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
            <Button variant="destructive" onClick={handlePermanentDelete}>
              Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
