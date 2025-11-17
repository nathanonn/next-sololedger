import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership, isSuperadmin } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PnLReport } from "@/components/features/reporting/pnl-report";
import { CategoryReport } from "@/components/features/reporting/category-report";
import { VendorReport } from "@/components/features/reporting/vendor-report";
import { TransactionsExport } from "@/components/features/reporting/transactions-export";

/**
 * Reports page
 * Provides access to P&L, Category, Vendor reports and CSV export
 */

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<React.JSX.Element> {
  const { orgSlug } = await params;

  // Validate session
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/o/${orgSlug}/reports`);
  }

  // Get organization
  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    redirect("/");
  }

  // Check if user is superadmin
  const userIsSuperadmin = await isSuperadmin(user.id);

  // Require membership (all members can view reports)
  const membership = userIsSuperadmin ? null : await requireMembership(user.id, org.id);

  // Check if user is admin/superadmin (for export permissions)
  const isAdmin = userIsSuperadmin || membership?.role === "admin";

  // Get organization settings
  const settings = await db.organizationSettings.findUnique({
    where: { organizationId: org.id },
  });

  if (!settings) {
    redirect(`/o/${orgSlug}/dashboard`);
  }

  const baseCurrency = settings.baseCurrency || "MYR";
  const dateFormat = settings.dateFormat || "DD_MM_YYYY";
  const fiscalYearStartMonth = settings.fiscalYearStartMonth || 1;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Overview of profit & loss, category, vendor and export reports.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pnl" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pnl">Profit & Loss</TabsTrigger>
          <TabsTrigger value="categories">Category Report</TabsTrigger>
          <TabsTrigger value="vendors">Vendor Report</TabsTrigger>
          <TabsTrigger value="export">Transactions CSV Export</TabsTrigger>
        </TabsList>

        <TabsContent value="pnl" className="space-y-6">
          <PnLReport
            orgSlug={orgSlug}
            baseCurrency={baseCurrency}
            dateFormat={dateFormat}
            fiscalYearStartMonth={fiscalYearStartMonth}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <CategoryReport
            orgSlug={orgSlug}
            baseCurrency={baseCurrency}
            dateFormat={dateFormat}
            fiscalYearStartMonth={fiscalYearStartMonth}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="vendors" className="space-y-6">
          <VendorReport
            orgSlug={orgSlug}
            baseCurrency={baseCurrency}
            dateFormat={dateFormat}
            fiscalYearStartMonth={fiscalYearStartMonth}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <TransactionsExport orgSlug={orgSlug} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
