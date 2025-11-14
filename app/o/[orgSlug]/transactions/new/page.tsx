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

export default function NewTransactionPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const [isLoading, setIsLoading] = React.useState(true);
  const [settings, setSettings] = React.useState<{ baseCurrency: string } | null>(null);
  const [categories, setCategories] = React.useState<Array<{ id: string; name: string; type: "INCOME" | "EXPENSE" }>>([]);
  const [accounts, setAccounts] = React.useState<Array<{ id: string; name: string; isDefault: boolean }>>([]);

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
          // User might not be admin, but that's okay for viewing
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, router]);

  if (isLoading || !settings) {
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
      <div>
        <h1 className="text-3xl font-bold">New Transaction</h1>
        <p className="text-muted-foreground">
          Create a new income or expense transaction
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Details</CardTitle>
          <CardDescription>
            Fill in the details below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionForm
            orgSlug={orgSlug}
            settings={settings}
            categories={categories}
            accounts={accounts}
          />
        </CardContent>
      </Card>
    </div>
  );
}
