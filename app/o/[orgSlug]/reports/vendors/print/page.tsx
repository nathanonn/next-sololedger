import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership } from "@/lib/org-helpers";
import { getVendorReport } from "@/lib/reporting-helpers";
import { getOrgBranding } from "@/lib/reporting-branding";
import { getYTDRange } from "@/lib/sololedger-formatters";
import { db } from "@/lib/db";
import { ReportHeader } from "@/components/features/reporting/report-header";
import { formatCurrency, formatDateRange } from "@/lib/sololedger-formatters";
import type { VendorReportRow } from "@/lib/reporting-types";

/**
 * Vendor Report Print Page
 * Print-optimized view of vendor/client breakdown report
 */

export default async function VendorReportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    view?: string;
  }>;
}): Promise<React.JSX.Element> {
  const { orgSlug } = await params;
  const queryParams = await searchParams;

  // Validate session
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/o/${orgSlug}/reports/vendors/print`);
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
  const viewParam = queryParams.view || "all";

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

  // Get vendor report
  let rows = await getVendorReport({
    organizationId: org.id,
    from,
    to,
  });

  // Filter by view if specified
  if (viewParam === "income") {
    rows = rows.filter((row) => row.totalIncomeBase > 0);
  } else if (viewParam === "expense") {
    rows = rows.filter((row) => row.totalExpenseBase > 0);
  }

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

  // Calculate totals
  const totalIncome = rows.reduce((sum, row) => sum + row.totalIncomeBase, 0);
  const totalExpenses = rows.reduce((sum, row) => sum + row.totalExpenseBase, 0);
  const totalNet = rows.reduce((sum, row) => sum + row.netBase, 0);

  // Determine report title based on view
  const reportTitle =
    viewParam === "income"
      ? "Client Report"
      : viewParam === "expense"
        ? "Vendor Report"
        : "Vendor/Client Report";

  // Render vendor row
  const renderVendorRow = (row: VendorReportRow) => (
    <tr key={row.vendorId || "unknown"}>
      <td className="py-2">{row.vendorName}</td>
      <td className="py-2 text-right">{formatAmount(row.totalIncomeBase)}</td>
      <td className="py-2 text-right">{formatAmount(row.totalExpenseBase)}</td>
      <td className="py-2 text-right font-medium">{formatAmount(row.netBase)}</td>
    </tr>
  );

  return (
    <div className="min-h-screen bg-white p-8 print:p-0">
      <div className="max-w-5xl mx-auto">
        {/* Report Header */}
        <ReportHeader
          branding={branding}
          reportTitle={reportTitle}
          periodDescription={periodDescription}
          baseCurrency={baseCurrency}
        />

        {/* Vendor/Client Table */}
        <div className="mb-8">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 font-semibold">
                  {viewParam === "income" ? "Client" : viewParam === "expense" ? "Vendor" : "Vendor/Client"}
                </th>
                <th className="text-right py-2 font-semibold">Income</th>
                <th className="text-right py-2 font-semibold">Expenses</th>
                <th className="text-right py-2 font-semibold">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(renderVendorRow)}
              <tr className="border-t-2 border-gray-300 font-bold">
                <td className="py-2">Total</td>
                <td className="py-2 text-right">{formatAmount(totalIncome)}</td>
                <td className="py-2 text-right">{formatAmount(totalExpenses)}</td>
                <td className="py-2 text-right">{formatAmount(totalNet)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mb-8 pt-4 border-t-4 border-gray-900">
          <table className="w-full">
            <tbody>
              <tr className="text-xl font-bold">
                <td className="py-3">
                  {totalNet >= 0 ? "Net Profit" : "Net Loss"}
                </td>
                <td className="py-3 text-right">
                  {formatAmount(Math.abs(totalNet))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

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
              size: A4 landscape;
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
