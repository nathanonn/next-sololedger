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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Trash2,
  Save,
  ExternalLink,
  X,
} from "lucide-react";

interface LinkedTransaction {
  id: string;
  date: string;
  description: string;
  amountBase: string;
  currencyBase: string | null;
  type: string;
  status: string;
  category: {
    id: string;
    name: string;
    type: string;
  };
  vendor: {
    id: string;
    name: string;
  } | null;
  client: {
    id: string;
    name: string;
  } | null;
  linkedAt: string;
}

interface Document {
  id: string;
  filenameOriginal: string;
  displayName: string;
  mimeType: string;
  fileSizeBytes: number;
  type: "RECEIPT" | "INVOICE" | "BANK_STATEMENT" | "OTHER";
  documentDate: string | null;
  uploadedAt: string;
  uploadedBy: {
    id: string;
    name: string | null;
    email: string;
  };
  deletedAt: string | null;
  linkedTransactions: LinkedTransaction[];
}

export default function DocumentDetailPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const documentId = params.id as string;

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [document, setDocument] = React.useState<Document | null>(null);

  // Editable fields
  const [displayName, setDisplayName] = React.useState("");
  const [type, setType] = React.useState<"RECEIPT" | "INVOICE" | "BANK_STATEMENT" | "OTHER">("OTHER");
  const [documentDate, setDocumentDate] = React.useState("");

  // Load document
  const loadDocument = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/documents/${documentId}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Document not found");
          router.push(`/o/${orgSlug}/documents`);
          return;
        }
        throw new Error("Failed to fetch document");
      }

      const data: Document = await response.json();
      setDocument(data);
      setDisplayName(data.displayName);
      setType(data.type);
      setDocumentDate(data.documentDate ? data.documentDate.split("T")[0] : "");
    } catch (error) {
      console.error("Error loading document:", error);
      toast.error("Failed to load document");
    } finally {
      setIsLoading(false);
    }
  }, [orgSlug, documentId, router]);

  React.useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/documents/${documentId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            displayName,
            type,
            documentDate: documentDate || null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update document");
      }

      toast.success("Document updated");
      await loadDocument();
    } catch (error) {
      console.error("Error updating document:", error);
      toast.error("Failed to update document");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!confirm("Move this document to trash?")) return;

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/documents/${documentId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      toast.success("Document moved to trash");
      router.push(`/o/${orgSlug}/documents`);
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    }
  };

  // Handle unlink transaction
  const handleUnlink = async (transactionId: string) => {
    if (!confirm("Unlink this transaction from the document?")) return;

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/documents/${documentId}/transactions`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transactionIds: [transactionId],
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to unlink transaction");
      }

      toast.success("Transaction unlinked");
      await loadDocument();
    } catch (error) {
      console.error("Error unlinking transaction:", error);
      toast.error("Failed to unlink transaction");
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading || !document) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-muted-foreground">Loading document...</div>
        </div>
      </div>
    );
  }

  const isImage = document.mimeType.startsWith("image/");
  const isPdf = document.mimeType === "application/pdf";
  const previewUrl = `/api/orgs/${orgSlug}/documents/${documentId}/download?mode=inline`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight truncate max-w-2xl">
            {document.displayName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {document.filenameOriginal}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/o/${orgSlug}/documents`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <a
              href={`/api/orgs/${orgSlug}/documents/${documentId}/download?mode=attachment`}
              download
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </a>
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Trash
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preview */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {isImage && (
                <img
                  src={previewUrl}
                  alt={document.displayName}
                  className="max-w-full h-auto rounded border"
                />
              )}
              {isPdf && (
                <iframe
                  src={previewUrl}
                  className="w-full h-[600px] rounded border"
                  title={document.displayName}
                />
              )}
              {!isImage && !isPdf && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    Preview not available for this file type
                  </p>
                  <Button className="mt-4" asChild>
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open in new tab
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Metadata */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={type} onValueChange={(value: any) => setType(value)}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECEIPT">Receipt</SelectItem>
                    <SelectItem value="INVOICE">Invoice</SelectItem>
                    <SelectItem value="BANK_STATEMENT">Bank Statement</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="documentDate">Document Date</Label>
                <Input
                  id="documentDate"
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>File Info</Label>
                <div className="text-sm space-y-1">
                  <p className="text-muted-foreground">
                    MIME: {document.mimeType}
                  </p>
                  <p className="text-muted-foreground">
                    Size: {formatFileSize(document.fileSizeBytes)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Upload Info</Label>
                <div className="text-sm space-y-1">
                  <p className="text-muted-foreground">
                    Uploaded: {new Date(document.uploadedAt).toLocaleString()}
                  </p>
                  <p className="text-muted-foreground">
                    By: {document.uploadedBy.name || document.uploadedBy.email}
                  </p>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          {/* Linked Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Linked Transactions</CardTitle>
              <CardDescription>
                {document.linkedTransactions.length} transaction(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {document.linkedTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No transactions linked yet
                </p>
              ) : (
                document.linkedTransactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="p-3 border rounded-lg space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {txn.description}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(txn.date).toLocaleDateString()} •{" "}
                          {txn.currencyBase} {Number(txn.amountBase).toFixed(2)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnlink(txn.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {txn.type}
                      </Badge>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        asChild
                      >
                        <Link href={`/o/${orgSlug}/transactions/${txn.id}`}>
                          View →
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
