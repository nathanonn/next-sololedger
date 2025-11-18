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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  RotateCcw,
  Trash2,
  FileText,
  Image as ImageIcon,
  File,
} from "lucide-react";

interface Document {
  id: string;
  filenameOriginal: string;
  displayName: string;
  mimeType: string;
  fileSizeBytes: number;
  type: "RECEIPT" | "INVOICE" | "BANK_STATEMENT" | "OTHER";
  documentDate: string | null;
  uploadedAt: string;
  deletedAt: string;
  uploadedBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface DocumentsResponse {
  items: Document[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export default function DocumentsTrashPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;

  const [isLoading, setIsLoading] = React.useState(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalItems, setTotalItems] = React.useState(0);
  const [searchFilter, setSearchFilter] = React.useState<string>("");

  // Load trash documents
  const loadDocuments = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: "20",
      });

      if (searchFilter) queryParams.set("q", searchFilter);

      const response = await fetch(
        `/api/orgs/${orgSlug}/documents/trash?${queryParams.toString()}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Organization not found");
          router.push("/");
          return;
        }
        throw new Error("Failed to fetch trash documents");
      }

      const data: DocumentsResponse = await response.json();
      setDocuments(data.items);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalItems);
    } catch (error) {
      console.error("Error loading trash documents:", error);
      toast.error("Failed to load trash documents");
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  }, [orgSlug, page, searchFilter, router]);

  React.useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Handle restore
  const handleRestore = async (documentId: string) => {
    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/documents/${documentId}/restore`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to restore document");
      }

      toast.success("Document restored");
      await loadDocuments();
    } catch (error) {
      console.error("Error restoring document:", error);
      toast.error("Failed to restore document");
    }
  };

  // Handle permanent delete
  const handlePermanentDelete = async (documentId: string) => {
    if (!confirm("Permanently delete this document? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/documents/${documentId}/hard`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to permanently delete document");
      }

      toast.success("Document permanently deleted");
      await loadDocuments();
    } catch (error) {
      console.error("Error permanently deleting document:", error);
      toast.error("Failed to permanently delete document");
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get file icon
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return ImageIcon;
    if (mimeType === "application/pdf") return FileText;
    return File;
  };

  // Get document type badge color
  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "RECEIPT":
        return "bg-blue-100 text-blue-800";
      case "INVOICE":
        return "bg-green-100 text-green-800";
      case "BANK_STATEMENT":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-muted-foreground">Loading trash...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents Trash</h1>
          <p className="text-muted-foreground">
            Deleted documents remain here until you restore or delete them permanently
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/o/${orgSlug}/documents`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Documents
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="space-y-2">
        <Label htmlFor="search">Search</Label>
        <Input
          id="search"
          type="text"
          placeholder="Search by filename..."
          value={searchFilter}
          onChange={(e) => {
            setSearchFilter(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Deleted Documents ({totalItems})</CardTitle>
          <CardDescription>
            {isLoading ? "Loading..." : `Showing ${documents.length} of ${totalItems} documents`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-12">
              <Trash2 className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Trash is empty</h3>
              <p className="text-sm text-muted-foreground mt-2">
                No deleted documents
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => {
                const FileIcon = getFileIcon(doc.mimeType);

                return (
                  <div
                    key={doc.id}
                    className="flex items-start gap-4 p-4 border rounded-lg"
                  >
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                        <FileIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">
                            {doc.displayName}
                          </h4>
                          <p className="text-sm text-muted-foreground truncate">
                            {doc.filenameOriginal}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestore(doc.id)}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Restore
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handlePermanentDelete(doc.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Permanently
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={getTypeBadgeColor(doc.type)}>
                          {doc.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(doc.fileSizeBytes)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Deleted: {new Date(doc.deletedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1 || isLoading}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
