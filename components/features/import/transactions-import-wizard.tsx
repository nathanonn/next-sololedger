"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Loader2, CheckCircle2, XCircle, AlertCircle, ChevronLeft, Download } from "lucide-react";
import type { DateFormat, DecimalSeparator, ThousandsSeparator } from "@prisma/client";
import { parse } from "csv-parse/sync";

interface TransactionsImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  onImportCompleted: () => void;
}

type DirectionMode = "type_column" | "sign_based";

type ImportMode = "csv" | "zip_with_documents";

type Step = "upload" | "mapping" | "review";

interface ImportTemplate {
  id: string;
  name: string;
  createdAt: string;
}

interface PreviewRow {
  rowIndex: number;
  raw: string[];
  status: "valid" | "invalid";
  errors: string[];
  normalized?: {
    type: string;
    date: string;
    amountBase: number;
    currencyBase: string;
    description: string;
    vendorName?: string;
    clientName?: string;
  };
  isDuplicateCandidate: boolean;
  duplicateMatches: Array<{
    transactionId: string;
    date: string;
    amount: number;
    currency: string;
    description: string;
    vendorName?: string;
    clientName?: string;
  }>;
}

interface PreviewSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCandidates: number;
}

interface DuplicateCandidate {
  rowIndex: number;
  raw: string[];
  normalized?: {
    type: string;
    date: string;
    amountBase: number;
    currencyBase: string;
    description: string;
  };
  duplicateMatches: Array<{
    transactionId: string;
    date: string;
    amount: number;
    currency: string;
    description: string;
  }>;
}

