"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { CategoryBreakdownItem, DashboardFilters } from "@/lib/dashboard-types";
import type { DecimalSeparator, ThousandsSeparator } from "@prisma/client";
import { formatCurrency } from "@/lib/sololedger-formatters";

interface CategoryBreakdownChartWidgetProps {
  data: CategoryBreakdownItem[];
  filters: DashboardFilters;
  orgSlug: string;
  baseCurrency: string;
  decimalSeparator: DecimalSeparator;
  thousandsSeparator: ThousandsSeparator;
  defaultTopN?: number;
  currentPeriod: { from: string; to: string }; // Actual date bounds for drill-down
}

/**
 * Get color for category bar
 */
function getCategoryColor(item: CategoryBreakdownItem): string {
  // Use category color if available
  if (item.color) return item.color;

  // Default colors based on type
  if (item.type === "INCOME") return "#16a34a"; // green
  if (item.type === "EXPENSE") return "#dc2626"; // red

  // Fallback
  return "#6b7280"; // gray
}

export function CategoryBreakdownChartWidget({
  data,
  filters,
  orgSlug,
  baseCurrency,
  decimalSeparator,
  thousandsSeparator,
  defaultTopN = 10,
  currentPeriod,
}: CategoryBreakdownChartWidgetProps) {
  const router = useRouter();
  const [topN, setTopN] = React.useState(defaultTopN);
  const [localView, setLocalView] = React.useState<"income" | "expense" | "both">(
    filters.view || "both"
  );

  // Filter data by local view
  const filteredData = React.useMemo(() => {
    if (localView === "both") return data;
    return data.filter((item) => item.type === localView.toUpperCase());
  }, [data, localView]);

  // Take top N items
  const chartData = React.useMemo(() => {
    return filteredData.slice(0, topN).map((item) => ({
      name: item.name,
      amount: item.amountBase,
      count: item.transactionCount,
      categoryId: item.categoryId,
      type: item.type,
      color: getCategoryColor(item),
    }));
  }, [filteredData, topN]);

  // Handle click on bar (drill-down to transactions)
  const handleBarClick = (data: { categoryId: string }) => {
    // Don't allow drill-down on "Other" buckets
    if (
      !data ||
      data.categoryId === "other" ||
      data.categoryId === "other-income" ||
      data.categoryId === "other-expense"
    )
      return;

    // Build query params preserving current filters and adding category
    const params = new URLSearchParams();

    // Always add date range as from/to (using actual computed period)
    params.set("from", currentPeriod.from);
    params.set("to", currentPeriod.to);

    // Add category
    params.set("categoryIds", data.categoryId);

    // Add type if filtering by view
    if (localView !== "both") {
      params.set("type", localView.toUpperCase());
    }

    // Add origin currency
    if (filters.originCurrency !== "all") {
      if (filters.originCurrency === "base") {
        params.set("currency", baseCurrency);
      } else {
        params.set("currency", filters.originCurrency);
      }
    }

    router.push(`/o/${orgSlug}/transactions?${params.toString()}`);
  };

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{
      payload: { name: string; amount: number; count: number; categoryId: string };
    }>;
  }) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="font-medium mb-2">{data.name}</p>
        <p className="text-sm">
          Amount: {formatCurrency(data.amount, baseCurrency, decimalSeparator, thousandsSeparator)}
        </p>
        <p className="text-sm text-muted-foreground">
          {data.count} transaction{data.count !== 1 ? "s" : ""}
        </p>
        {data.categoryId !== "other" &&
          data.categoryId !== "other-income" &&
          data.categoryId !== "other-expense" && (
            <p className="text-xs text-muted-foreground mt-2">Click to view transactions</p>
          )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>Totals by category (base currency)</CardDescription>
          </div>
          <div className="flex items-center gap-4">
            {/* View Selector */}
            <div className="flex items-center gap-2">
              <Label htmlFor="breakdown-view" className="text-sm">View:</Label>
              <Select
                value={localView}
                onValueChange={(v) => setLocalView(v as "income" | "expense" | "both")}
              >
                <SelectTrigger id="breakdown-view" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Top N Selector */}
            <div className="flex items-center gap-2">
              <Label htmlFor="top-n" className="text-sm">Top:</Label>
              <Select value={String(topN)} onValueChange={(v) => setTopN(parseInt(v, 10))}>
                <SelectTrigger id="top-n" className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No category data available for the selected period
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="amount" onClick={handleBarClick} radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    cursor={
                      entry.categoryId !== "other" &&
                      entry.categoryId !== "other-income" &&
                      entry.categoryId !== "other-expense"
                        ? "pointer"
                        : "default"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
