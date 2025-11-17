"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DashboardMonthlyPoint, DashboardFilters } from "@/lib/dashboard-types";
import type { DecimalSeparator, ThousandsSeparator } from "@prisma/client";
import { formatCurrency } from "@/lib/sololedger-formatters";

interface IncomeExpenseChartWidgetProps {
  data: DashboardMonthlyPoint[];
  filters: DashboardFilters;
  orgSlug: string;
  baseCurrency: string;
  decimalSeparator: DecimalSeparator;
  thousandsSeparator: ThousandsSeparator;
}

/**
 * Format month label (YYYY-MM to "Mon YYYY")
 */
function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIndex = parseInt(month, 10) - 1;
  return `${monthNames[monthIndex]} ${year}`;
}

/**
 * Get last day of month for drill-down
 */
function getLastDayOfMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  return `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
}

export function IncomeExpenseChartWidget({
  data,
  filters,
  orgSlug,
  baseCurrency,
  decimalSeparator,
  thousandsSeparator,
}: IncomeExpenseChartWidgetProps) {
  const router = useRouter();
  const [showIncome, setShowIncome] = React.useState(true);
  const [showExpenses, setShowExpenses] = React.useState(true);

  // Format data for Recharts
  const chartData = React.useMemo(() => {
    return data.map((point) => ({
      month: formatMonthLabel(point.month),
      monthKey: point.month,
      Income: showIncome ? point.income : null,
      Expenses: showExpenses ? point.expenses : null,
    }));
  }, [data, showIncome, showExpenses]);

  // Handle click on chart point (drill-down to transactions)
  const handleChartClick = (data: { activePayload?: Array<{ payload: { monthKey: string } }> }) => {
    if (!data || !data.activePayload || !data.activePayload[0]) return;

    const point = data.activePayload[0].payload;
    const monthKey = point.monthKey; // YYYY-MM

    // Compute from/to dates for the month
    const from = `${monthKey}-01`;
    const to = getLastDayOfMonth(monthKey);

    // Build query params preserving current filters
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    if (filters.view !== "both") params.set("type", filters.view.toUpperCase());
    if (filters.originCurrency !== "all") {
      if (filters.originCurrency === "base") {
        params.set("currency", baseCurrency);
      } else {
        params.set("currency", filters.originCurrency);
      }
    }
    if (filters.categoryIds.length > 0) {
      params.set("categoryIds", filters.categoryIds.join(","));
    }

    router.push(`/o/${orgSlug}/transactions?${params.toString()}`);
  };

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: { month: string; Income?: number; Expenses?: number } }>;
  }) => {
    if (!active || !payload || !payload.length) return null;

    const point = payload[0].payload;

    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="font-medium mb-2">{point.month}</p>
        {showIncome && (
          <p className="text-sm text-green-600">
            Income: {formatCurrency(point.Income || 0, baseCurrency, decimalSeparator, thousandsSeparator)}
          </p>
        )}
        {showExpenses && (
          <p className="text-sm text-red-600">
            Expenses: {formatCurrency(point.Expenses || 0, baseCurrency, decimalSeparator, thousandsSeparator)}
          </p>
        )}
        <p className="text-sm text-muted-foreground mt-1">
          Profit/Loss: {formatCurrency((point.Income || 0) - (point.Expenses || 0), baseCurrency, decimalSeparator, thousandsSeparator)}
        </p>
        <p className="text-xs text-muted-foreground mt-2">Click to view transactions</p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Income vs Expense (By Month)</CardTitle>
            <CardDescription>Monthly totals in base currency</CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-income"
                checked={showIncome}
                onCheckedChange={(checked) => setShowIncome(!!checked)}
              />
              <Label htmlFor="show-income" className="text-sm font-normal cursor-pointer">
                <span className="inline-block w-3 h-3 bg-green-600 mr-1 rounded" />
                Income
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-expenses"
                checked={showExpenses}
                onCheckedChange={(checked) => setShowExpenses(!!checked)}
              />
              <Label htmlFor="show-expenses" className="text-sm font-normal cursor-pointer">
                <span className="inline-block w-3 h-3 bg-red-600 mr-1 rounded" />
                Expenses
              </Label>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No data available for the selected period
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} onClick={handleChartClick}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {showIncome && <Bar dataKey="Income" fill="#16a34a" radius={[4, 4, 0, 0]} />}
              {showExpenses && <Bar dataKey="Expenses" fill="#dc2626" radius={[4, 4, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
