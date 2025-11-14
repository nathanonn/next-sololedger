import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, getUserMembership, isSuperadmin } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getYTDRange, formatCurrency, formatDate } from "@/lib/sololedger-formatters";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

/**
 * Business Dashboard
 * Shows YTD metrics, account balances, and recent activity
 */

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<React.JSX.Element> {
  const { orgSlug } = await params;

  // Validate session and membership
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/o/${orgSlug}/dashboard`);
  }

  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    redirect("/");
  }

  const userIsSuperadmin = await isSuperadmin(user.id);
  const membership = await getUserMembership(user.id, org.id);

  if (!membership && !userIsSuperadmin) {
    redirect("/?error=not_a_member");
  }

  // Get organization settings
  const settings = await db.organizationSettings.findUnique({
    where: { organizationId: org.id },
  });

  if (!settings) {
    // No settings yet, shouldn't happen if onboarding is complete
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please complete onboarding to view your dashboard
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get YTD date range
  const { startDate, endDate } = getYTDRange(settings.fiscalYearStartMonth);

  // Get YTD transactions (Posted only)
  const ytdTransactions = await db.transaction.findMany({
    where: {
      organizationId: org.id,
      status: "POSTED",
      deletedAt: null,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      category: true,
    },
  });

  // Calculate YTD metrics
  const ytdIncome = ytdTransactions
    .filter((t) => t.type === "INCOME" && t.category.includeInPnL)
    .reduce((sum, t) => sum + Number(t.amountBase), 0);

  const ytdExpenses = ytdTransactions
    .filter((t) => t.type === "EXPENSE" && t.category.includeInPnL)
    .reduce((sum, t) => sum + Number(t.amountBase), 0);

  const ytdProfitLoss = ytdIncome - ytdExpenses;

  // Get accounts with balances
  const accounts = await db.account.findMany({
    where: {
      organizationId: org.id,
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  // Calculate balances for each account
  const accountBalances = await Promise.all(
    accounts.map(async (account) => {
      const transactions = await db.transaction.findMany({
        where: {
          accountId: account.id,
          deletedAt: null,
          status: "POSTED",
        },
      });

      const income = transactions
        .filter((t) => t.type === "INCOME")
        .reduce((sum, t) => sum + Number(t.amountBase), 0);

      const expenses = transactions
        .filter((t) => t.type === "EXPENSE")
        .reduce((sum, t) => sum + Number(t.amountBase), 0);

      const balance = income - expenses;

      return {
        ...account,
        balance,
      };
    })
  );

  // Get recent activity (last 20 transactions)
  const recentTransactions = await db.transaction.findMany({
    where: {
      organizationId: org.id,
      deletedAt: null,
    },
    include: {
      category: true,
      account: true,
    },
    orderBy: { date: "desc" },
    take: 20,
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{org.name} Dashboard</h1>
        <p className="text-muted-foreground">
          Overview (YTD in {settings.baseCurrency})
        </p>
      </div>

      {/* YTD Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">YTD Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(
                ytdIncome,
                settings.baseCurrency,
                settings.decimalSeparator,
                settings.thousandsSeparator
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              From {formatDate(startDate, settings.dateFormat)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">YTD Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(
                ytdExpenses,
                settings.baseCurrency,
                settings.decimalSeparator,
                settings.thousandsSeparator
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              From {formatDate(startDate, settings.dateFormat)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              YTD Profit/Loss
            </CardTitle>
            <Wallet className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                ytdProfitLoss >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(
                ytdProfitLoss,
                settings.baseCurrency,
                settings.decimalSeparator,
                settings.thousandsSeparator
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {ytdProfitLoss >= 0 ? "Profit" : "Loss"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Account Balances */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Accounts</CardTitle>
            <CardDescription>Current balances</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/o/${orgSlug}/settings/accounts`}>
              Manage accounts
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {accountBalances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No accounts yet.{" "}
              <Link
                href={`/o/${orgSlug}/settings/accounts`}
                className="underline"
              >
                Create your first account
              </Link>
            </p>
          ) : (
            <div className="space-y-2">
              {accountBalances.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
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
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-semibold ${
                        account.balance >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatCurrency(
                        account.balance,
                        settings.baseCurrency,
                        settings.decimalSeparator,
                        settings.thousandsSeparator
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Last 20 transactions</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/o/${orgSlug}/transactions`}>
              View all transactions
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No transactions yet.{" "}
              <Link
                href={`/o/${orgSlug}/transactions`}
                className="underline"
              >
                Create your first transaction
              </Link>
            </p>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
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
                    <div className="text-sm text-muted-foreground">
                      {formatDate(transaction.date, settings.dateFormat)} •{" "}
                      {transaction.category.name} • {transaction.account.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-semibold ${
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
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="mt-1"
                    >
                      <Link
                        href={`/o/${orgSlug}/transactions/${transaction.id}`}
                      >
                        Edit
                      </Link>
                    </Button>
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
