"use client";

/**
 * P&L Report Tab Component
 * Client-side component for displaying Profit & Loss statement
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDateRange } from "@/lib/sololedger-formatters";
import type { DateFormat, DecimalSeparator, ThousandsSeparator } from "@prisma/client";
import type { PnLResult, PnLDateMode, PnLDetailLevel, PnLCategoryRow } from "@/lib/reporting-types";

interface PnLReportProps {
  orgSlug: string;
  baseCurrency: string;
  dateFormat: DateFormat;
  fiscalYearStartMonth: number;
  isAdmin: boolean;
}

export function PnLReport({
  orgSlug,
  dateFormat,
  isAdmin,
}: PnLReportProps) {
  const router = useRouter();

  // State
  const [dateMode, setDateMode] = useState<PnLDateMode>("fiscalYear");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [detailLevel, setDetailLevel] = useState<PnLDetailLevel>("summary");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PnLResult & {
    baseCurrency: string;
    dateFormat: DateFormat;
    decimalSeparator: DecimalSeparator;
    thousandsSeparator: ThousandsSeparator;
  } | null>(null);

  // Fetch P&L data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dateMode,
        detailLevel,
      });

      if (dateMode === "custom") {
        if (!customFrom || !customTo) {
          toast.error("Please select both from and to dates for custom range");
          setLoading(false);
          return;
        }
        params.append("customFrom", customFrom);
        params.append("customTo", customTo);
      }

      const response = await fetch(
        `/api/orgs/${orgSlug}/reports/pnl?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch P&L data");
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching P&L:", error);
      toast.error("Failed to load P&L report");
    } finally {
      setLoading(false);
    }
  }, [dateMode, detailLevel, customFrom, customTo, orgSlug]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Format currency helper
  const formatAmount = (amount: number) => {
    if (!data) return "";
    return formatCurrency(
      amount,
      data.baseCurrency,
      data.decimalSeparator,
      data.thousandsSeparator,
      2
    );
  };

  // Drill-down to transactions
  const handleViewTransactions = (categoryId: string, type: "INCOME" | "EXPENSE") => {
    if (!data) return;

    const params = new URLSearchParams({
      type,
      status: "POSTED",
      categoryIds: categoryId,
      dateFrom: data.currentPeriod.from.toISOString().split("T")[0],
      dateTo: data.currentPeriod.to.toISOString().split("T")[0],
    });

    router.push(`/o/${orgSlug}/transactions?${params.toString()}`);
  };

  // Calculate percentage change indicator
  const PercentageChange = ({ value }: { value: number | null }) => {
    if (value === null) return <span className="text-muted-foreground text-sm">N/A</span>;
    const isPositive = value >= 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    return (
      <div className={`flex items-center gap-1 text-sm ${isPositive ? "text-green-600" : "text-red-600"}`}>
        <Icon className="h-3 w-3" />
        <span>{value.toFixed(1)}%</span>
      </div>
    );
  };

  // Render category table
  const CategoryTable = ({ rows, title }: { rows: PnLCategoryRow[]; title: string }) => {
    if (rows.length === 0) {
      return (
        <div className="text-muted-foreground text-center py-8">
          No {title.toLowerCase()} categories found for this period.
        </div>
      );
    }

    const total = rows.reduce((sum, row) => sum + row.totalBase, 0);
    const type = title === "Income" ? "INCOME" : "EXPENSE";

    return (
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="border rounded-md">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Category</th>
                <th className="text-right p-3 font-medium">Amount ({data?.baseCurrency})</th>
                <th className="text-center p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <>
                  <tr key={row.categoryId} className="border-t">
                    <td className="p-3 font-medium">{row.name}</td>
                    <td className="p-3 text-right">{formatAmount(row.totalBase)}</td>
                    <td className="p-3 text-center">
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => handleViewTransactions(row.categoryId, type)}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View transactions
                      </Button>
                    </td>
                  </tr>
                  {detailLevel === "detailed" && row.children && row.children.length > 0 && (
                    <>
                      {row.children.map((child) => (
                        <tr key={child.categoryId} className="border-t bg-muted/20">
                          <td className="p-3 pl-8 text-muted-foreground">{child.name}</td>
                          <td className="p-3 text-right text-muted-foreground">
                            {formatAmount(child.totalBase)}
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => handleViewTransactions(child.categoryId, type)}
                              className="text-muted-foreground"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </>
              ))}
              <tr className="border-t-2 font-bold bg-muted">
                <td className="p-3">Total {title}</td>
                <td className="p-3 text-right" colSpan={2}>{formatAmount(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Mode */}
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateMode} onValueChange={(value) => setDateMode(value as PnLDateMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fiscalYear">Full fiscal year</SelectItem>
                  <SelectItem value="ytd">Year-to-date</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range */}
            {dateMode === "custom" && (
              <>
                <div className="space-y-2">
                  <Label>From</Label>
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Detail Level */}
            <div className="space-y-2">
              <Label>Detail Level</Label>
              <RadioGroup value={detailLevel} onValueChange={(value) => setDetailLevel(value as PnLDetailLevel)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="summary" id="summary" />
                  <Label htmlFor="summary" className="font-normal cursor-pointer">Summary</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="detailed" id="detailed" />
                  <Label htmlFor="detailed" className="font-normal cursor-pointer">Detailed</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={fetchData} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Refresh
            </Button>
            {isAdmin && data && (
              <Button variant="outline" disabled>
                Export to PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && !data && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Report Content */}
      {data && !loading && (
        <>
          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Profit & Loss Statement</h2>
            <p className="text-muted-foreground">
              Period: {formatDateRange(data.currentPeriod.from, data.currentPeriod.to, dateFormat)} (Base: {data.baseCurrency})
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Income
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatAmount(data.comparison.current.income)}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-muted-foreground">
                    vs. prev: {formatAmount(data.comparison.previous.income)}
                  </span>
                  <PercentageChange value={data.comparison.deltaPct.income} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatAmount(data.comparison.current.expenses)}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-muted-foreground">
                    vs. prev: {formatAmount(data.comparison.previous.expenses)}
                  </span>
                  <PercentageChange value={data.comparison.deltaPct.expenses} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Profit / Loss
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.comparison.current.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatAmount(data.comparison.current.net)}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-muted-foreground">
                    vs. prev: {formatAmount(data.comparison.previous.net)}
                  </span>
                  <PercentageChange value={data.comparison.deltaPct.net} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tables */}
          <div className="space-y-6">
            <CategoryTable rows={data.incomeRows} title="Income" />
            <CategoryTable rows={data.expenseRows} title="Expenses" />
          </div>
        </>
      )}
    </div>
  );
}
