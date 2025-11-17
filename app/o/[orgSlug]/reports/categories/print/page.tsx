import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership } from "@/lib/org-helpers";
import { getCategoryReport } from "@/lib/reporting-helpers";
import { getOrgBranding } from "@/lib/reporting-branding";
import { getYTDRange } from "@/lib/sololedger-formatters";
import { db } from "@/lib/db";
import { ReportHeader } from "@/components/features/reporting/report-header";
import { formatCurrency, formatDateRange } from "@/lib/sololedger-formatters";
import type { CategoryReportRow } from "@/lib/reporting-types";

/**
 * Category Report Print Page
 * Print-optimized view of category breakdown report
 */

export default async function CategoryReportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    type?: string;
  }>;
}): Promise<React.JSX.Element> {
  const { orgSlug } = await params;
  const queryParams = await searchParams;

  // Validate session
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/o/${orgSlug}/reports/categories/print`);
  }

  // Get organization
  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    redirect("/");
  }

  // Require membership
  await requireMembership(user.id, org.id);

  // Get organization settings and branding
  const [settings, branding] = await Promise.all([
    db.organizationSettings.findUnique({
      where: { organizationId: org.id },
    }),
    getOrgBranding(org.id),
  ]);

  if (!settings) {
    redirect(`/o/${orgSlug}/dashboard`);
  }

  const baseCurrency = settings.baseCurrency || "MYR";
  const decimalSeparator = settings.decimalSeparator || "DOT";
  const thousandsSeparator = settings.thousandsSeparator || "COMMA";
  const dateFormat = settings.dateFormat || "DD_MM_YYYY";
  const fiscalYearStartMonth = settings.fiscalYearStartMonth || 1;

  // Parse query parameters
  const fromParam = queryParams.from;
  const toParam = queryParams.to;
  const typeParam = queryParams.type || "both";

  // Default to YTD if no dates provided
  let from: Date;
  let to: Date;

  if (fromParam && toParam) {
    from = new Date(fromParam);
    to = new Date(toParam);
  } else {
    const ytdRange = getYTDRange(fiscalYearStartMonth);
    from = ytdRange.startDate;
    to = ytdRange.endDate;
  }

  // Map type parameter
  const typeFilter =
    typeParam === "income"
      ? ("INCOME" as const)
      : typeParam === "expense"
        ? ("EXPENSE" as const)
        : ("both" as const);

  // Get category report
  const result = await getCategoryReport({
    organizationId: org.id,
    from,
    to,
    typeFilter,
  });

  // Format currency helper
  const formatAmount = (amount: number) => {
    return formatCurrency(
      amount,
      baseCurrency,
      decimalSeparator,
      thousandsSeparator,
      2
    );
  };

  // Format period description
  const periodDescription = formatDateRange(from, to, dateFormat);

  // Split items by type
  const incomeItems = result.items.filter((item) => item.type === "INCOME");
  const expenseItems = result.items.filter((item) => item.type === "EXPENSE");

  // Calculate totals
  const totalIncome = incomeItems.reduce((sum, item) => sum + item.totalBase, 0);
  const totalExpenses = expenseItems.reduce((sum, item) => sum + item.totalBase, 0);

  // Render category row
  const renderCategoryRow = (row: CategoryReportRow) => (
    <tr key={row.categoryId} className={row.level === 1 ? "text-sm" : "font-medium"}>
      <td className={`py-2 ${row.level === 1 ? "pl-6" : ""}`}>{row.name}</td>
      <td className="py-2 text-center">{row.transactionCount}</td>
      <td className="py-2 text-right">{formatAmount(row.totalBase)}</td>
    </tr>
  );

  return (
    <div className="min-h-screen bg-white p-8 print:p-0">
      <div className="max-w-4xl mx-auto">
        {/* Report Header */}
        <ReportHeader
          branding={branding}
          reportTitle="Category Report"
          periodDescription={periodDescription}
          baseCurrency={baseCurrency}
        />

        {/* Income Section */}
        {(typeFilter === "both" || typeFilter === "INCOME") && incomeItems.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3 text-gray-900">Income Categories</h3>
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-2 font-semibold">Category</th>
                  <th className="text-center py-2 font-semibold">Transactions</th>
                  <th className="text-right py-2 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {incomeItems.map(renderCategoryRow)}
                <tr className="border-t-2 border-gray-300 font-bold">
                  <td className="py-2">Total Income</td>
                  <td className="py-2 text-center">
                    {incomeItems.reduce((sum, item) => sum + item.transactionCount, 0)}
                  </td>
                  <td className="py-2 text-right">{formatAmount(totalIncome)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Expense Section */}
        {(typeFilter === "both" || typeFilter === "EXPENSE") && expenseItems.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3 text-gray-900">Expense Categories</h3>
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-2 font-semibold">Category</th>
                  <th className="text-center py-2 font-semibold">Transactions</th>
                  <th className="text-right py-2 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {expenseItems.map(renderCategoryRow)}
                <tr className="border-t-2 border-gray-300 font-bold">
                  <td className="py-2">Total Expenses</td>
                  <td className="py-2 text-center">
                    {expenseItems.reduce((sum, item) => sum + item.transactionCount, 0)}
                  </td>
                  <td className="py-2 text-right">{formatAmount(totalExpenses)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Summary (only if showing both types) */}
        {typeFilter === "both" && (
          <div className="mb-8 pt-4 border-t-4 border-gray-900">
            <table className="w-full">
              <tbody>
                <tr className="text-xl font-bold">
                  <td className="py-3">
                    {totalIncome - totalExpenses >= 0 ? "Net Profit" : "Net Loss"}
                  </td>
                  <td className="py-3 text-right">
                    {formatAmount(Math.abs(totalIncome - totalExpenses))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t text-sm text-gray-500 text-center print:fixed print:bottom-0 print:left-0 print:right-0 print:p-4">
          {branding.displayName} • Generated on {new Date().toLocaleDateString("en-GB")}
        </div>

        {/* Print Styles */}
        <style jsx global>{`
          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }

            @page {
              margin: 2cm;
              size: A4;
            }

            .print\\:p-0 {
              padding: 0 !important;
            }

            .print\\:fixed {
              position: fixed;
            }

            .print\\:bottom-0 {
              bottom: 0;
            }

            .print\\:left-0 {
              left: 0;
            }

            .print\\:right-0 {
              right: 0;
            }

            .print\\:p-4 {
              padding: 1rem;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
