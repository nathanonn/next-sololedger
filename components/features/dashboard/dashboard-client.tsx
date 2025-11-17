"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, Minus, Wallet, Settings2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type {
  DashboardSummary,
  DashboardMonthlyPoint,
  CategoryBreakdownItem,
  DashboardFilters,
  RecentActivityTransaction,
} from "@/lib/dashboard-types";
import type { DateFormat, DecimalSeparator, ThousandsSeparator } from "@prisma/client";
import { DashboardFiltersBar } from "./dashboard-filters-bar";
import { IncomeExpenseChartWidget } from "./income-expense-chart-widget";
import { CategoryBreakdownChartWidget } from "./category-breakdown-chart-widget";
import { AccountsOverviewWidget } from "./accounts-overview-widget";
import { formatCurrency, formatDate } from "@/lib/sololedger-formatters";
import { getDefaultDashboardLayout, mergeDashboardLayout } from "./dashboard-config";
import type { DashboardLayout, DashboardLayoutItem } from "@/lib/dashboard-types";

interface DashboardClientProps {
  orgSlug: string;
  orgName: string;
  settings: {
    baseCurrency: string;
    fiscalYearStartMonth: number;
    dateFormat: DateFormat;
    decimalSeparator: DecimalSeparator;
    thousandsSeparator: ThousandsSeparator;
  };
  summary: DashboardSummary;
  monthlyTrends: DashboardMonthlyPoint[];
  categoryBreakdown: CategoryBreakdownItem[];
  categories: Array<{ id: string; name: string; type: "INCOME" | "EXPENSE" }>;
  recentTransactions: RecentActivityTransaction[];
  availableOriginCurrencies: string[];
  initialFilters: DashboardFilters;
  userLayout: DashboardLayout | null;
}

