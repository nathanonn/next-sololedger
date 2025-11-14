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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDate, formatCurrency } from "@/lib/sololedger-formatters";
import type { DateFormat, DecimalSeparator, ThousandsSeparator } from "@prisma/client";

interface Transaction {
  id: string;
  type: "INCOME" | "EXPENSE";
  status: "DRAFT" | "POSTED";
  date: string;
  description: string;
  amountBase: string;
  category: { id: string; name: string };
  account: { id: string; name: string };
}

interface OrgSettings {
  baseCurrency: string;
  dateFormat: DateFormat;
  decimalSeparator: DecimalSeparator;
  thousandsSeparator: ThousandsSeparator;
}

export default function TransactionsPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [settings, setSettings] = React.useState<OrgSettings | null>(null);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);

  // Filters
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [dateFromFilter, setDateFromFilter] = React.useState<string>("");
  const [dateToFilter, setDateToFilter] = React.useState<string>("");
  const [searchFilter, setSearchFilter] = React.useState<string>("");

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

        await loadTransactions();
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

  async function loadTransactions() {
    try {
      setIsLoading(true);

      // Build query params
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (dateFromFilter) params.append("dateFrom", dateFromFilter);
      if (dateToFilter) params.append("dateTo", dateToFilter);

      const response = await fetch(
        `/api/orgs/${orgSlug}/transactions?${params.toString()}`
      );

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(transactionId: string) {
    if (!confirm("Are you sure you want to delete this transaction?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/transactions/${transactionId}`,
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
      await loadTransactions();
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  // Apply search filter client-side
  const filteredTransactions = React.useMemo(() => {
    if (!searchFilter.trim()) return transactions;

    const search = searchFilter.toLowerCase();
    return transactions.filter(
      (t) =>
        t.description.toLowerCase().includes(search) ||
        t.category.name.toLowerCase().includes(search) ||
        t.account.name.toLowerCase().includes(search)
    );
  }, [transactions, searchFilter]);

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
        <Button asChild>
          <Link href={`/o/${orgSlug}/transactions/new`}>
            + New Transaction
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter and search transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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

            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Description, category..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={() => loadTransactions()} disabled={isLoading}>
              {isLoading ? "Loading..." : "Apply Filters"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setTypeFilter("all");
                setStatusFilter("all");
                setDateFromFilter("");
                setDateToFilter("");
                setSearchFilter("");
                loadTransactions();
              }}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

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
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
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
                      {formatDate(
                        new Date(transaction.date),
                        settings.dateFormat
                      )}{" "}
                      • {transaction.category.name} • {transaction.account.name}
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
                      {formatCurrency(
                        Number(transaction.amountBase),
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
                        onClick={() => handleDelete(transaction.id)}
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
    </div>
  );
}