export function TransactionsImportWizard({
  open,
  onOpenChange,
  orgSlug,
  onImportCompleted,
}: TransactionsImportWizardProps): React.JSX.Element {
  const [step, setStep] = React.useState<Step>("upload");
  const [file, setFile] = React.useState<File | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Upload & Options state - defaults will be loaded from org settings
  const [importMode, setImportMode] = React.useState<ImportMode>("csv");
  const [directionMode, setDirectionMode] = React.useState<DirectionMode>("type_column");
  const [dateFormat, setDateFormat] = React.useState<DateFormat>("YYYY_MM_DD");
  const [decimalSeparator, setDecimalSeparator] = React.useState<DecimalSeparator>("DOT");
  const [thousandsSeparator, setThousandsSeparator] = React.useState<ThousandsSeparator>("COMMA");
  const [delimiter, setDelimiter] = React.useState(",");
  const [templates, setTemplates] = React.useState<ImportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>("none");

  // Mapping state
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [sampleRows, setSampleRows] = React.useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = React.useState<Record<string, string>>({});
  const [templateName, setTemplateName] = React.useState("");
  const [showSaveTemplate, setShowSaveTemplate] = React.useState(false);

  // Preview state
  const [previewRows, setPreviewRows] = React.useState<PreviewRow[]>([]);
  const [summary, setSummary] = React.useState<PreviewSummary | null>(null);
  const [duplicateDecisions, setDuplicateDecisions] = React.useState<Record<number, "import" | "skip">>({});
  const [currentPage, setCurrentPage] = React.useState(0);
  const ROWS_PER_PAGE = 20;

  // Hoisted helper functions (needed in multiple places)
  const loadTemplates = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/orgs/${orgSlug}/transactions/import-templates`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Error loading templates:", error);
    }
  }, [orgSlug]);

  const loadOrgSettings = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/orgs/${orgSlug}/settings/financial`);
      if (response.ok) {
        const data = await response.json();
        // Set defaults from org settings
        if (data.settings) {
          setDateFormat(data.settings.dateFormat);
          setDecimalSeparator(data.settings.decimalSeparator);
          setThousandsSeparator(data.settings.thousandsSeparator);
        }
      }
    } catch (error) {
      console.error("Error loading org settings:", error);
    }
  }, [orgSlug]);

  // Load templates and org settings when dialog opens
  React.useEffect(() => {
    if (!open) return;

    loadTemplates();
    loadOrgSettings();

    // Reset state
    setStep("upload");
    setFile(null);
    setColumnMapping({});
    setPreviewRows([]);
    setSummary(null);
    setDuplicateDecisions({});
    setCurrentPage(0);
  }, [open, orgSlug, loadTemplates, loadOrgSettings]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file based on import mode
      if (importMode === "csv") {
        if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
          toast.error("Please select a CSV file");
          return;
        }
        if (selectedFile.size > 10 * 1024 * 1024) {
          toast.error("CSV file size must be less than 10MB");
          return;
        }
      } else if (importMode === "zip_with_documents") {
        if (!selectedFile.name.toLowerCase().endsWith(".zip")) {
          toast.error("Please select a ZIP file");
          return;
        }
        // No size limit for ZIP files
      }
      setFile(selectedFile);
    }
  }

  async function handleContinueFromUpload() {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    // ZIP mode: Skip client-side parsing, backend will extract CSV from ZIP
    if (importMode === "zip_with_documents") {
      // ZIP import requires a template because we can't parse the ZIP client-side
      if (selectedTemplateId && selectedTemplateId !== "none") {
        await handlePreviewWithTemplate();
        return;
      } else {
        toast.error(
          "ZIP import requires a saved template. Please create a mapping template using a CSV file first, or select an existing template."
        );
        return;
      }
    }

    // CSV mode: If template is selected and has full mapping, go straight to preview
    if (selectedTemplateId && selectedTemplateId !== "none") {
      const template = templates.find((t) => t.id === selectedTemplateId);
      if (template) {
        // Load full template config and proceed to preview
        await handlePreviewWithTemplate();
        return;
      }
    }

    // Otherwise, go to mapping step
    // Parse CSV to get headers using csv-parse (same library as backend)
    setIsLoading(true);
    try {
      const text = await file.text();

      // Use csv-parse to properly handle quoted delimiters and escaped characters
      const records = parse(text, {
        delimiter,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      }) as string[][];

      if (records.length === 0) {
        toast.error("CSV file is empty");
        return;
      }

      const parsedHeaders = records[0];
      setHeaders(parsedHeaders);

      // Get sample rows (first 3 data rows)
      const samples = records.slice(1, 4);
      setSampleRows(samples);

      setStep("mapping");
    } catch (error) {
      toast.error("Failed to parse CSV file");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePreviewWithTemplate() {
    if (!file) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      // When using a template, let the backend load the template's saved parsingOptions
      // Don't override with defaults to preserve template's delimiter/decimal/thousands settings
      const mappingConfig = {
        templateId: selectedTemplateId,
        importMode,
      };

      formData.append("mappingConfig", JSON.stringify(mappingConfig));

      const response = await fetch(`/api/orgs/${orgSlug}/transactions/import/preview`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Preview failed");
      }

      const data = await response.json();
      setHeaders(data.headers);
      setPreviewRows(data.previewRows);
      setSummary(data.summary);

      // Initialize duplicate decisions to "skip" by default
      // Use duplicateCandidates array (includes ALL duplicates, not just first 100)
      const initialDecisions: Record<number, "import" | "skip"> = {};
      const duplicatesToProcess = data.duplicateCandidates || data.previewRows;
      duplicatesToProcess.forEach((row: DuplicateCandidate | PreviewRow) => {
        if ("isDuplicateCandidate" in row && row.isDuplicateCandidate) {
          initialDecisions[row.rowIndex] = "skip";
        } else if ("duplicateMatches" in row && row.duplicateMatches) {
          initialDecisions[row.rowIndex] = "skip";
        }
      });
      setDuplicateDecisions(initialDecisions);

      setStep("review");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preview failed");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePreview() {
    if (!file) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const mappingConfig = {
        importMode,
        columnMapping,
        parsingOptions: {
          directionMode,
          dateFormat,
          delimiter,
          headerRowIndex: 0,
          hasHeaders: true,
          decimalSeparator,
          thousandsSeparator,
        },
      };

      formData.append("mappingConfig", JSON.stringify(mappingConfig));

      const response = await fetch(`/api/orgs/${orgSlug}/transactions/import/preview`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Preview failed");
      }

      const data = await response.json();
      setPreviewRows(data.previewRows);
      setSummary(data.summary);

      // Initialize duplicate decisions to "skip" by default
      // Use duplicateCandidates array (includes ALL duplicates, not just first 100)
      const initialDecisions: Record<number, "import" | "skip"> = {};
      const duplicatesToProcess = data.duplicateCandidates || data.previewRows;
      duplicatesToProcess.forEach((row: DuplicateCandidate | PreviewRow) => {
        if ("isDuplicateCandidate" in row && row.isDuplicateCandidate) {
          initialDecisions[row.rowIndex] = "skip";
        } else if ("duplicateMatches" in row && row.duplicateMatches) {
          initialDecisions[row.rowIndex] = "skip";
        }
      });
      setDuplicateDecisions(initialDecisions);

      setStep("review");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preview failed");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    setIsLoading(true);
    try {
      const config = {
        importMode,
        columnMapping,
        parsingOptions: {
          directionMode,
          dateFormat,
          delimiter,
          headerRowIndex: 0,
          hasHeaders: true,
          decimalSeparator,
          thousandsSeparator,
        },
      };

      const response = await fetch(`/api/orgs/${orgSlug}/transactions/import-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          config,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save template");
      }

      toast.success("Template saved successfully");
      setTemplateName("");
      setShowSaveTemplate(false);
      await loadTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCommit() {
    if (!file || !summary) return;

    // Calculate import count from summary totals (not limited previewRows)
    // This ensures we don't block commits when valid rows exist beyond the 100-row preview limit
    const nonDuplicateValidRows = summary.validRows - summary.duplicateCandidates;
    const duplicatesToImport = Object.values(duplicateDecisions).filter((d) => d === "import").length;
    const importCount = nonDuplicateValidRows + duplicatesToImport;

    if (importCount === 0) {
      toast.error("No rows to import");
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      // When using a template, only send templateId to preserve template's saved settings
      // When using manual mapping, send full config with columnMapping and parsingOptions
      const mappingConfig = selectedTemplateId && selectedTemplateId !== "none"
        ? {
            templateId: selectedTemplateId,
            importMode,
          }
        : {
            importMode,
            columnMapping,
            parsingOptions: {
              directionMode,
              dateFormat,
              delimiter,
              headerRowIndex: 0,
              hasHeaders: true,
              decimalSeparator,
              thousandsSeparator,
            },
          };

      formData.append("mappingConfig", JSON.stringify(mappingConfig));
      formData.append("decisions", JSON.stringify(duplicateDecisions));

      const response = await fetch(`/api/orgs/${orgSlug}/transactions/import/commit`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import failed");
      }

      const data = await response.json();

      toast.success(
        `Imported ${data.importedCount} transactions. Skipped ${data.skippedInvalidCount} invalid and ${data.skippedDuplicateCount} duplicates.`
      );

      // Close dialog and refresh
      onOpenChange(false);
      onImportCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const paginatedPreviewRows = React.useMemo(() => {
    const start = currentPage * ROWS_PER_PAGE;
    return previewRows.slice(start, start + ROWS_PER_PAGE);
  }, [previewRows, currentPage]);

  const totalPages = Math.ceil(previewRows.length / ROWS_PER_PAGE);

  async function handleDownloadSample() {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/transactions/import/sample-csv?dateFormat=${dateFormat}`
      );

      if (!response.ok) {
        throw new Error("Failed to download sample CSV");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sample-transactions-import-${orgSlug}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Sample CSV downloaded successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download sample CSV");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95wh] sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Import Transactions from CSV"}
            {step === "mapping" && "Map CSV Columns"}
            {step === "review" && "Review Import"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV export from your bank or accounting tool"}
            {step === "mapping" && "Tell us how your CSV columns map to transaction fields"}
            {step === "review" && "Check for issues and duplicates before importing"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload & Options */}
        {step === "upload" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Import Mode</Label>
              <RadioGroup value={importMode} onValueChange={(v) => setImportMode(v as ImportMode)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv_mode" />
                  <Label htmlFor="csv_mode" className="font-normal">
                    Standard CSV
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="zip_with_documents" id="zip_mode" />
                  <Label htmlFor="zip_mode" className="font-normal">
                    Advanced ZIP (CSV + documents)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>{importMode === "csv" ? "CSV File" : "ZIP File"}</Label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <Input
                  type="file"
                  accept={importMode === "csv" ? ".csv" : ".zip"}
                  onChange={handleFileChange}
                  className="max-w-xs mx-auto"
                />
                {file && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
                {importMode === "csv" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Accepted formats: .csv • Max size: 10 MB
                  </p>
                ) : (
                  <div className="mt-2 text-xs text-muted-foreground text-left max-w-md mx-auto">
                    <p className="font-medium mb-1">Accepted formats: .zip</p>
                    <p className="mb-1">ZIP must contain:</p>
                    <ul className="list-disc list-inside ml-2 space-y-0.5">
                      <li><code className="text-xs bg-muted px-1 rounded">transactions.csv</code> with a &quot;document&quot; column</li>
                      <li>Document files (e.g., <code className="text-xs bg-muted px-1 rounded">OpenAI/invoice.pdf</code>)</li>
                    </ul>
                    <p className="mt-1">Empty document cells = no document for that transaction</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadSample}
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download Sample CSV
              </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground -mt-2">
              Get a sample CSV customized with your organization&apos;s categories, accounts, and base currency
            </p>

            <div className="space-y-2">
              <Label>Mapping Template (optional)</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="None - configure manually" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None - configure manually</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Direction Mode</Label>
              <RadioGroup value={directionMode} onValueChange={(v) => setDirectionMode(v as DirectionMode)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="type_column" id="type_column" />
                  <Label htmlFor="type_column" className="font-normal">
                    Use Type column (Income / Expense)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sign_based" id="sign_based" />
                  <Label htmlFor="sign_based" className="font-normal">
                    Infer from Amount sign (positive = income, negative = expense)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date Format</Label>
                <Select value={dateFormat} onValueChange={(v) => setDateFormat(v as DateFormat)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DD_MM_YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM_DD_YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="YYYY_MM_DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>CSV Delimiter</Label>
                <Input value={delimiter} onChange={(e) => setDelimiter(e.target.value)} maxLength={1} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === "mapping" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Left: Field Mapping */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Field Mapping</h3>
                {[
                  { field: "date", label: "Date *", required: true },
                  { field: "amount", label: "Amount *", required: true },
                  { field: "currency", label: "Currency *", required: true },
                  ...(directionMode === "type_column" ? [{ field: "type", label: "Type *", required: true }] : []),
                  { field: "description", label: "Description *", required: true },
                  { field: "category", label: "Category *", required: true },
                  { field: "account", label: "Account *", required: true },
                  { field: "vendor", label: "Vendor (Expenses)", required: false },
                  { field: "client", label: "Client (Income)", required: false },
                  { field: "notes", label: "Notes", required: false },
                  { field: "tags", label: "Tags", required: false },
                  { field: "secondaryAmount", label: "Secondary Amount", required: false },
                  { field: "secondaryCurrency", label: "Secondary Currency", required: false },
                  ...(importMode === "zip_with_documents" ? [{ field: "document", label: "Document (path in ZIP)", required: false }] : []),
                ].map(({ field, label }) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Select
                      value={columnMapping[field] || ""}
                      onValueChange={(value) =>
                        setColumnMapping((prev) => ({ ...prev, [field]: value === "none" ? "" : value }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Not mapped" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not mapped</SelectItem>
                        {headers.map((header, idx) => (
                          <SelectItem key={idx} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Right: Sample Data */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Sample Data</h3>
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          {headers.slice(0, 5).map((header, idx) => (
                            <th key={idx} className="px-2 py-1 text-left font-medium">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sampleRows.map((row, rowIdx) => (
                          <tr key={rowIdx} className="border-t">
                            {row.slice(0, 5).map((cell, cellIdx) => (
                              <td key={cellIdx} className="px-2 py-1">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Showing first 3 rows and 5 columns
                </p>
              </div>
            </div>

            {!showSaveTemplate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveTemplate(true)}
              >
                Save Mapping as Template
              </Button>
            )}

            {showSaveTemplate && (
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-2">
                  <Label>Template Name</Label>
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Maybank CSV"
                  />
                </div>
                <Button onClick={handleSaveTemplate} disabled={isLoading || !templateName.trim()}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
                <Button variant="outline" onClick={() => setShowSaveTemplate(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review */}
        {step === "review" && summary && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium">Total Rows</p>
                <p className="text-2xl font-bold">{summary.totalRows}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-green-600">Valid</p>
                <p className="text-2xl font-bold text-green-600">{summary.validRows}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-red-600">Invalid</p>
                <p className="text-2xl font-bold text-red-600">{summary.invalidRows}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-yellow-600">Duplicates</p>
                <p className="text-2xl font-bold text-yellow-600">{summary.duplicateCandidates}</p>
              </div>
            </div>

            {/* Preview Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-left">Amount</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPreviewRows.map((row) => (
                      <tr key={row.rowIndex} className="border-t">
                        <td className="px-3 py-2">{row.rowIndex + 1}</td>
                        <td className="px-3 py-2">
                          {row.normalized?.date
                            ? new Date(row.normalized.date).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="px-3 py-2 max-w-xs truncate">
                          {row.normalized?.description || "-"}
                        </td>
                        <td className="px-3 py-2">
                          {row.normalized
                            ? `${row.normalized.currencyBase} ${row.normalized.amountBase.toFixed(2)}`
                            : "-"}
                        </td>
                        <td className="px-3 py-2">
                          {row.status === "valid" && !row.isDuplicateCandidate && (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Valid
                            </Badge>
                          )}
                          {row.status === "invalid" && (
                            <Badge variant="outline" className="bg-red-50 text-red-700">
                              <XCircle className="h-3 w-3 mr-1" />
                              Invalid
                            </Badge>
                          )}
                          {row.isDuplicateCandidate && (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Duplicate
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.status === "invalid" && (
                            <p className="text-xs text-red-600">{row.errors.join(", ")}</p>
                          )}
                          {row.isDuplicateCandidate && (
                            <Select
                              value={duplicateDecisions[row.rowIndex] || "skip"}
                              onValueChange={(value: "import" | "skip") =>
                                setDuplicateDecisions((prev) => ({ ...prev, [row.rowIndex]: value }))
                              }
                            >
                              <SelectTrigger className="h-7 text-xs w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="skip">Skip</SelectItem>
                                <SelectItem value="import">Import anyway</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">
                  Showing {currentPage * ROWS_PER_PAGE + 1} to{" "}
                  {Math.min((currentPage + 1) * ROWS_PER_PAGE, previewRows.length)} of{" "}
                  {previewRows.length} rows
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage === totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleContinueFromUpload} disabled={!file || isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Continue
              </Button>
            </>
          )}

          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handlePreview} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Preview Import
              </Button>
            </>
          )}

          {step === "review" && summary && (
            <>
              <Button variant="outline" onClick={() => setStep(selectedTemplateId && selectedTemplateId !== "none" ? "upload" : "mapping")}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleCommit} disabled={isLoading || summary.validRows === 0}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Import {summary.validRows - summary.duplicateCandidates + Object.values(duplicateDecisions).filter(d => d === "import").length} Rows
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
