"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles,
  FileText,
  Clock,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { ConfidenceBadge } from "./confidence-badge";
import { RunExtractionDialog } from "../run-extraction-dialog";

interface ExtractionMetadata {
  id: string;
  status: "RAW" | "REVIEWED_DRAFT" | "APPLIED";
  templateKey: string | null;
  provider: string;
  modelName: string;
  overallConfidence: number | null;
  summaryTotalAmount: number | null;
  summaryCurrency: string | null;
  summaryTransactionDate: string | null;
  isActive: boolean;
  createdAt: string;
}

interface ExtractionSummaryCardProps {
  orgSlug: string;
  documentId: string;
  documentName: string;
}

export function ExtractionSummaryCard({
  orgSlug,
  documentId,
  documentName,
}: ExtractionSummaryCardProps): React.JSX.Element {
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeExtraction, setActiveExtraction] = React.useState<ExtractionMetadata | null>(null);
  const [extractionHistory, setExtractionHistory] = React.useState<ExtractionMetadata[]>([]);
  const [showRunDialog, setShowRunDialog] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);

  const loadExtractions = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/documents/${documentId}/ai/extractions`
      );

      if (!response.ok) {
        if (response.status === 404) {
          // No extractions yet
          setActiveExtraction(null);
          setExtractionHistory([]);
          return;
        }
        throw new Error("Failed to load extractions");
      }

      const extractions: ExtractionMetadata[] = await response.json();
      const active = extractions.find((e) => e.isActive);

      setActiveExtraction(active || null);
      setExtractionHistory(extractions);
    } catch (error) {
      console.error("Error loading extractions:", error);
      toast.error("Failed to load extraction history");
    } finally {
      setIsLoading(false);
    }
  }, [orgSlug, documentId]);

  React.useEffect(() => {
    loadExtractions();
  }, [loadExtractions]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAmount = (amount: number | null, currency: string | null) => {
    if (amount === null) return "—";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Extraction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Extraction
          </CardTitle>
          {activeExtraction && (
            <CardDescription>
              Last extracted {formatDate(activeExtraction.createdAt)}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!activeExtraction ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                No extraction yet
              </p>
              <Button onClick={() => setShowRunDialog(true)} size="sm">
                <Sparkles className="mr-2 h-4 w-4" />
                Run AI Extraction
              </Button>
            </div>
          ) : (
            <>
              {/* Extraction Summary */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <Badge variant="outline">
                    {activeExtraction.status === "RAW"
                      ? "Raw"
                      : activeExtraction.status === "REVIEWED_DRAFT"
                      ? "Draft"
                      : "Applied"}
                  </Badge>
                </div>

                {activeExtraction.overallConfidence !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Confidence</span>
                    <ConfidenceBadge confidence={activeExtraction.overallConfidence} />
                  </div>
                )}

                {activeExtraction.summaryTotalAmount !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total Amount</span>
                    <span className="text-sm font-mono">
                      {formatAmount(
                        activeExtraction.summaryTotalAmount,
                        activeExtraction.summaryCurrency
                      )}
                    </span>
                  </div>
                )}

                {activeExtraction.summaryTransactionDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Transaction Date</span>
                    <span className="text-sm">
                      {new Date(activeExtraction.summaryTransactionDate).toLocaleDateString()}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Template</span>
                  <span className="text-sm text-muted-foreground">
                    {activeExtraction.templateKey || "Custom"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Model</span>
                  <span className="text-sm text-muted-foreground">
                    {activeExtraction.provider} / {activeExtraction.modelName}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <Button asChild className="w-full">
                  <Link href={`/o/${orgSlug}/documents/${documentId}/ai`}>
                    Review & Save
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRunDialog(true)}
                    className="flex-1"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Re-run
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex-1"
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    History ({extractionHistory.length})
                  </Button>
                </div>
              </div>

              {/* Extraction History */}
              {showHistory && extractionHistory.length > 0 && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3">History</h4>
                  <div className="space-y-2">
                    {extractionHistory.map((extraction) => (
                      <div
                        key={extraction.id}
                        className={`p-3 rounded-lg border text-sm ${
                          extraction.isActive
                            ? "bg-primary/5 border-primary/20"
                            : "bg-muted/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium truncate">
                                {extraction.templateKey || "Custom"}
                              </span>
                              {extraction.isActive && (
                                <Badge variant="default" className="text-xs">
                                  Active
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(extraction.createdAt)}
                            </p>
                          </div>
                          {extraction.overallConfidence !== null && (
                            <ConfidenceBadge
                              confidence={extraction.overallConfidence}
                              className="text-xs"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Run Extraction Dialog */}
      <RunExtractionDialog
        open={showRunDialog}
        onOpenChange={(open) => {
          setShowRunDialog(open);
          if (!open) {
            // Reload extractions when dialog closes (in case extraction ran)
            loadExtractions();
          }
        }}
        documentId={documentId}
        documentName={documentName}
        orgSlug={orgSlug}
      />
    </>
  );
}
