import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, getUserMembership, isSuperadmin } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { DashboardClient } from "@/components/features/dashboard/dashboard-client";
import type { DashboardTransactionFilters } from "@/lib/dashboard-types";
import {
  getDashboardSummary,
  getDashboardMonthlyTrends,
  getDashboardCategoryBreakdown,
  getDashboardLayoutForMembership,
} from "@/lib/dashboard-helpers";

/**
 * Business Dashboard with Analytics
 * Shows dynamic metrics, charts, and insights with customizable widgets
 */

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<React.JSX.Element> {
  const { orgSlug } = await params;
  const search = await searchParams;

  // Validate session and membership
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/o/${orgSlug}/dashboard`);
  }

  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    redirect("/");
  }

  const userIsSuperadmin = await isSuperadmin(user.id);
  const membership = await getUserMembership(user.id, org.id);

  if (!membership && !userIsSuperadmin) {
    redirect("/?error=not_a_member");
  }

  // Get organization settings
  const settings = await db.organizationSettings.findUnique({
    where: { organizationId: org.id },
  });

  if (!settings) {
    return (
      <div className="p-6">
        <div className="border rounded-lg p-6">
          <p className="text-center text-muted-foreground">
            Please complete onboarding to view your dashboard
          </p>
        </div>
      </div>
    );
  }

  // Parse filters from URL params
  const dateKind = (search.dateKind as string) || "ytd";
  const from = search.from as string | undefined;
  const to = search.to as string | undefined;
  const view = (search.view as string) || "both";
  const origin = (search.origin as string) || "all";
  const categoryIdsParam = search.categoryIds as string | undefined;
  const categoryIds = categoryIdsParam ? categoryIdsParam.split(",").filter(Boolean) : [];

  // Build dashboard filters
  const filters: DashboardTransactionFilters = {
    organizationId: org.id,
    dateRange: {
      kind: (dateKind as "ytd" | "last30" | "thisMonth" | "lastMonth" | "custom") || "ytd",
      from,
      to,
    },
    categoryIds,
    view: (view as "income" | "expense" | "both") || "both",
    originCurrency: origin,
    fiscalYearStartMonth: settings.fiscalYearStartMonth,
  };

  // Fetch dashboard data in parallel
  const [summary, monthlyTrends, categoryBreakdown, categories, recentTransactions, userLayout] =
    await Promise.all([
      getDashboardSummary(filters),
      getDashboardMonthlyTrends(filters),
      getDashboardCategoryBreakdown(filters, 10),
      db.category.findMany({
        where: {
          organizationId: org.id,
          active: true,
        },
        select: {
          id: true,
          name: true,
          type: true,
        },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      }),
      db.transaction.findMany({
        where: {
          organizationId: org.id,
          deletedAt: null,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          account: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 20,
      }),
      getDashboardLayoutForMembership(user.id, org.id),
    ]);

  // Get available origin currencies from recent transactions
  const currencySet = new Set<string>();
  recentTransactions.forEach((t) => {
    if (t.currencySecondary) {
      currencySet.add(t.currencySecondary);
    }
  });
  const availableOriginCurrencies = Array.from(currencySet).sort();

  // Pass all data to client component
  return (
    <DashboardClient
      orgSlug={orgSlug}
      orgName={org.name}
      settings={{
        baseCurrency: settings.baseCurrency,
        fiscalYearStartMonth: settings.fiscalYearStartMonth,
        dateFormat: settings.dateFormat,
        decimalSeparator: settings.decimalSeparator,
        thousandsSeparator: settings.thousandsSeparator,
      }}
      summary={summary}
      monthlyTrends={monthlyTrends}
      categoryBreakdown={categoryBreakdown}
      categories={categories}
      recentTransactions={recentTransactions.map((t) => ({
        id: t.id,
        type: t.type,
        status: t.status,
        date: t.date.toISOString().split("T")[0],
        description: t.description,
        amountBase: Number(t.amountBase),
        currencyBase: settings.baseCurrency,
        category: t.category,
        account: t.account,
        hasDocuments: false, // TODO: Add document relation check
        clientName: t.clientName,
        vendorName: t.vendorName,
      }))}
      availableOriginCurrencies={availableOriginCurrencies}
      initialFilters={{
        dateRange: {
          kind: (dateKind as "ytd" | "last30" | "thisMonth" | "lastMonth" | "custom") || "ytd",
          from,
          to,
        },
        categoryIds,
        view: (view as "income" | "expense" | "both") || "both",
        originCurrency: origin,
      }}
      userLayout={userLayout}
    />
  );
}
