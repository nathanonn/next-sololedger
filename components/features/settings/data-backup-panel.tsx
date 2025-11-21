"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DataBackupPanelProps {
  orgSlug: string;
  isAdmin: boolean;
}

export function DataBackupPanel({
  orgSlug,
  isAdmin,
}: DataBackupPanelProps): React.JSX.Element {
  const [isExporting, setIsExporting] = React.useState(false);
  const [format, setFormat] = React.useState<"json" | "csv">("json");
  const [includeDocumentReferences, setIncludeDocumentReferences] = React.useState(false);
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  async function handleExport() {
    setIsExporting(true);
    try {
      const requestBody: {
        format: "json" | "csv";
        includeDocumentReferences: boolean;
        dateFrom?: string;
        dateTo?: string;
      } = {
        format,
        includeDocumentReferences,
      };

      if (dateFrom) {
        requestBody.dateFrom = dateFrom;
      }
      if (dateTo) {
        requestBody.dateTo = dateTo;
      }

      const response = await fetch(`/api/orgs/${orgSlug}/backup/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Export failed");
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `sololedger-backup-${orgSlug}-${new Date().toISOString().split("T")[0]}.${format === "json" ? "json" : "zip"}`;

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) {
          filename = match[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Backup exported successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Export & Backup</CardTitle>
          <CardDescription>
            Download a complete snapshot of your organization data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Only organization administrators can export backups. Please contact
              an administrator if you need access to organization data.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Export & Backup</CardTitle>
        <CardDescription>
          Download a complete snapshot of your organization data for backup or
          sharing with your accountant
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Format Selection */}
        <div className="space-y-3">
          <Label>Export Format</Label>
          <RadioGroup value={format} onValueChange={(v) => setFormat(v as "json" | "csv")}>
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="json" id="json" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="json" className="font-medium cursor-pointer">
                  JSON (single file)
                </Label>
                <p className="text-sm text-muted-foreground">
                  All data in a single JSON file. Best for complete backups and
                  programmatic access.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="csv" id="csv" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="csv" className="font-medium cursor-pointer">
                  CSV (ZIP with multiple files)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Separate CSV files for each entity (transactions, categories,
                  etc.) bundled in a ZIP. Best for spreadsheet analysis.
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Include Options */}
        <div className="space-y-3">
          <Label>Include</Label>
          <div className="space-y-3 pl-1">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="transactions"
                checked={true}
                disabled={true}
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="transactions" className="font-normal cursor-not-allowed opacity-70">
                  Transactions (all posted & draft, within date range)
                </Label>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="master-data"
                checked={true}
                disabled={true}
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="master-data" className="font-normal cursor-not-allowed opacity-70">
                  Categories, Vendors, Clients, Accounts, Tags
                </Label>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="documents"
                checked={includeDocumentReferences}
                onCheckedChange={(checked) =>
                  setIncludeDocumentReferences(checked === true)
                }
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="documents" className="font-medium cursor-pointer">
                  Document references (metadata & links)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Includes document metadata and transaction links. Does not include
                  actual file contents.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Date Range */}
        <div className="space-y-3">
          <Label>Date Range (for transactions)</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom" className="text-sm font-normal">
                From
              </Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo" className="text-sm font-normal">
                To
              </Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Leave blank to export all transactions. Master data (categories, vendors,
            clients, etc.) is always exported in full.
          </p>
        </div>

        {/* Info */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Important:</strong> Exports are read-only snapshots. Importing
            data back into Sololedger is not currently supported. Use exports for
            backup, analysis, or sharing with your accountant.
          </AlertDescription>
        </Alert>

        {/* Export Button */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleExport} disabled={isExporting} size="lg">
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download Backup
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
