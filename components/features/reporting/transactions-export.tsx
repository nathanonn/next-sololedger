"use client";

/**
 * Transactions CSV Export Tab Component
 * Client-side component for exporting transactions with configurable columns
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Download, Info } from "lucide-react";
import { toast } from "sonner";
import { AVAILABLE_CSV_COLUMNS, type CsvColumn } from "@/lib/export-helpers";
import { TagMultiSelect } from "@/components/features/tags/tag-multi-select";
import { useOrgTags } from "@/hooks/use-org-tags";

interface TransactionsExportProps {
  orgSlug: string;
  isAdmin: boolean;
}

// Column labels for display
const COLUMN_LABELS: Record<CsvColumn, string> = {
  id: "ID",
  date: "Date",
  type: "Type",
  status: "Status",
  description: "Description",
  category: "Category",
  account: "Account",
  vendor: "Vendor",
  client: "Client",
  amountBase: "Amount (Base)",
  currencyBase: "Currency (Base)",
  amountSecondary: "Amount (Secondary)",
  currencySecondary: "Currency (Secondary)",
  exchangeRate: "Exchange Rate",
  notes: "Notes",
  tags: "Tags",
  documentIds: "Document IDs",
  documentNames: "Document Names",
};

// Default/core columns
const DEFAULT_COLUMNS: CsvColumn[] = [
  "id",
  "date",
  "type",
  "status",
  "description",
  "category",
  "account",
  "vendor",
  "client",
  "amountBase",
  "currencyBase",
  "notes",
];

export function TransactionsExport({ orgSlug, isAdmin }: TransactionsExportProps) {
  const { tags, isLoading: tagsLoading } = useOrgTags(orgSlug);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [columnMode, setColumnMode] = useState<"all" | "custom">("all");
  const [selectedColumns, setSelectedColumns] = useState<Set<CsvColumn>>(
    new Set(DEFAULT_COLUMNS)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<"any" | "all">("any");

  // Toggle column selection
  const toggleColumn = (column: CsvColumn) => {
    const newSet = new Set(selectedColumns);
    if (newSet.has(column)) {
      newSet.delete(column);
    } else {
      newSet.add(column);
    }
    setSelectedColumns(newSet);
  };

  // Handle export
  const handleExport = async () => {
    // Validate dates
    if (!from || !to) {
      toast.error("Please select both from and to dates");
      return;
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (fromDate > toDate) {
      toast.error("From date must be before or equal to to date");
      return;
    }

    // Determine columns to export
    const columnsToExport =
      columnMode === "all"
        ? [...AVAILABLE_CSV_COLUMNS]
        : Array.from(selectedColumns);

    if (columnsToExport.length === 0) {
      toast.error("Please select at least one column");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/transactions/export-range`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to,
            status: "POSTED", // Only posted transactions
            columns: columnsToExport,
            tagIds: selectedTagIds,
            tagMode,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Export failed");
      }

      // Get CSV content
      const csv = await response.text();

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch
        ? filenameMatch[1]
        : `transactions-${from}-to-${to}.csv`;

      // Trigger download
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("CSV exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to export CSV"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Transactions CSV Export</h2>
        <p className="text-muted-foreground">
          Export raw transaction data for analysis in spreadsheets.
        </p>
      </div>

      {/* Access Control Notice */}
      {!isAdmin && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Only organization admins can export transactions to CSV.
          </AlertDescription>
        </Alert>
      )}

      {/* Export Form */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Export Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date Range */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Date Range</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>
              <p className="text-sm text-muted-foreground">
                Only POSTED transactions will be exported. Maximum date range: 5
                years.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Tags</h3>
              <TagMultiSelect
                tags={tags}
                selectedTagIds={selectedTagIds}
                onChange={setSelectedTagIds}
                tagMode={tagMode}
                onModeChange={setTagMode}
                disabled={isSubmitting || tagsLoading}
              />
            </div>

            {/* Column Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Columns</h3>
              <RadioGroup
                value={columnMode}
                onValueChange={(value) => setColumnMode(value as typeof columnMode)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all-fields" />
                  <Label htmlFor="all-fields" className="font-normal cursor-pointer">
                    All fields
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="custom-fields" />
                  <Label
                    htmlFor="custom-fields"
                    className="font-normal cursor-pointer"
                  >
                    Custom selection
                  </Label>
                </div>
              </RadioGroup>

              {/* Custom Column Selection */}
              {columnMode === "custom" && (
                <div className="border rounded-md p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {AVAILABLE_CSV_COLUMNS.map((column) => (
                      <div key={column} className="flex items-center space-x-2">
                        <Checkbox
                          id={column}
                          checked={selectedColumns.has(column)}
                          onCheckedChange={() => toggleColumn(column)}
                        />
                        <Label
                          htmlFor={column}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {COLUMN_LABELS[column]}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Selected {selectedColumns.size} of {AVAILABLE_CSV_COLUMNS.length}{" "}
                    columns
                  </p>
                </div>
              )}
            </div>

            {/* Export Button */}
            <Button
              onClick={handleExport}
              disabled={isSubmitting || !from || !to}
              className="w-full md:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
