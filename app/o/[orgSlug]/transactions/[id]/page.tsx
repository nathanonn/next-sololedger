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
import { toast } from "sonner";
import { TransactionForm } from "@/components/features/transactions/transaction-form";

interface Category {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  sortOrder: number;
  parentId: string | null;
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
  const [transaction, setTransaction] = React.useState<{
    type: "INCOME" | "EXPENSE";
    status: "DRAFT" | "POSTED";
    amountOriginal: number;
    currencyOriginal: string;
    exchangeRateToBase: number;
    date: string;
    description: string;
    categoryId: string;
    accountId: string;
    vendorName?: string;
    notes?: string;
  } | null>(null);

  React.useEffect(() => {
    async function loadData() {
      try {
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

        // Load transaction
        const transactionResponse = await fetch(
          `/api/orgs/${orgSlug}/transactions/${transactionId}`
        );
        if (transactionResponse.ok) {
          const transactionData = await transactionResponse.json();
          setTransaction({
            type: transactionData.transaction.type,
            status: transactionData.transaction.status,
            amountOriginal: Number(transactionData.transaction.amountOriginal),
            currencyOriginal: transactionData.transaction.currencyOriginal,
            exchangeRateToBase: Number(
              transactionData.transaction.exchangeRateToBase
            ),
            date: transactionData.transaction.date,
            description: transactionData.transaction.description,
            categoryId: transactionData.transaction.categoryId,
            accountId: transactionData.transaction.accountId,
            vendorName: transactionData.transaction.vendorName || undefined,
            notes: transactionData.transaction.notes || undefined,
          });
        } else {
          toast.error("Transaction not found");
          router.push(`/o/${orgSlug}/transactions`);
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
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [orgSlug, transactionId, router]);

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
      <div>
        <h1 className="text-3xl font-bold">Edit Transaction</h1>
        <p className="text-muted-foreground">
          Update transaction details
        </p>
      </div>

      {/* Form */}
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
  );
}
