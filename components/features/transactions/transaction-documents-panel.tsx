"use client";

import * as React from "react";
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
  Paperclip,
  FileText,
  Image as ImageIcon,
  Download,
  Trash2,
  Plus,
  Upload,
} from "lucide-react";
import { DocumentPicker } from "./document-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/sololedger-formatters";

interface Document {
  id: string;
  displayName: string;
  filenameOriginal: string;
  mimeType: string;
  fileSizeBytes: number;
  type: string;
  documentDate: string | null;
  uploadedAt: string;
}

interface TransactionDocumentsPanelProps {
  orgSlug: string;
  transactionId: string;
  documents: Document[];
  onDocumentsChange: () => void;
}

export function TransactionDocumentsPanel({
  orgSlug,
  transactionId,
  documents,
  onDocumentsChange,
}: TransactionDocumentsPanelProps): React.JSX.Element {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleUnlink(documentId: string) {
    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/transactions/${transactionId}/documents`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentIds: [documentId] }),
        }
      );

      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error || "Failed to unlink document");
        return;
      }

      toast.success("Document unlinked");
      onDocumentsChange();
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  async function handleUploadAndLink(files: FileList | null) {
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);

      // Upload documents
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const uploadResponse = await fetch(
        `/api/orgs/${orgSlug}/documents`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        toast.error("Failed to upload documents");
        return;
      }

      const uploadResult = await uploadResponse.json();
      const uploadedDocumentIds = uploadResult.documents.map((d: { id: string }) => d.id);

      if (uploadedDocumentIds.length === 0) {
        toast.error("No documents were uploaded");
        return;
      }

      // Link uploaded documents to transaction
      const linkResponse = await fetch(
        `/api/orgs/${orgSlug}/transactions/${transactionId}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentIds: uploadedDocumentIds }),
        }
      );

      if (!linkResponse.ok) {
        const result = await linkResponse.json();
        toast.error(result.error || "Failed to link documents");
        return;
      }

      toast.success(`${uploadedDocumentIds.length} document(s) uploaded and linked`);
      onDocumentsChange();
      setUploadDialogOpen(false);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsUploading(false);
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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Documents
          </CardTitle>
          <CardDescription>
            Receipts and supporting files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Existing
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setUploadDialogOpen(true)}
            >
              <Upload className="h-3 w-3 mr-1" />
              Upload & Link
            </Button>
          </div>

          {/* Document List */}
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No documents linked yet
            </p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-start gap-2">
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
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      {doc.type}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {formatFileSize(doc.fileSizeBytes)}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      asChild
                    >
                      <a
                        href={`/api/orgs/${orgSlug}/documents/${doc.id}/download?mode=inline`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      asChild
                    >
                      <a
                        href={`/api/orgs/${orgSlug}/documents/${doc.id}/download?mode=attachment`}
                        download
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleUnlink(doc.id)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Unlink
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Picker Dialog */}
      <DocumentPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        orgSlug={orgSlug}
        transactionId={transactionId}
        onDocumentsLinked={onDocumentsChange}
      />

      {/* Upload & Link Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload & Link Documents</DialogTitle>
            <DialogDescription>
              Upload new documents and automatically link them to this transaction
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt"
                onChange={(e) => handleUploadAndLink(e.target.files)}
                disabled={isUploading}
                className="hidden"
                id="upload-files"
              />
              <label
                htmlFor="upload-files"
                className="cursor-pointer block"
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {isUploading ? "Uploading..." : "Click to select files"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports: Images, PDF, Text (max 10MB per file)
                </p>
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
