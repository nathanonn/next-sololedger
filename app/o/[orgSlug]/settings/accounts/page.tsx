"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Info, DollarSign, TrendingUp, Calendar } from "lucide-react";

interface Account {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
}

interface AccountBalance extends Account {
  balanceBase?: number;
  transactionCount?: number;
}

interface OrgSettings {
  baseCurrency: string;
  fiscalYearStartMonth: number;
}

export default function AccountsManagementPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [accounts, setAccounts] = React.useState<AccountBalance[]>([]);
  const [settings, setSettings] = React.useState<OrgSettings | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState<Account | null>(
    null
  );

  // Date range state
  const [dateRange, setDateRange] = React.useState<"30days" | "ytd" | "all">("30days");
  const [computedFromDate, setComputedFromDate] = React.useState<string>("");
  const [computedToDate, setComputedToDate] = React.useState<string>("");

  // Form state
  const [formName, setFormName] = React.useState("");
  const [formDescription, setFormDescription] = React.useState("");
  const [formIsDefault, setFormIsDefault] = React.useState(false);
  const [formActive, setFormActive] = React.useState(true);

  // Compute date range based on selection
  React.useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const toDate = today.toISOString().split("T")[0];

    let fromDate = "";

    if (dateRange === "30days") {
      const from = new Date(today);
      from.setDate(from.getDate() - 30);
      fromDate = from.toISOString().split("T")[0];
    } else if (dateRange === "ytd" && settings) {
      // Fiscal year to date
      const fiscalStart = new Date(
        today.getFullYear(),
        settings.fiscalYearStartMonth - 1,
        1
      );
      // If we're before the fiscal year start, use last year's fiscal year
      if (today < fiscalStart) {
        fiscalStart.setFullYear(fiscalStart.getFullYear() - 1);
      }
      fromDate = fiscalStart.toISOString().split("T")[0];
    } else if (dateRange === "all") {
      // Use a date far in the past (e.g., 10 years ago)
      const from = new Date(today);
      from.setFullYear(from.getFullYear() - 10);
      fromDate = from.toISOString().split("T")[0];
    }

    setComputedFromDate(fromDate);
    setComputedToDate(toDate);
  }, [dateRange, settings]);

  // Load settings
  React.useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch(`/api/orgs/${orgSlug}/settings/financial`);
        if (response.ok) {
          const data = await response.json();
          setSettings({
            baseCurrency: data.baseCurrency,
            fiscalYearStartMonth: data.fiscalYearStartMonth || 1,
          });
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      }
    }
    fetchSettings();
  }, [orgSlug]);

  // Load organization and accounts
  React.useEffect(() => {
    async function loadOrgAndAccounts() {
      try {
        await loadAccounts();
      } catch (error) {
        console.error("Error loading organization:", error);
        toast.error("Failed to load organization");
      } finally {
        setIsInitialLoading(false);
      }
    }

    loadOrgAndAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, router]);

  // Reload balances when date range changes
  React.useEffect(() => {
    if (computedFromDate && computedToDate && !isInitialLoading) {
      loadBalances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedFromDate, computedToDate, isInitialLoading]);

  async function loadAccounts() {
    try {
      const response = await fetch(`/api/orgs/${orgSlug}/accounts`);
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
      } else if (response.status === 403) {
        toast.error("Admin access required to manage accounts");
        router.push(`/o/${orgSlug}/dashboard`);
      } else if (response.status === 404) {
        toast.error("Organization not found");
        router.push("/");
      }
    } catch (error) {
      console.error("Error loading accounts:", error);
    }
  }

  async function loadBalances() {
    if (!computedFromDate || !computedToDate) return;

    try {
      const url = new URL(`/api/orgs/${orgSlug}/accounts/balances`, window.location.origin);
      url.searchParams.set("from", computedFromDate);
      url.searchParams.set("to", computedToDate);

      const response = await fetch(url.toString());
      if (response.ok) {
        const data = await response.json();
        // Merge balances with existing accounts
        setAccounts((prev) => {
          const balanceMap = new Map(
            data.accounts.map((acc: AccountBalance) => [acc.id, acc])
          );
          return prev.map((account) => ({
            ...account,
            balanceBase: balanceMap.get(account.id)?.balanceBase || 0,
            transactionCount: balanceMap.get(account.id)?.transactionCount || 0,
          }));
        });
      }
    } catch (error) {
      console.error("Error loading balances:", error);
    }
  }

  function resetForm() {
    setFormName("");
    setFormDescription("");
    setFormIsDefault(false);
    setFormActive(true);
    setEditingAccount(null);
  }

  function openAddDialog() {
    resetForm();
    setIsAddDialogOpen(true);
  }

  function openEditDialog(account: Account) {
    setFormName(account.name);
    setFormDescription(account.description || "");
    setFormIsDefault(account.isDefault);
    setFormActive(account.active);
    setEditingAccount(account);
    setIsAddDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formName.trim()) {
      toast.error("Please enter an account name");
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(
        editingAccount
          ? `/api/orgs/${orgSlug}/accounts/${editingAccount.id}`
          : `/api/orgs/${orgSlug}/accounts`,
        {
          method: editingAccount ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            description: formDescription || null,
            isDefault: formIsDefault,
            active: formActive,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to save account");
        return;
      }

      toast.success(
        editingAccount ? "Account updated" : "Account created"
      );
      setIsAddDialogOpen(false);
      resetForm();

      // Reload accounts
      await loadAccounts();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isInitialLoading) {
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

  // Handle account click to view transactions
  const handleAccountClick = (accountId: string) => {
    const query = new URLSearchParams({
      accountId,
      from: computedFromDate,
      to: computedToDate,
    });
    router.push(`/o/${orgSlug}/transactions?${query.toString()}`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Accounts</h1>
        <p className="text-muted-foreground">
          Where your money lives (bank, cash, payment services)
        </p>
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date Range
          </CardTitle>
          <CardDescription>
            Select a date range to view account balances
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
                <RadioGroupItem value="30days" id="30days" />
                <Label htmlFor="30days" className="font-normal">
                  Last 30 Days
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ytd" id="ytd" />
                <Label htmlFor="ytd" className="font-normal">
                  Fiscal YTD
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="font-normal">
                  All Time
                </Label>
              </div>
            </RadioGroup>
          </div>

          {computedFromDate && computedToDate && (
            <div className="text-sm text-muted-foreground">
              Viewing data from {computedFromDate} to {computedToDate}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accounts List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>All Accounts</CardTitle>
            <CardDescription>Manage your business accounts</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}>+ New Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingAccount ? "Edit Account" : "New Account"}
                </DialogTitle>
                <DialogDescription>
                  {editingAccount
                    ? "Update account details"
                    : "Create a new account for your business"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Main Bank Account"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional description"
                    disabled={isLoading}
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="isDefault">Default Account</Label>
                    <p className="text-xs text-muted-foreground">
                      Only one default account per business
                    </p>
                  </div>
                  <Switch
                    id="isDefault"
                    checked={formIsDefault}
                    onCheckedChange={setFormIsDefault}
                    disabled={isLoading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="active">Active</Label>
                  <Switch
                    id="active"
                    checked={formActive}
                    onCheckedChange={setFormActive}
                    disabled={isLoading}
                  />
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading
                    ? "Saving..."
                    : editingAccount
                      ? "Update Account"
                      : "Create Account"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Only Owners/Admins can manage accounts.
            </AlertDescription>
          </Alert>

          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No accounts yet. Create your first account to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleAccountClick(account.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{account.name}</span>
                      {account.isDefault && (
                        <Badge variant="default" className="text-xs">
                          Default
                        </Badge>
                      )}
                      {!account.active && (
                        <Badge variant="outline" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    {account.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {account.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1 text-sm">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {settings?.baseCurrency}{" "}
                          {(account.balanceBase || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <TrendingUp className="h-4 w-4" />
                        {account.transactionCount || 0} transactions
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditDialog(account);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
