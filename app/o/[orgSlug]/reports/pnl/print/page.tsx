import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership, isSuperadmin } from "@/lib/org-helpers";
import { getProfitAndLoss } from "@/lib/reporting-helpers";
import { getOrgBranding } from "@/lib/reporting-branding";
import { db } from "@/lib/db";
import { ReportHeader } from "@/components/features/reporting/report-header";
import { formatCurrency, formatDateRange } from "@/lib/sololedger-formatters";
import type { PnLConfig, PnLDateMode, PnLDetailLevel, PnLCategoryRow } from "@/lib/reporting-types";

/**
 * P&L Print Page
 * Print-optimized view of Profit & Loss statement
 * Restricted to admins and superadmins only
 */

export default async function PnLPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{
    dateMode?: string;
    customFrom?: string;
    customTo?: string;
    detailLevel?: string;
  }>;
}): Promise<React.JSX.Element> {
  const { orgSlug } = await params;
  const queryParams = await searchParams;

  // Validate session
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/o/${orgSlug}/reports/pnl/print`);
  }

  // Get organization
  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    redirect("/");
  }

  // Check if user is superadmin
  const userIsSuperadmin = await isSuperadmin(user.id);

  // Require membership
  const membership = userIsSuperadmin ? null : await requireMembership(user.id, org.id);

  // Check if user is admin/superadmin (exports are admin-only)
  const isAdmin = userIsSuperadmin || membership?.role === "admin";

  // Require admin or superadmin for PDF exports
  if (!isAdmin) {
    redirect(`/o/${orgSlug}/reports`);
  }

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
  const dateMode = (queryParams.dateMode || "fiscalYear") as PnLDateMode;
  const customFrom = queryParams.customFrom;
  const customTo = queryParams.customTo;
  const detailLevel = (queryParams.detailLevel || "summary") as PnLDetailLevel;

  // Build P&L config
  const config: PnLConfig = {
    organizationId: org.id,
    fiscalYearStartMonth,
    dateMode,
    customFrom,
    customTo,
    detailLevel,
  };

  // Get P&L data
  const result = await getProfitAndLoss(config);

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
  const periodDescription = formatDateRange(
    result.currentPeriod.from,
    result.currentPeriod.to,
    dateFormat
  );

  // Render category row
  const renderCategoryRow = (row: PnLCategoryRow, isChild: boolean = false) => (
    <tr key={row.categoryId} className={isChild ? "text-sm" : "font-medium"}>
      <td className={`py-2 ${isChild ? "pl-6" : ""}`}>{row.name}</td>
      <td className="py-2 text-right">{formatAmount(row.totalBase)}</td>
    </tr>
  );

  return (
    <div className="min-h-screen bg-white p-8 print:p-0">
      <div className="max-w-4xl mx-auto">
        {/* Report Header */}
        <ReportHeader
          branding={branding}
          reportTitle="Profit & Loss Statement"
          periodDescription={periodDescription}
          baseCurrency={baseCurrency}
        />

        {/* Income Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3 text-gray-900">Income</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 font-semibold">Category</th>
                <th className="text-right py-2 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {result.incomeRows.map((row) => (
                <>
                  {renderCategoryRow(row, false)}
                  {detailLevel === "detailed" && row.children?.map((child) =>
                    renderCategoryRow(child, true)
                  )}
                </>
              ))}
              <tr className="border-t-2 border-gray-300 font-bold">
                <td className="py-2">Total Income</td>
                <td className="py-2 text-right">
                  {formatAmount(result.comparison.current.income)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Expenses Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3 text-gray-900">Expenses</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 font-semibold">Category</th>
                <th className="text-right py-2 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {result.expenseRows.map((row) => (
                <>
                  {renderCategoryRow(row, false)}
                  {detailLevel === "detailed" && row.children?.map((child) =>
                    renderCategoryRow(child, true)
                  )}
                </>
              ))}
              <tr className="border-t-2 border-gray-300 font-bold">
                <td className="py-2">Total Expenses</td>
                <td className="py-2 text-right">
                  {formatAmount(result.comparison.current.expenses)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Net Profit/Loss Section */}
        <div className="mb-8 pt-4 border-t-4 border-gray-900">
          <table className="w-full">
            <tbody>
              <tr className="text-xl font-bold">
                <td className="py-3">
                  {result.comparison.current.net >= 0 ? "Net Profit" : "Net Loss"}
                </td>
                <td className="py-3 text-right">
                  {formatAmount(Math.abs(result.comparison.current.net))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t text-sm text-gray-500 text-center print:fixed print:bottom-0 print:left-0 print:right-0 print:p-4">
          {branding.displayName} • Generated on {new Date().toLocaleDateString("en-GB")}
        </div>
      </div>
    </div>
  );
}