export function DashboardClient({
  orgSlug,
  orgName,
  settings,
  summary,
  monthlyTrends,
  categoryBreakdown,
  categories,
  recentTransactions,
  availableOriginCurrencies,
  initialFilters,
  userLayout,
}: DashboardClientProps) {
  const [filters, setFilters] = React.useState<DashboardFilters>(initialFilters);
  const [customizeMode, setCustomizeMode] = React.useState(false);
  const [layout, setLayout] = React.useState(() => mergeDashboardLayout(userLayout));
  const [isSavingLayout, setIsSavingLayout] = React.useState(false);

  // Handle filter changes
  const handleFiltersChange = React.useCallback((newFilters: DashboardFilters) => {
    setFilters(newFilters);
    // Page will reload via URL change in DashboardFiltersBar
  }, []);

  // Save layout
  const handleSaveLayout = React.useCallback(async () => {
    setIsSavingLayout(true);
    try {
      const response = await fetch(`/api/orgs/${orgSlug}/dashboard/layout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to save layout");
        return;
      }

      toast.success("Dashboard layout saved");
      setCustomizeMode(false);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSavingLayout(false);
    }
  }, [orgSlug, layout]);

  // Reset layout
  const handleResetLayout = React.useCallback(async () => {
    setIsSavingLayout(true);
    try {
      const response = await fetch(`/api/orgs/${orgSlug}/dashboard/layout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: null }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to reset layout");
        return;
      }

      const defaultLayout = getDefaultDashboardLayout();
      setLayout(defaultLayout);
      toast.success("Dashboard layout reset to default");
      setCustomizeMode(false);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSavingLayout(false);
    }
  }, [orgSlug]);

  // Toggle widget visibility
  const toggleWidgetVisibility = (widgetId: string) => {
    setLayout((prev: DashboardLayout) =>
      prev.map((item: DashboardLayoutItem) =>
        item.widgetId === widgetId ? { ...item, visible: !item.visible } : item
      )
    );
  };

  // Get visible widgets sorted by order
  const visibleWidgets = React.useMemo(() => {
    return layout
      .filter((item: DashboardLayoutItem) => item.visible)
      .sort((a: DashboardLayoutItem, b: DashboardLayoutItem) => a.order - b.order);
  }, [layout]);

  // Render trend indicator
  const renderTrend = (deltaPct: number | null, isExpense: boolean = false) => {
    if (deltaPct === null || deltaPct === 0) {
      return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Minus className="h-3 w-3" />
          <span>No change</span>
        </div>
      );
    }

    const isPositive = deltaPct > 0;
    // For expenses, positive delta is bad (red), negative delta is good (green)
    // For income/profit, positive delta is good (green), negative delta is bad (red)
    const isGood = isExpense ? !isPositive : isPositive;

    return (
      <div
        className={`flex items-center gap-1 text-xs ${
          isGood ? "text-green-600" : "text-red-600"
        }`}
      >
        {isPositive ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        <span>
          {isPositive ? "+" : ""}
          {deltaPct.toFixed(1)}% vs prev period
        </span>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{orgName} Dashboard</h1>
          <p className="text-muted-foreground">
            Analytics & Insights ({settings.baseCurrency})
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/o/${orgSlug}/transactions`}>View Transactions</Link>
          </Button>
          <Button
            variant={customizeMode ? "default" : "outline"}
            onClick={() => setCustomizeMode(!customizeMode)}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            {customizeMode ? "Exit Customize" : "Customize"}
          </Button>
        </div>
      </div>

      {/* Customize Mode Banner */}
      {customizeMode && (
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                Customize your dashboard by showing or hiding widgets. Changes are saved per user.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleResetLayout} disabled={isSavingLayout}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Default
                </Button>
                <Button onClick={handleSaveLayout} disabled={isSavingLayout}>
                  {isSavingLayout ? "Saving..." : "Save Layout"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard Filters */}
      <DashboardFiltersBar
        orgSlug={orgSlug}
        categories={categories}
        availableOriginCurrencies={availableOriginCurrencies}
        onFiltersChange={handleFiltersChange}
      />

      {/* Financial Summary Cards (Always Visible) */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Income Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(
                summary.income,
                settings.baseCurrency,
                settings.decimalSeparator,
                settings.thousandsSeparator
              )}
            </div>
            {renderTrend(summary.incomeDeltaPct, false)}
            <p className="text-xs text-muted-foreground mt-1">
              From {summary.currentPeriod.from} to {summary.currentPeriod.to}
            </p>
          </CardContent>
        </Card>

        {/* Expenses Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(
                summary.expenses,
                settings.baseCurrency,
                settings.decimalSeparator,
                settings.thousandsSeparator
              )}
            </div>
            {renderTrend(summary.expensesDeltaPct, true)}
            <p className="text-xs text-muted-foreground mt-1">
              From {summary.currentPeriod.from} to {summary.currentPeriod.to}
            </p>
          </CardContent>
        </Card>

        {/* Profit/Loss Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit/Loss</CardTitle>
            <Wallet className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                summary.profitLoss >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(
                summary.profitLoss,
                settings.baseCurrency,
                settings.decimalSeparator,
                settings.thousandsSeparator
              )}
            </div>
            {renderTrend(summary.profitLossDeltaPct, false)}
            <p className="text-xs text-muted-foreground mt-1">
              {summary.profitLoss >= 0 ? "Profit" : "Loss"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Widgets Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {visibleWidgets.map((widgetItem: DashboardLayoutItem) => {
          const widgetId = widgetItem.widgetId;

          return (
            <div key={widgetId} className="relative">
              {/* Widget Visibility Toggle (in customize mode) */}
              {customizeMode && (
                <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-background border rounded-lg px-3 py-2">
                  <Switch
                    id={`visible-${widgetId}`}
                    checked={widgetItem.visible}
                    onCheckedChange={() => toggleWidgetVisibility(widgetId)}
                  />
                  <Label htmlFor={`visible-${widgetId}`} className="text-sm cursor-pointer">
                    Visible
                  </Label>
                </div>
              )}

              {/* Render Widget */}
              {widgetId === "income-expense-chart" && (
                <IncomeExpenseChartWidget
                  data={monthlyTrends}
                  filters={filters}
                  orgSlug={orgSlug}
                  baseCurrency={settings.baseCurrency}
                  decimalSeparator={settings.decimalSeparator}
                  thousandsSeparator={settings.thousandsSeparator}
                />
              )}

              {widgetId === "category-breakdown" && (
                <CategoryBreakdownChartWidget
                  data={categoryBreakdown}
                  filters={filters}
                  orgSlug={orgSlug}
                  baseCurrency={settings.baseCurrency}
                  decimalSeparator={settings.decimalSeparator}
                  thousandsSeparator={settings.thousandsSeparator}
                />
              )}

              {widgetId === "accounts-overview" && (
                <AccountsOverviewWidget
                  orgSlug={orgSlug}
                  baseCurrency={settings.baseCurrency}
                  dateRange="ytd"
                  fromDate={summary.currentPeriod.from}
                  toDate={summary.currentPeriod.to}
                />
              )}

              {widgetId === "recent-activity" && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Recent Activity</CardTitle>
                      <CardDescription>Last 20 transactions</CardDescription>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/o/${orgSlug}/transactions`}>View all</Link>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {recentTransactions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No transactions yet.{" "}
                        <Link href={`/o/${orgSlug}/transactions`} className="underline">
                          Create your first transaction
                        </Link>
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {recentTransactions.map((transaction) => (
                          <div
                            key={transaction.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{transaction.description}</span>
                                <Badge
                                  variant={transaction.type === "INCOME" ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {transaction.type}
                                </Badge>
                                <Badge
                                  variant={transaction.status === "POSTED" ? "default" : "outline"}
                                  className="text-xs"
                                >
                                  {transaction.status}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatDate(new Date(transaction.date), settings.dateFormat)} •{" "}
                                {transaction.category.name} • {transaction.account.name}
                              </div>
                            </div>
                            <div className="text-right">
                              <div
                                className={`font-semibold ${
                                  transaction.type === "INCOME" ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                {transaction.type === "INCOME" ? "+" : "-"}
                                {formatCurrency(
                                  transaction.amountBase,
                                  settings.baseCurrency,
                                  settings.decimalSeparator,
                                  settings.thousandsSeparator
                                )}
                              </div>
                              <Button asChild variant="ghost" size="sm" className="mt-1">
                                <Link href={`/o/${orgSlug}/transactions/${transaction.id}`}>
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
