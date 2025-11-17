"use client";

/**
 * Vendor Report Tab Component
 * Client-side component for displaying vendor totals
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
import type { VendorReportRow } from "@/lib/reporting-types";

interface VendorReportProps {
  orgSlug: string;
  baseCurrency: string;
  dateFormat: DateFormat;
  fiscalYearStartMonth: number;
  isAdmin: boolean;
}

interface VendorReportData {
  rows: VendorReportRow[];
  baseCurrency: string;
  dateFormat: DateFormat;
  decimalSeparator: DecimalSeparator;
  thousandsSeparator: ThousandsSeparator;
  period: {
    from: string;
    to: string;
  };
}

export function VendorReport({
  orgSlug,
  dateFormat,
  isAdmin,
}: VendorReportProps) {
  const router = useRouter();

  // State
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [viewFilter, setViewFilter] = useState<"all" | "income" | "expense">("all");
  const [sortBy, setSortBy] = useState<"netDesc" | "name">("netDesc");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<VendorReportData | null>(null);

  // Fetch Vendor report data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        view: viewFilter,
      });

      if (from && to) {
        params.append("from", from);
        params.append("to", to);
      }

      const response = await fetch(
        `/api/orgs/${orgSlug}/reports/vendors?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch vendor report");
      }

      const result = await response.json();
      setData(result);

      // Set dates if not set (from API default)
      if (!from && result.period) {
        setFrom(result.period.from);
        setTo(result.period.to);
      }
    } catch (error) {
      console.error("Error fetching vendor report:", error);
      toast.error("Failed to load vendor report");
    } finally {
      setLoading(false);
    }
  }, [from, to, viewFilter, orgSlug]);

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
  const handleViewTransactions = (vendorId: string | null) => {
    if (!data) return;

    const params = new URLSearchParams({
      status: "POSTED",
      dateFrom: data.period.from,
      dateTo: data.period.to,
    });

    if (vendorId) {
      params.append("vendorId", vendorId);
    }

    router.push(`/o/${orgSlug}/transactions?${params.toString()}`);
  };

  // Sort rows
  const sortedRows = data?.rows ? [...data.rows].sort((a, b) => {
    if (sortBy === "name") {
      return a.vendorName.localeCompare(b.vendorName);
    }
    // Default: netDesc
    return b.netBase - a.netBase;
  }) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Vendor Report</h2>
        <p className="text-muted-foreground">
          Total income, expenses and net per vendor for a period.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <Label>View</Label>
              <Select value={viewFilter} onValueChange={(value) => setViewFilter(value as typeof viewFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sort by</Label>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="netDesc">Net (desc)</SelectItem>
                  <SelectItem value="name">Name (asc)</SelectItem>
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
              {sortedRows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No vendor activity in this period.
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Vendor</th>
                        <th className="text-right p-3 font-medium">Total Income</th>
                        <th className="text-right p-3 font-medium">Total Expenses</th>
                        <th className="text-right p-3 font-medium">Net</th>
                        <th className="text-center p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map((vendor, index) => (
                        <tr key={vendor.vendorId || `name-${index}`} className="border-t">
                          <td className="p-3 font-medium">{vendor.vendorName}</td>
                          <td className="p-3 text-right text-green-600">
                            {vendor.totalIncomeBase > 0 ? formatAmount(vendor.totalIncomeBase) : "-"}
                          </td>
                          <td className="p-3 text-right text-red-600">
                            {vendor.totalExpenseBase > 0 ? formatAmount(vendor.totalExpenseBase) : "-"}
                          </td>
                          <td className={`p-3 text-right font-medium ${vendor.netBase >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {formatAmount(vendor.netBase)}
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => handleViewTransactions(vendor.vendorId)}
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
