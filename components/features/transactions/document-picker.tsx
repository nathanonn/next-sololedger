"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, FileText, Image as ImageIcon } from "lucide-react";
import { formatDate } from "@/lib/sololedger-formatters";

interface DocumentListItem {
  id: string;
  displayName: string;
  filenameOriginal: string;
  mimeType: string;
  fileSizeBytes: number;
  type: string;
  documentDate: string | null;
  uploadedAt: string;
  isLinked: boolean;
  linkedTransactionCount: number;
}

interface DocumentPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  transactionId: string;
  onDocumentsLinked: () => void;
}

export function DocumentPicker({
  open,
  onOpenChange,
  orgSlug,
  transactionId,
  onDocumentsLinked,
}: DocumentPickerProps): React.JSX.Element {
  const [isLoading, setIsLoading] = React.useState(false);
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = React.useState<string[]>([]);
  const [isLinking, setIsLinking] = React.useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [linkedFilter, setLinkedFilter] = React.useState("unlinked");
  const [fileTypeFilter, setFileTypeFilter] = React.useState("all");

  async function loadDocuments() {
    try {
      setIsLoading(true);

      // Build query params
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append("q", searchQuery.trim());
      if (linkedFilter !== "all") params.append("linked", linkedFilter);
      if (fileTypeFilter !== "all") params.append("fileType", fileTypeFilter);

      const response = await fetch(
        `/api/orgs/${orgSlug}/documents?${params.toString()}`
      );

      if (response.ok) {
        const data = await response.json();
        setDocuments(data.items || []);
      } else {
        toast.error("Failed to load documents");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    if (open) {
      loadDocuments();
      setSelectedDocumentIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, linkedFilter, fileTypeFilter]);

  // Debounce search
  React.useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      loadDocuments();
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  function toggleDocumentSelection(documentId: string) {
    setSelectedDocumentIds((prev) =>
      prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId]
    );
  }

  async function handleLinkSelected() {
    if (selectedDocumentIds.length === 0) {
      toast.error("Please select at least one document");
      return;
    }

    try {
      setIsLinking(true);

      const response = await fetch(
        `/api/orgs/${orgSlug}/transactions/${transactionId}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentIds: selectedDocumentIds }),
        }
      );

      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error || "Failed to link documents");
        return;
      }

      toast.success(`${selectedDocumentIds.length} document(s) linked`);
      onDocumentsLinked();
      onOpenChange(false);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLinking(false);
    }
  }

  function getDocumentIcon(mimeType: string) {
    if (mimeType.startsWith("image/")) {
      return <ImageIcon className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Attach Existing Documents</DialogTitle>
          <DialogDescription>
            Search and select documents to link to this transaction
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by filename, vendor, text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="linked-filter">Status</Label>
              <Select value={linkedFilter} onValueChange={setLinkedFilter}>
                <SelectTrigger id="linked-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All documents</SelectItem>
                  <SelectItem value="unlinked">Unlinked only</SelectItem>
                  <SelectItem value="linked">Linked only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-type-filter">File Type</Label>
              <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
                <SelectTrigger id="file-type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="pdf">PDFs</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto border rounded-lg">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : documents.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No documents found
            </p>
          ) : (
            <div className="divide-y">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => toggleDocumentSelection(doc.id)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedDocumentIds.includes(doc.id)}
                      onCheckedChange={() => toggleDocumentSelection(doc.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {getDocumentIcon(doc.mimeType)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {doc.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(
                          new Date(doc.documentDate || doc.uploadedAt),
                          "DD/MM/YYYY"
                        )}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {doc.type}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {formatFileSize(doc.fileSizeBytes)}
                        </Badge>
                        {doc.linkedTransactionCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Linked: {doc.linkedTransactionCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLinking}
          >
            Cancel
          </Button>
          <Button
            onClick={handleLinkSelected}
            disabled={selectedDocumentIds.length === 0 || isLinking}
          >
            {isLinking
              ? "Linking..."
              : `Attach selected (${selectedDocumentIds.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
