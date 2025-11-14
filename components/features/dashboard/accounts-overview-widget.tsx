"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, DollarSign } from "lucide-react";

interface Account {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  active: boolean;
  balanceBase?: number;
  transactionCount?: number;
}

interface AccountsOverviewWidgetProps {
  orgSlug: string;
  baseCurrency: string;
  dateRange: "ytd" | "all";
  fromDate?: string;
  toDate?: string;
}

export function AccountsOverviewWidget({
  orgSlug,
  baseCurrency,
  dateRange,
  fromDate,
  toDate,
}: AccountsOverviewWidgetProps) {
  const router = useRouter();
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchBalances() {
      setIsLoading(true);
      try {
        const url = new URL(
          `/api/orgs/${orgSlug}/accounts/balances`,
          window.location.origin
        );

        if (fromDate && toDate) {
          url.searchParams.set("from", fromDate);
          url.searchParams.set("to", toDate);
        }

        const response = await fetch(url.toString());
        if (response.ok) {
          const data = await response.json();
          setAccounts(data.accounts || []);
        }
      } catch (error) {
        console.error("Failed to fetch account balances:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchBalances();
  }, [orgSlug, fromDate, toDate]);

  const handleAccountClick = (accountId: string) => {
    if (!fromDate || !toDate) return;

    const query = new URLSearchParams({
      accountId,
      from: fromDate,
      to: toDate,
    });
    router.push(`/o/${orgSlug}/transactions?${query.toString()}`);
  };

  const totalBalance = accounts.reduce(
    (sum, account) => sum + (account.balanceBase || 0),
    0
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            {dateRange === "ytd" ? "Year-to-date balances" : "All-time balances"}
          </CardDescription>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/o/${orgSlug}/settings/accounts`}>Manage accounts</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No accounts yet.{" "}
            <Link href={`/o/${orgSlug}/settings/accounts`} className="underline">
              Create your first account
            </Link>
          </p>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {accounts.slice(0, 5).map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleAccountClick(account.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{account.name}</span>
                      {account.isDefault && (
                        <Badge variant="secondary" className="text-xs">
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
                      <p className="text-sm text-muted-foreground">
                        {account.description}
                      </p>
                    )}
                    {account.transactionCount !== undefined && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {account.transactionCount} transactions
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-semibold ${
                        (account.balanceBase || 0) >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {baseCurrency} {(account.balanceBase || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Balance Summary */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Total Balance</span>
                </div>
                <div
                  className={`text-xl font-bold ${
                    totalBalance >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {baseCurrency} {totalBalance.toFixed(2)}
                </div>
              </div>
              {accounts.length > 5 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Showing top 5 of {accounts.length} accounts
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
