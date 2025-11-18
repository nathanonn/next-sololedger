"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TransactionForm } from "@/components/features/transactions/transaction-form";
import { TransactionDocumentsPanel } from "@/components/features/transactions/transaction-documents-panel";
import { ArrowLeft, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Category {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  sortOrder: number;
  parentId: string | null;
}

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

interface Transaction {
  id: string;
  type: "INCOME" | "EXPENSE";
  status: "DRAFT" | "POSTED";
  date: string;
  description: string;
  amountBase: number;
  currencyBase: string;
  amountSecondary: number | null;
  currencySecondary: string | null;
  categoryId: string;
  accountId: string;
  vendorId: string | null;
  vendorName: string | null;
  clientId: string | null;
  clientName: string | null;
  notes: string | null;
  category: { id: string; name: string };
  account: { id: string; name: string };
  vendor: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  documents: Document[];
}

export default function EditTransactionPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const transactionId = params.id as string;
  const [isLoading, setIsLoading] = React.useState(true);
  const [settings, setSettings] = React.useState<{ baseCurrency: string } | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [accounts, setAccounts] = React.useState<Array<{ id: string; name: string; isDefault: boolean }>>([]);
  const [transaction, setTransaction] = React.useState<Transaction | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  async function loadData() {
    try {
      setIsLoading(true);

      // Load settings
      const settingsResponse = await fetch(
        `/api/orgs/${orgSlug}/settings/financial`
      );
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setSettings(settingsData.settings);
      } else if (settingsResponse.status === 404) {
        toast.error("Organization not found");
        router.push("/");
        return;
      } else {
        toast.error("Failed to load organization settings");
        return;
      }

      // Load categories
      const categoriesResponse = await fetch(
        `/api/orgs/${orgSlug}/categories`
      );
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json();
        setCategories(
          categoriesData.categories.filter((c: { active: boolean }) => c.active)
        );
      }

      // Load accounts
      const accountsResponse = await fetch(
        `/api/orgs/${orgSlug}/accounts`
      );
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        setAccounts(
          accountsData.accounts.filter((a: { active: boolean }) => a.active)
        );
      } else {
        setAccounts([]);
      }

      // Load transaction
      const transactionResponse = await fetch(
        `/api/orgs/${orgSlug}/transactions/${transactionId}`
      );
      if (transactionResponse.ok) {
        const transactionData = await transactionResponse.json();
        setTransaction(transactionData.transaction);
      } else if (transactionResponse.status === 404) {
        toast.error("Transaction not found");
        router.push(`/o/${orgSlug}/transactions`);
        return;
      } else {
        toast.error("Failed to load transaction");
        return;
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, transactionId, router]);

  // Scroll to documents section if hash is present
  React.useEffect(() => {
    if (window.location.hash === "#documents") {
      setTimeout(() => {
        const element = document.getElementById("documents");
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  }, [transaction]);

  async function handleDelete() {
    try {
      setIsDeleting(true);

      const response = await fetch(
        `/api/orgs/${orgSlug}/transactions/${transactionId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error || "Failed to delete transaction");
        return;
      }

      toast.success("Transaction deleted");
      router.push(`/o/${orgSlug}/transactions`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  if (isLoading || !settings || !transaction) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if we have the necessary data
  if (categories.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No active categories found.{" "}
              <Link
                href={`/o/${orgSlug}/settings/categories`}
                className="underline"
              >
                Create categories first
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No active accounts found.{" "}
              <Link
                href={`/o/${orgSlug}/settings/accounts`}
                className="underline"
              >
                Create accounts first
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/o/${orgSlug}/transactions`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Transaction</h1>
            <p className="text-muted-foreground">
              Update transaction details
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Transaction Form - 2/3 width */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Details</CardTitle>
              <CardDescription>
                Update the details below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionForm
                orgSlug={orgSlug}
                settings={settings}
                categories={categories}
                accounts={accounts}
                initialData={transaction}
                transactionId={transactionId}
              />
            </CardContent>
          </Card>
        </div>

        {/* Documents Panel - 1/3 width */}
        <div className="lg:col-span-1" id="documents">
          <TransactionDocumentsPanel
            orgSlug={orgSlug}
            transactionId={transactionId}
            documents={transaction.documents}
            onDocumentsChange={loadData}
          />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              This transaction will be moved to Trash. You can restore it later
              from the Trash. Note: Any linked documents will be unlinked.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
