"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Loader2,
  Sparkles,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfidenceBadge } from "@/components/features/documents/extraction/confidence-badge";
import type { DocumentExtractionV1 } from "@/lib/ai/document-schemas";

interface ExtractionResponse {
  id: string;
  documentId: string;
  status: "RAW" | "REVIEWED_DRAFT" | "APPLIED";
  templateKey: string | null;
  customPrompt: string | null;
  provider: "openai" | "gemini" | "anthropic";
  modelName: string;
  overallConfidence: number | null;
  summaryTotalAmount: number | null;
  summaryCurrency: string | null;
  summaryTransactionDate: string | null;
  isActive: boolean;
  payload: DocumentExtractionV1;
  createdAt: string;
  updatedAt: string;
}

export default function DocumentAIReviewPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const documentId = params.id as string;

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [extraction, setExtraction] = React.useState<ExtractionResponse | null>(null);
  const [documentName, setDocumentName] = React.useState<string>("");

  // Form state - initialized from extraction payload
  const [vendorName, setVendorName] = React.useState("");
  const [vendorConfidence, setVendorConfidence] = React.useState<number | null>(null);
  const [clientName, setClientName] = React.useState("");
  const [clientConfidence, setClientConfidence] = React.useState<number | null>(null);
  const [transactionDate, setTransactionDate] = React.useState("");
  const [currencyCode, setCurrencyCode] = React.useState("");
  const [grandTotal, setGrandTotal] = React.useState("");
  const [grandTotalConfidence, setGrandTotalConfidence] = React.useState<number | null>(null);
  const [netAmount, setNetAmount] = React.useState("");
  const [netAmountConfidence, setNetAmountConfidence] = React.useState<number | null>(null);
  const [taxAmount, setTaxAmount] = React.useState("");
  const [taxAmountConfidence, setTaxAmountConfidence] = React.useState<number | null>(null);
  const [tipAmount, setTipAmount] = React.useState("");
  const [tipAmountConfidence, setTipAmountConfidence] = React.useState<number | null>(null);

  // Line items state
  type LineItem = {
    description: string | null;
    quantity: number | null;
    unitPrice: number | null;
    lineTotal: number | null;
    taxAmount: number | null;
    categoryName: string | null;
    confidence: number;
  };
  const [lineItems, setLineItems] = React.useState<LineItem[]>([]);
  const [splitIntoMultiple, setSplitIntoMultiple] = React.useState(false);

  // Save option
  const [saveOption, setSaveOption] = React.useState<"create" | "update" | "draft">("draft");

  // Update transaction state
  const [selectedTransactionId, setSelectedTransactionId] = React.useState<string>("");
  const [selectedTransaction, setSelectedTransaction] = React.useState<any>(null);
  const [transactions, setTransactions] = React.useState<any[]>([]);
  const [fieldUpdates, setFieldUpdates] = React.useState<Record<string, boolean>>({});
  const [isLoadingTransactions, setIsLoadingTransactions] = React.useState(false);

  // Document preview zoom
  const [zoom, setZoom] = React.useState(100);

  // Load active extraction
  React.useEffect(() => {
    const loadExtraction = async () => {
      setIsLoading(true);
      try {
        // First, load document to get name
        const docResponse = await fetch(`/api/orgs/${orgSlug}/documents/${documentId}`);
        if (docResponse.ok) {
          const docData = await docResponse.json();
          setDocumentName(docData.displayName || docData.filenameOriginal);
        }

        // Load extractions list to find active one
        const response = await fetch(
          `/api/orgs/${orgSlug}/documents/${documentId}/ai/extractions`
        );

        if (!response.ok) {
          throw new Error("Failed to load extractions");
        }

        const extractions = await response.json();

        // Find active extraction
        const activeExtraction = extractions.find((e: { isActive: boolean }) => e.isActive);

        if (!activeExtraction) {
          toast.error("No extraction found for this document");
          router.push(`/o/${orgSlug}/documents/${documentId}`);
          return;
        }

        // Load full extraction with payload
        const fullResponse = await fetch(
          `/api/orgs/${orgSlug}/documents/${documentId}/ai/extractions/${activeExtraction.id}`
        );

        if (!fullResponse.ok) {
          throw new Error("Failed to load extraction details");
        }

        const fullExtraction: ExtractionResponse = await fullResponse.json();
        setExtraction(fullExtraction);

        // Initialize form state from payload
        const payload = fullExtraction.payload;
        setVendorName(payload.vendor?.name || "");
        setVendorConfidence(payload.vendor?.confidence || null);
        setClientName(payload.client?.name || "");
        setClientConfidence(payload.client?.confidence || null);
        setTransactionDate(payload.transactionDate || "");
        setCurrencyCode(payload.currencyCode || "USD");
        setGrandTotal(payload.totals.grandTotal?.value?.toString() || "");
        setGrandTotalConfidence(payload.totals.grandTotal?.confidence || null);
        setNetAmount(payload.totals.netAmount?.value?.toString() || "");
        setNetAmountConfidence(payload.totals.netAmount?.confidence || null);
        setTaxAmount(payload.totals.taxAmount?.value?.toString() || "");
        setTaxAmountConfidence(payload.totals.taxAmount?.confidence || null);
        setTipAmount(payload.totals.tipAmount?.value?.toString() || "");
        setTipAmountConfidence(payload.totals.tipAmount?.confidence || null);

        // Initialize line items
        setLineItems(payload.lineItems || []);
      } catch (error) {
        console.error("Error loading extraction:", error);
        toast.error("Failed to load extraction");
        router.push(`/o/${orgSlug}/documents/${documentId}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadExtraction();
  }, [orgSlug, documentId, router]);

  // Load transactions for update option
  React.useEffect(() => {
    if (saveOption === "update") {
      const loadTransactions = async () => {
        setIsLoadingTransactions(true);
        try {
          const response = await fetch(`/api/orgs/${orgSlug}/transactions?status=DRAFT`);
          if (response.ok) {
            const { transactions } = await response.json();
            setTransactions(transactions || []);
          }
        } catch (error) {
          console.error("Error loading transactions:", error);
        } finally {
          setIsLoadingTransactions(false);
        }
      };
      loadTransactions();
    }
  }, [saveOption, orgSlug]);

  // Load selected transaction details
  React.useEffect(() => {
    if (selectedTransactionId) {
      const loadTransaction = async () => {
        try {
          const response = await fetch(`/api/orgs/${orgSlug}/transactions/${selectedTransactionId}`);
          if (response.ok) {
            const { transaction } = await response.json();
            setSelectedTransaction(transaction);
            // Initialize all fields as unchecked
            setFieldUpdates({
              date: false,
              description: false,
              amount: false,
              vendor: false,
            });
          }
        } catch (error) {
          console.error("Error loading transaction:", error);
        }
      };
      loadTransaction();
    } else {
      setSelectedTransaction(null);
      setFieldUpdates({});
    }
  }, [selectedTransactionId, orgSlug]);

  // Line item handlers
  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        description: "",
        quantity: null,
        unitPrice: null,
        lineTotal: null,
        taxAmount: null,
        categoryName: null,
        confidence: 0.5,
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleUpdateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleSave = async () => {
    if (!extraction) return;

    setIsSaving(true);
    try {
      if (saveOption === "draft") {
        // Save as draft - update extraction payload with edited values
        const updatedPayload = {
          ...extraction.payload,
          vendor: {
            name: vendorName || null,
            confidence: vendorConfidence,
          },
          client: {
            name: clientName || null,
            confidence: clientConfidence,
          },
          transactionDate: transactionDate || null,
          currencyCode: currencyCode || null,
          totals: {
            grandTotal: {
              value: grandTotal ? parseFloat(grandTotal) : null,
              confidence: grandTotalConfidence || 0,
              rawText: grandTotal || null,
            },
            netAmount: {
              value: netAmount ? parseFloat(netAmount) : null,
              confidence: netAmountConfidence || 0,
              rawText: netAmount || null,
            },
            taxAmount: {
              value: taxAmount ? parseFloat(taxAmount) : null,
              confidence: taxAmountConfidence || 0,
              rawText: taxAmount || null,
            },
            tipAmount: {
              value: tipAmount ? parseFloat(tipAmount) : null,
              confidence: tipAmountConfidence || 0,
              rawText: tipAmount || null,
            },
          },
          lineItems,
        };

        const response = await fetch(
          `/api/orgs/${orgSlug}/documents/${documentId}/ai/extractions/${extraction.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ payload: updatedPayload }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to save draft");
        }

        toast.success("Draft saved successfully");
      } else if (saveOption === "create") {
        // Create transaction(s) from extraction
        const amount = grandTotal ? parseFloat(grandTotal) : 0;

        if (!amount || amount <= 0) {
          toast.error("Please enter a valid amount");
          setIsSaving(false);
          return;
        }

        if (!transactionDate) {
          toast.error("Please enter a transaction date");
          setIsSaving(false);
          return;
        }

        // First, get default category and account
        const categoriesRes = await fetch(`/api/orgs/${orgSlug}/categories?type=EXPENSE`);
        const accountsRes = await fetch(`/api/orgs/${orgSlug}/accounts`);

        if (!categoriesRes.ok || !accountsRes.ok) {
          toast.error("Failed to load categories or accounts");
          setIsSaving(false);
          return;
        }

        const { categories } = await categoriesRes.json();
        const { accounts } = await accountsRes.json();

        if (!categories || categories.length === 0) {
          toast.error("No expense categories found. Please create a category first.");
          setIsSaving(false);
          return;
        }

        if (!accounts || accounts.length === 0) {
          toast.error("No accounts found. Please create an account first.");
          setIsSaving(false);
          return;
        }

        // Use first available category and account
        const defaultCategory = categories[0];
        const defaultAccount = accounts[0];

        const createdTransactionIds: string[] = [];

        try {
          if (splitIntoMultiple && lineItems.length > 0) {
            // Create one transaction per line item
            for (const item of lineItems) {
              if (!item.lineTotal || item.lineTotal <= 0) continue;

              const txPayload = {
                type: "EXPENSE" as const,
                status: "DRAFT" as const,
                amountBase: item.lineTotal,
                date: transactionDate,
                description: item.description || "AI Extracted Transaction",
                categoryId: defaultCategory.id,
                accountId: defaultAccount.id,
                vendorName: vendorName || null,
                notes: `AI extracted from document. Please review category and account.`,
              };

              const txRes = await fetch(`/api/orgs/${orgSlug}/transactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(txPayload),
              });

              if (txRes.ok) {
                const { transaction } = await txRes.json();
                createdTransactionIds.push(transaction.id);

                // Link transaction to document
                await fetch(`/api/orgs/${orgSlug}/documents/${documentId}/transactions`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ transactionId: transaction.id }),
                });
              }
            }
          } else {
            // Create single transaction from grand total
            const txPayload = {
              type: "EXPENSE" as const,
              status: "DRAFT" as const,
              amountBase: amount,
              date: transactionDate,
              description: vendorName || "AI Extracted Transaction",
              categoryId: defaultCategory.id,
              accountId: defaultAccount.id,
              vendorName: vendorName || null,
              notes: `AI extracted from document. Please review category and account.`,
            };

            const txRes = await fetch(`/api/orgs/${orgSlug}/transactions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(txPayload),
            });

            if (txRes.ok) {
              const { transaction } = await txRes.json();
              createdTransactionIds.push(transaction.id);

              // Link transaction to document
              await fetch(`/api/orgs/${orgSlug}/documents/${documentId}/transactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transactionId: transaction.id }),
              });
            }
          }

          if (createdTransactionIds.length === 0) {
            throw new Error("No transactions were created");
          }

          // Update extraction status to APPLIED
          const updatedPayload = {
            ...extraction.payload,
            vendor: { name: vendorName || null, confidence: vendorConfidence },
            client: { name: clientName || null, confidence: clientConfidence },
            transactionDate: transactionDate || null,
            currencyCode: currencyCode || null,
            totals: {
              grandTotal: { value: amount, confidence: grandTotalConfidence || 0, rawText: grandTotal || null },
              netAmount: { value: netAmount ? parseFloat(netAmount) : null, confidence: netAmountConfidence || 0, rawText: netAmount || null },
              taxAmount: { value: taxAmount ? parseFloat(taxAmount) : null, confidence: taxAmountConfidence || 0, rawText: taxAmount || null },
              tipAmount: { value: tipAmount ? parseFloat(tipAmount) : null, confidence: tipAmountConfidence || 0, rawText: tipAmount || null },
            },
            lineItems,
          };

          await fetch(`/api/orgs/${orgSlug}/documents/${documentId}/ai/extractions/${extraction.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              payload: updatedPayload,
              status: "APPLIED",
              appliedTransactionIds: createdTransactionIds,
            }),
          });

          toast.success(`Created ${createdTransactionIds.length} draft transaction(s). Please review category and account.`);
          router.push(`/o/${orgSlug}/documents/${documentId}`);
        } catch (error) {
          console.error("Transaction creation error:", error);
          toast.error("Failed to create transactions. Please try again.");
          setIsSaving(false);
          return;
        }
      } else {
        // Update existing transaction
        if (!selectedTransactionId || !selectedTransaction) {
          toast.error("Please select a transaction to update");
          setIsSaving(false);
          return;
        }

        // Check if any fields are selected for update
        const hasUpdates = Object.values(fieldUpdates).some((v) => v);
        if (!hasUpdates) {
          toast.error("Please select at least one field to update");
          setIsSaving(false);
          return;
        }

        try {
          // Build update payload with only selected fields
          const updatePayload: any = {};

          if (fieldUpdates.date && transactionDate) {
            updatePayload.date = transactionDate;
          }

          if (fieldUpdates.description && vendorName) {
            updatePayload.description = vendorName;
          }

          if (fieldUpdates.amount && grandTotal) {
            updatePayload.amountBase = parseFloat(grandTotal);
          }

          if (fieldUpdates.vendor && vendorName) {
            updatePayload.vendorName = vendorName;
          }

          // Update the transaction
          const txResponse = await fetch(`/api/orgs/${orgSlug}/transactions/${selectedTransactionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatePayload),
          });

          if (!txResponse.ok) {
            throw new Error("Failed to update transaction");
          }

          // Link transaction to document if not already linked
          await fetch(`/api/orgs/${orgSlug}/documents/${documentId}/transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactionId: selectedTransactionId }),
          }).catch(() => {
            // Ignore error if already linked
          });

          // Update extraction status to APPLIED
          const updatedPayload = {
            ...extraction.payload,
            vendor: { name: vendorName || null, confidence: vendorConfidence },
            client: { name: clientName || null, confidence: clientConfidence },
            transactionDate: transactionDate || null,
            currencyCode: currencyCode || null,
            totals: {
              grandTotal: { value: grandTotal ? parseFloat(grandTotal) : null, confidence: grandTotalConfidence || 0, rawText: grandTotal || null },
              netAmount: { value: netAmount ? parseFloat(netAmount) : null, confidence: netAmountConfidence || 0, rawText: netAmount || null },
              taxAmount: { value: taxAmount ? parseFloat(taxAmount) : null, confidence: taxAmountConfidence || 0, rawText: taxAmount || null },
              tipAmount: { value: tipAmount ? parseFloat(tipAmount) : null, confidence: tipAmountConfidence || 0, rawText: tipAmount || null },
            },
            lineItems,
          };

          await fetch(`/api/orgs/${orgSlug}/documents/${documentId}/ai/extractions/${extraction.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              payload: updatedPayload,
              status: "APPLIED",
              appliedTransactionIds: [selectedTransactionId],
            }),
          });

          toast.success("Transaction updated successfully");
          router.push(`/o/${orgSlug}/documents/${documentId}`);
        } catch (error) {
          console.error("Update error:", error);
          toast.error("Failed to update transaction");
          setIsSaving(false);
          return;
        }
      }
    } catch (error) {
      console.error("Error saving:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save"
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading extraction...</p>
        </div>
      </div>
    );
  }

  if (!extraction) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No extraction found</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Run AI extraction first to review results
          </p>
          <Button asChild className="mt-4">
            <Link href={`/o/${orgSlug}/documents/${documentId}`}>
              Back to Document
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/o/${orgSlug}/documents/${documentId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              AI Review
            </h1>
            <p className="text-sm text-muted-foreground">{documentName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {extraction.provider} / {extraction.modelName}
          </Badge>
          {extraction.overallConfidence !== null && (
            <ConfidenceBadge confidence={extraction.overallConfidence} />
          )}
        </div>
      </div>

      {/* Split View Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Document Preview */}
        <Card className="lg:sticky lg:top-4 h-fit">
          <CardHeader>
            <CardTitle className="text-base">Document Preview</CardTitle>
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom(Math.max(50, zoom - 25))}
                disabled={zoom <= 50}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                {zoom}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom(Math.min(200, zoom + 25))}
                disabled={zoom >= 200}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden bg-muted/50">
              <iframe
                src={`/api/orgs/${orgSlug}/documents/${documentId}/download?mode=inline`}
                className="w-full h-[600px]"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
                title="Document preview"
              />
            </div>
          </CardContent>
        </Card>

        {/* Right: Extraction Form */}
        <div className="space-y-6">
          {/* Summary Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="vendor"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="Vendor name"
                  />
                  {vendorConfidence !== null && (
                    <ConfidenceBadge confidence={vendorConfidence} />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="client"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Client name"
                  />
                  {clientConfidence !== null && (
                    <ConfidenceBadge confidence={clientConfidence} />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Transaction Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={currencyCode} onValueChange={setCurrencyCode}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="CAD">CAD</SelectItem>
                      <SelectItem value="AUD">AUD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Amounts & Taxes Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Amounts & Taxes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="grandTotal">Grand Total</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="grandTotal"
                    type="number"
                    step="0.01"
                    value={grandTotal}
                    onChange={(e) => setGrandTotal(e.target.value)}
                    placeholder="0.00"
                  />
                  {grandTotalConfidence !== null && (
                    <ConfidenceBadge confidence={grandTotalConfidence} />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="netAmount">Net Amount</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="netAmount"
                    type="number"
                    step="0.01"
                    value={netAmount}
                    onChange={(e) => setNetAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  {netAmountConfidence !== null && (
                    <ConfidenceBadge confidence={netAmountConfidence} />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxAmount">Tax Amount</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="taxAmount"
                    type="number"
                    step="0.01"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  {taxAmountConfidence !== null && (
                    <ConfidenceBadge confidence={taxAmountConfidence} />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipAmount">Tip Amount</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="tipAmount"
                    type="number"
                    step="0.01"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  {tipAmountConfidence !== null && (
                    <ConfidenceBadge confidence={tipAmountConfidence} />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Line Items</CardTitle>
                  <CardDescription>
                    {lineItems.length} item(s)
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleAddLineItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {lineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No line items. Click "Add Item" to create one.
                </p>
              ) : (
                <div className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-3">
                          {/* Description */}
                          <div>
                            <Label className="text-xs">Description</Label>
                            <Input
                              value={item.description || ""}
                              onChange={(e) => handleUpdateLineItem(index, "description", e.target.value)}
                              placeholder="Item description"
                            />
                          </div>

                          {/* Quantity, Unit Price, Line Total */}
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs">Quantity</Label>
                              <Input
                                type="number"
                                value={item.quantity ?? ""}
                                onChange={(e) => handleUpdateLineItem(index, "quantity", e.target.value ? parseFloat(e.target.value) : null)}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Unit Price</Label>
                              <Input
                                type="number"
                                value={item.unitPrice ?? ""}
                                onChange={(e) => handleUpdateLineItem(index, "unitPrice", e.target.value ? parseFloat(e.target.value) : null)}
                                placeholder="0.00"
                                step="0.01"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Line Total</Label>
                              <Input
                                type="number"
                                value={item.lineTotal ?? ""}
                                onChange={(e) => handleUpdateLineItem(index, "lineTotal", e.target.value ? parseFloat(e.target.value) : null)}
                                placeholder="0.00"
                                step="0.01"
                              />
                            </div>
                          </div>

                          {/* Tax Amount & Category */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Tax Amount</Label>
                              <Input
                                type="number"
                                value={item.taxAmount ?? ""}
                                onChange={(e) => handleUpdateLineItem(index, "taxAmount", e.target.value ? parseFloat(e.target.value) : null)}
                                placeholder="0.00"
                                step="0.01"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Category</Label>
                              <Input
                                value={item.categoryName || ""}
                                onChange={(e) => handleUpdateLineItem(index, "categoryName", e.target.value)}
                                placeholder="Category name"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Confidence & Remove */}
                        <div className="flex flex-col items-end gap-2">
                          <ConfidenceBadge confidence={item.confidence} />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveLineItem(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Split Toggle */}
              <div className="flex items-center space-x-2 pt-2 border-t">
                <Checkbox
                  id="split-toggle"
                  checked={splitIntoMultiple}
                  onCheckedChange={(checked) => setSplitIntoMultiple(checked as boolean)}
                />
                <Label htmlFor="split-toggle" className="text-sm cursor-pointer">
                  Split into multiple transactions
                </Label>
              </div>
              {splitIntoMultiple && (
                <p className="text-xs text-muted-foreground">
                  When enabled, each line item will create a separate transaction.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Save Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Save Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>What would you like to do?</Label>
                <Select value={saveOption} onValueChange={(value: any) => setSaveOption(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Save as draft (document only)</SelectItem>
                    <SelectItem value="create">Create new transaction(s)</SelectItem>
                    <SelectItem value="update">Update existing transaction</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {saveOption === "draft" && (
                <p className="text-sm text-muted-foreground">
                  Save your reviewed extraction without creating a transaction. You can create a transaction later.
                </p>
              )}

              {saveOption === "create" && (
                <p className="text-sm text-muted-foreground">
                  Create a new draft transaction from this extraction. You can review and post it later.
                </p>
              )}

              {saveOption === "update" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Select an existing transaction to update with the extracted data.
                  </p>

                  {/* Transaction Picker */}
                  <div>
                    <Label>Select Transaction</Label>
                    <Select value={selectedTransactionId} onValueChange={setSelectedTransactionId}>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingTransactions ? "Loading..." : "Choose a transaction"} />
                      </SelectTrigger>
                      <SelectContent>
                        {transactions.map((tx) => (
                          <SelectItem key={tx.id} value={tx.id}>
                            {tx.description} - {tx.amountBase} ({new Date(tx.date).toLocaleDateString()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Diff Panel */}
                  {selectedTransaction && (
                    <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
                      <h4 className="font-medium text-sm">Select Fields to Update</h4>

                      {/* Date Field */}
                      <div className="flex items-start gap-3 p-3 border rounded bg-background">
                        <Checkbox
                          id="update-date"
                          checked={fieldUpdates.date || false}
                          onCheckedChange={(checked) => setFieldUpdates({ ...fieldUpdates, date: checked as boolean })}
                        />
                        <div className="flex-1">
                          <Label htmlFor="update-date" className="text-sm font-medium cursor-pointer">Date</Label>
                          <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                            <div>
                              <p className="text-muted-foreground">Current:</p>
                              <p>{new Date(selectedTransaction.date).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Extracted:</p>
                              <p>{transactionDate ? new Date(transactionDate).toLocaleDateString() : "—"}</p>
                              {transactionDate && <ConfidenceBadge confidence={0.8} className="mt-1" />}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Description Field */}
                      <div className="flex items-start gap-3 p-3 border rounded bg-background">
                        <Checkbox
                          id="update-description"
                          checked={fieldUpdates.description || false}
                          onCheckedChange={(checked) => setFieldUpdates({ ...fieldUpdates, description: checked as boolean })}
                        />
                        <div className="flex-1">
                          <Label htmlFor="update-description" className="text-sm font-medium cursor-pointer">Description</Label>
                          <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                            <div>
                              <p className="text-muted-foreground">Current:</p>
                              <p>{selectedTransaction.description || "—"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Extracted:</p>
                              <p>{vendorName || "—"}</p>
                              {vendorName && <ConfidenceBadge confidence={vendorConfidence || 0} className="mt-1" />}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Amount Field */}
                      <div className="flex items-start gap-3 p-3 border rounded bg-background">
                        <Checkbox
                          id="update-amount"
                          checked={fieldUpdates.amount || false}
                          onCheckedChange={(checked) => setFieldUpdates({ ...fieldUpdates, amount: checked as boolean })}
                        />
                        <div className="flex-1">
                          <Label htmlFor="update-amount" className="text-sm font-medium cursor-pointer">Amount</Label>
                          <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                            <div>
                              <p className="text-muted-foreground">Current:</p>
                              <p>{selectedTransaction.amountBase}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Extracted:</p>
                              <p>{grandTotal || "—"}</p>
                              {grandTotal && <ConfidenceBadge confidence={grandTotalConfidence || 0} className="mt-1" />}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Vendor Field */}
                      <div className="flex items-start gap-3 p-3 border rounded bg-background">
                        <Checkbox
                          id="update-vendor"
                          checked={fieldUpdates.vendor || false}
                          onCheckedChange={(checked) => setFieldUpdates({ ...fieldUpdates, vendor: checked as boolean })}
                        />
                        <div className="flex-1">
                          <Label htmlFor="update-vendor" className="text-sm font-medium cursor-pointer">Vendor</Label>
                          <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                            <div>
                              <p className="text-muted-foreground">Current:</p>
                              <p>{selectedTransaction.vendorName || selectedTransaction.vendor?.name || "—"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Extracted:</p>
                              <p>{vendorName || "—"}</p>
                              {vendorName && <ConfidenceBadge confidence={vendorConfidence || 0} className="mt-1" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/o/${orgSlug}/documents/${documentId}`)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {saveOption === "draft" ? "Save Draft" : saveOption === "create" ? "Create Transaction" : "Update Transaction"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
