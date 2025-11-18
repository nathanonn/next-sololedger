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
  Upload,
  Trash2,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  File,
  Paperclip,
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
  uploadedBy: {
    id: string;
    name: string | null;
    email: string;
  };
  isLinked: boolean;
  linkedTransactionCount: number;
  linkedTransactions?: Array<{
    id: string;
    date: string;
    description: string;
    amountBase: string;
    currencyBase: string | null;
    type: string;
  }>;
}

interface DocumentsResponse {
  items: Document[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export default function DocumentsPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;

  const [isLoading, setIsLoading] = React.useState(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalItems, setTotalItems] = React.useState(0);

  // Filters
  const [dateFromFilter, setDateFromFilter] = React.useState<string>("");
  const [dateToFilter, setDateToFilter] = React.useState<string>("");
  const [linkedFilter, setLinkedFilter] = React.useState<string>("all");
  const [fileTypeFilter, setFileTypeFilter] = React.useState<string>("all");
  const [searchFilter, setSearchFilter] = React.useState<string>("");
  const [vendorFilter, setVendorFilter] = React.useState<string>("all");
  const [clientFilter, setClientFilter] = React.useState<string>("all");
  const [amountMinFilter, setAmountMinFilter] = React.useState<string>("");
  const [amountMaxFilter, setAmountMaxFilter] = React.useState<string>("");
  const [uploaderFilter, setUploaderFilter] = React.useState<string>("all");

  // Lookup data for filters
  const [vendors, setVendors] = React.useState<Array<{ id: string; name: string }>>([]);
  const [clients, setClients] = React.useState<Array<{ id: string; name: string }>>([]);
  const [uploaders, setUploaders] = React.useState<Array<{ id: string; name: string | null; email: string }>>([]);

  // Upload state
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load documents
  const loadDocuments = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: "20",
      });

      if (dateFromFilter) queryParams.set("dateFrom", dateFromFilter);
      if (dateToFilter) queryParams.set("dateTo", dateToFilter);
      if (linkedFilter !== "all") queryParams.set("linked", linkedFilter);
      if (fileTypeFilter !== "all") queryParams.set("fileType", fileTypeFilter);
      if (searchFilter) queryParams.set("q", searchFilter);
      if (vendorFilter !== "all") queryParams.set("vendorId", vendorFilter);
      if (clientFilter !== "all") queryParams.set("clientId", clientFilter);
      if (amountMinFilter) queryParams.set("amountMin", amountMinFilter);
      if (amountMaxFilter) queryParams.set("amountMax", amountMaxFilter);
      if (uploaderFilter !== "all") queryParams.set("uploaderId", uploaderFilter);

      const response = await fetch(
        `/api/orgs/${orgSlug}/documents?${queryParams.toString()}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Organization not found");
          router.push("/");
          return;
        }
        throw new Error("Failed to fetch documents");
      }

      const data: DocumentsResponse = await response.json();
      setDocuments(data.items);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalItems);
    } catch (error) {
      console.error("Error loading documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  }, [orgSlug, page, dateFromFilter, dateToFilter, linkedFilter, fileTypeFilter, searchFilter, vendorFilter, clientFilter, amountMinFilter, amountMaxFilter, uploaderFilter, router]);

  React.useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Load lookup data for filters
  React.useEffect(() => {
    const loadLookups = async () => {
      try {
        const [vendorsRes, clientsRes, membersRes] = await Promise.all([
          fetch(`/api/orgs/${orgSlug}/vendors`),
          fetch(`/api/orgs/${orgSlug}/clients`),
          fetch(`/api/orgs/${orgSlug}/members?pageSize=100`),
        ]);

        if (vendorsRes.ok) {
          const vendorsData = await vendorsRes.json();
          setVendors(vendorsData);
        }

        if (clientsRes.ok) {
          const clientsData = await clientsRes.json();
          setClients(clientsData);
        }

        if (membersRes.ok) {
          const membersData = await membersRes.json();
          setUploaders(membersData.members || []);
        }
      } catch (error) {
        console.error("Error loading lookup data:", error);
        // Non-critical, so just log
      }
    };

    loadLookups();
  }, [orgSlug]);

  // Handle file upload
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch(`/api/orgs/${orgSlug}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload documents");
      }

      const data = await response.json();

      if (data.documents && data.documents.length > 0) {
        toast.success(
          `Successfully uploaded ${data.documents.length} document(s)`
        );
      }

      if (data.errors && data.errors.length > 0) {
        data.errors.forEach((error: { filename: string; error: string }) => {
          toast.error(`${error.filename}: ${error.error}`);
        });
      }

      // Reload documents
      await loadDocuments();

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading documents:", error);
      toast.error("Failed to upload documents");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle delete
  const handleDelete = async (documentId: string) => {
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
      await loadDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
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
          <div className="text-muted-foreground">Loading documents...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">
          Manage your receipts and financial documents
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,application/pdf,text/plain"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {isUploading ? "Uploading..." : "Upload Documents"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/o/${orgSlug}/documents/trash`}>
            <Trash2 className="mr-2 h-4 w-4" />
            Trash
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Date From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFromFilter}
                onChange={(e) => {
                  setDateFromFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">Date To</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateToFilter}
                onChange={(e) => {
                  setDateToFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linked">Linked Status</Label>
              <Select
                value={linkedFilter}
                onValueChange={(value) => {
                  setLinkedFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="linked">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Documents</SelectItem>
                  <SelectItem value="linked">Linked Only</SelectItem>
                  <SelectItem value="unlinked">Unlinked Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fileType">File Type</Label>
              <Select
                value={fileTypeFilter}
                onValueChange={(value) => {
                  setFileTypeFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="fileType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="pdf">PDFs</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Select
                value={vendorFilter}
                onValueChange={(value) => {
                  setVendorFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="vendor">
                  <SelectValue placeholder="All Vendors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Select
                value={clientFilter}
                onValueChange={(value) => {
                  setClientFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="client">
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amountMin">Min Amount</Label>
              <Input
                id="amountMin"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amountMinFilter}
                onChange={(e) => {
                  setAmountMinFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amountMax">Max Amount</Label>
              <Input
                id="amountMax"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amountMaxFilter}
                onChange={(e) => {
                  setAmountMaxFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="uploader">Uploaded By</Label>
              <Select
                value={uploaderFilter}
                onValueChange={(value) => {
                  setUploaderFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="uploader">
                  <SelectValue placeholder="All Uploaders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Uploaders</SelectItem>
                  {uploaders.map((uploader) => (
                    <SelectItem key={uploader.id} value={uploader.id}>
                      {uploader.name || uploader.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              type="text"
              placeholder="Search by filename, vendor, text..."
              value={searchFilter}
              onChange={(e) => {
                setSearchFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDateFromFilter("");
                setDateToFilter("");
                setLinkedFilter("all");
                setFileTypeFilter("all");
                setSearchFilter("");
                setVendorFilter("all");
                setClientFilter("all");
                setAmountMinFilter("");
                setAmountMaxFilter("");
                setUploaderFilter("all");
                setPage(1);
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Documents ({totalItems})
          </CardTitle>
          <CardDescription>
            {isLoading ? "Loading..." : `Showing ${documents.length} of ${totalItems} documents`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No documents found</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Upload documents to get started
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => {
                const FileIcon = getFileIcon(doc.mimeType);
                const displayDate = doc.documentDate || doc.uploadedAt;

                return (
                  <div
                    key={doc.id}
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
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
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <Link href={`/o/${orgSlug}/documents/${doc.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a
                              href={`/api/orgs/${orgSlug}/documents/${doc.id}/download?mode=attachment`}
                              download
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(doc.id)}
                          >
                            <Trash2 className="h-4 w-4" />
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
                          {new Date(displayDate).toLocaleDateString()}
                        </span>
                        {doc.isLinked && (
                          <Badge variant="outline" className="gap-1">
                            <Paperclip className="h-3 w-3" />
                            {doc.linkedTransactionCount} linked
                          </Badge>
                        )}
                      </div>

                      {doc.linkedTransactions && doc.linkedTransactions.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Linked to: {doc.linkedTransactions[0].description}
                          {doc.linkedTransactionCount > 1 && ` +${doc.linkedTransactionCount - 1} more`}
                        </div>
                      )}
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
