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
} from "lucide-react";
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

  // Save option
  const [saveOption, setSaveOption] = React.useState<"create" | "update" | "draft">("draft");

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
        // Create transaction from extraction
        const amount = grandTotal ? parseFloat(grandTotal) : 0;

        if (!amount || amount <= 0) {
          toast.error("Please enter a valid amount");
          return;
        }

        if (!transactionDate) {
          toast.error("Please enter a transaction date");
          return;
        }

        // Save draft first, then navigate to transaction creation with pre-filled data
        // This allows user to select category and account
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
              value: amount,
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
        };

        // Save the reviewed extraction
        await fetch(
          `/api/orgs/${orgSlug}/documents/${documentId}/ai/extractions/${extraction.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ payload: updatedPayload }),
          }
        );

        // For v1: Show instructions to create transaction manually
        // v2 will add category/account pickers inline
        toast.success(
          "Extraction saved! To create a transaction, use the 'Link to Transactions' feature in the document detail page.",
          { duration: 5000 }
        );

        // Navigate back to document detail
        router.push(`/o/${orgSlug}/documents/${documentId}`);

        // TODO for v2: Add category and account pickers to this screen
        // Then uncomment the transaction creation flow below:
        /*
        // Get default account
        const accountsResponse = await fetch(`/api/orgs/${orgSlug}/accounts`);
        const accountsData = await accountsResponse.json();
        const defaultAccount = accountsData.accounts?.find((a: any) => a.isDefault);

        if (!defaultAccount) {
          toast.error("No default account found. Please configure an account first.");
          return;
        }

        // Get a default category (or let user select)
        const categoriesResponse = await fetch(`/api/orgs/${orgSlug}/categories`);
        const categoriesData = await categoriesResponse.json();
        const defaultCategory = categoriesData.categories?.find((c: any) =>
          c.type === "EXPENSE" && c.active
        );

        if (!defaultCategory) {
          toast.error("No expense category found. Please create a category first.");
          return;
        }

        const transactionPayload = {
          type: "EXPENSE",
          status: "DRAFT",
          date: transactionDate,
          description: vendorName || clientName || "AI Extracted Transaction",
          amountBase: amount,
          categoryId: defaultCategory.id,
          accountId: defaultAccount.id,
          vendorName: vendorName || null,
          clientName: clientName || null,
        };

        const response = await fetch(
          `/api/orgs/${orgSlug}/transactions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(transactionPayload),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to create transaction");
        }

        const transactionData = await response.json();
        const transaction = transactionData.transaction;

        // Link transaction to document
        await fetch(
          `/api/orgs/${orgSlug}/documents/${documentId}/transactions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              transactionIds: [transaction.id],
            }),
          }
        );

        toast.success("Transaction created successfully");
        router.push(`/o/${orgSlug}/transactions/${transaction.id}`);
        */
      } else {
        // Update existing transaction
        toast.info(
          "Update existing transaction feature will be implemented in a future update."
        );
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
          {extraction.payload.lineItems && extraction.payload.lineItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Line Items</CardTitle>
                <CardDescription>
                  {extraction.payload.lineItems.length} item(s) extracted
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {extraction.payload.lineItems.map((item, index) => (
                    <div key={index} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium">{item.description || "Untitled"}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            {item.quantity && <span>Qty: {item.quantity}</span>}
                            {item.unitPrice && <span>@ {item.unitPrice}</span>}
                            {item.lineTotal && <span className="font-medium">Total: {item.lineTotal}</span>}
                          </div>
                        </div>
                        <ConfidenceBadge confidence={item.confidence} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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
                <p className="text-sm text-muted-foreground">
                  Select an existing transaction to update with the extracted data.
                </p>
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
