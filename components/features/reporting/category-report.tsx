"use client";

/**
 * Category Report Tab Component
 * Client-side component for displaying category breakdown with transaction counts
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDateRange } from "@/lib/sololedger-formatters";
import type { DateFormat, DecimalSeparator, ThousandsSeparator } from "@prisma/client";
import type { CategoryReportRow } from "@/lib/reporting-types";

interface CategoryReportProps {
  orgSlug: string;
  baseCurrency: string;
  dateFormat: DateFormat;
  fiscalYearStartMonth: number;
  isAdmin: boolean;
}

interface CategoryReportData {
  items: CategoryReportRow[];
  baseCurrency: string;
  dateFormat: DateFormat;
  decimalSeparator: DecimalSeparator;
  thousandsSeparator: ThousandsSeparator;
  period: {
    from: string;
    to: string;
  };
}

export function CategoryReport({
  orgSlug,
  dateFormat,
  isAdmin,
}: CategoryReportProps) {
  const router = useRouter();

  // State
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [typeFilter, setTypeFilter] = useState<"both" | "income" | "expense">("both");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CategoryReportData | null>(null);

  // Fetch Category report data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: typeFilter,
      });

      if (from && to) {
        params.append("from", from);
        params.append("to", to);
      }

      const response = await fetch(
        `/api/orgs/${orgSlug}/reports/categories?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch category report");
      }

      const result = await response.json();
      setData(result);

      // Set dates if not set (from API default)
      if (!from && result.period) {
        setFrom(result.period.from);
        setTo(result.period.to);
      }
    } catch (error) {
      console.error("Error fetching category report:", error);
      toast.error("Failed to load category report");
    } finally {
      setLoading(false);
    }
  }, [from, to, typeFilter, orgSlug]);

  // Fetch on mount
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
      dateFrom: data.period.from,
      dateTo: data.period.to,
    });

    router.push(`/o/${orgSlug}/transactions?${params.toString()}`);
  };

  // Get badge color for type
  const getTypeBadgeColor = (type: "INCOME" | "EXPENSE") => {
    return type === "INCOME"
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Category Report</h2>
        <p className="text-muted-foreground">
          Totals by category and subcategory for a selected date range.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>From</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as typeof typeFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">All</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={fetchData} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply
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
          {/* Period Info */}
          {data.period && (
            <div className="text-sm text-muted-foreground">
              Period: {formatDateRange(new Date(data.period.from), new Date(data.period.to), dateFormat)}
            </div>
          )}

          {/* Table */}
          <Card>
            <CardContent className="pt-6">
              {data.items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No transactions found for this range.
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Category</th>
                        <th className="text-center p-3 font-medium">Type</th>
                        <th className="text-right p-3 font-medium">Transactions</th>
                        <th className="text-right p-3 font-medium">Total ({data.baseCurrency})</th>
                        <th className="text-center p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item) => (
                        <tr key={item.categoryId} className={`border-t ${item.level === 1 ? "bg-muted/20" : ""}`}>
                          <td className={`p-3 ${item.level === 1 ? "pl-8 text-muted-foreground" : "font-medium"}`}>
                            {item.name}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-1 text-xs rounded-full ${getTypeBadgeColor(item.type)}`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="p-3 text-right">{item.transactionCount}</td>
                          <td className="p-3 text-right">{formatAmount(item.totalBase)}</td>
                          <td className="p-3 text-center">
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => handleViewTransactions(item.categoryId, item.type)}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View transactions
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
