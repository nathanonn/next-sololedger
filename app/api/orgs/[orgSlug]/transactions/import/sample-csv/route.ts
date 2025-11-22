/**
 * Sample CSV Download API
 * GET: Generate and download a sample CSV file for transaction imports
 * Customized with org's categories, accounts, and base currency
 */

import { NextResponse } from "next/server";
import { stringify } from "csv-stringify/sync";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import type { DateFormat } from "@prisma/client";

export const runtime = "nodejs";

/**
 * Format date according to specified format
 */
function formatSampleDate(date: Date, format: DateFormat): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  switch (format) {
    case "DD_MM_YYYY":
      return `${day}/${month}/${year}`;
    case "MM_DD_YYYY":
      return `${month}/${day}/${year}`;
    case "YYYY_MM_DD":
      return `${year}-${month}-${day}`;
    default:
      return `${day}/${month}/${year}`;
  }
}

/**
 * GET /api/orgs/[orgSlug]/transactions/import/sample-csv
 * Download sample CSV file
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    const { orgSlug } = await params;
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Verify user is a member
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Organization membership required" },
        { status: 403 }
      );
    }

    // Validate API key organization access
    if (!validateApiKeyOrgAccess(user, org.id)) {
      return NextResponse.json(
        { error: "API key not authorized for this organization" },
        { status: 403 }
      );
    }

    // Get date format from query params (defaults to org settings)
    const url = new URL(request.url);
    const dateFormatParam = url.searchParams.get("dateFormat") as DateFormat | null;

    // Load organization settings
    const settings = await db.organizationSettings.findUnique({
      where: { organizationId: org.id },
    });

    if (!settings) {
      return NextResponse.json(
        { error: "Organization settings not found" },
        { status: 404 }
      );
    }

    const dateFormat = dateFormatParam || settings.dateFormat || "DD_MM_YYYY";
    const baseCurrency = settings.baseCurrency;

    // Fetch some categories (2 expense, 1 income)
    const expenseCategories = await db.category.findMany({
      where: {
        organizationId: org.id,
        active: true,
        type: "EXPENSE",
      },
      select: { name: true },
      take: 2,
    });

    const incomeCategories = await db.category.findMany({
      where: {
        organizationId: org.id,
        active: true,
        type: "INCOME",
      },
      select: { name: true },
      take: 1,
    });

    // Fetch some accounts
    const accounts = await db.account.findMany({
      where: {
        organizationId: org.id,
        active: true,
      },
      select: { name: true },
      take: 3,
    });

    // Generate sample dates (today, yesterday, last week, last month, 2 months ago)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const twoMonthsAgo = new Date(today);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    // Define CSV headers (all supported fields)
    const headers = [
      "date",
      "amount",
      "currency",
      "description",
      "category",
      "account",
      "type",
      "vendor",
      "client",
      "notes",
      "tags",
      "secondaryAmount",
      "secondaryCurrency",
      "document",
    ];

    // Generate sample rows
    const sampleRows = [
      // Expense 1: Office supplies
      [
        formatSampleDate(yesterday, dateFormat),
        "45.99",
        baseCurrency,
        "Office supplies - printer paper and pens",
        expenseCategories[0]?.name || "Office Supplies",
        accounts[0]?.name || "Business Checking",
        "EXPENSE",
        "Office Depot",
        "",
        "Bulk order for office",
        "office;supplies",
        "",
        "",
        "Office/receipt-2024-001.pdf",
      ],
      // Expense 2: Coffee meeting
      [
        formatSampleDate(lastWeek, dateFormat),
        "28.50",
        baseCurrency,
        "Coffee meeting with potential client",
        expenseCategories[1]?.name || "Meals & Entertainment",
        accounts[0]?.name || "Business Checking",
        "EXPENSE",
        "Starbucks",
        "",
        "Discussed Q4 project proposal",
        "networking;client-meeting",
        "",
        "",
        "",
      ],
      // Income 1: Client payment
      [
        formatSampleDate(lastMonth, dateFormat),
        "2500.00",
        baseCurrency,
        "Project completion payment",
        incomeCategories[0]?.name || "Consulting Income",
        accounts[1]?.name || "Business Savings",
        "INCOME",
        "",
        "Acme Corporation",
        "Final invoice #INV-2024-123",
        "consulting;project-alpha",
        "",
        "",
        "Invoices/INV-2024-123.pdf",
      ],
      // Expense 3: Dual-currency transaction (software subscription)
      [
        formatSampleDate(twoMonthsAgo, dateFormat),
        "79.00",
        "USD",
        "Monthly software subscription",
        expenseCategories[0]?.name || "Software & Tools",
        accounts[0]?.name || "Business Checking",
        "EXPENSE",
        "Adobe",
        "",
        "Creative Cloud subscription",
        "software;monthly-recurring",
        baseCurrency === "USD" ? "" : "95.00",
        baseCurrency === "USD" ? "" : baseCurrency,
        "",
      ],
      // Income 2: Another client payment
      [
        formatSampleDate(lastWeek, dateFormat),
        "1200.00",
        baseCurrency,
        "Website design retainer",
        incomeCategories[0]?.name || "Design Services",
        accounts[0]?.name || "Business Checking",
        "INCOME",
        "",
        "StartupXYZ Inc",
        "Monthly retainer payment",
        "design;retainer;web",
        "",
        "",
        "",
      ],
    ];

    // Generate CSV content
    const csvContent = stringify([headers, ...sampleRows], {
      quoted: true,
    });

    // Return as downloadable file
    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="sample-transactions-import-${orgSlug}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error generating sample CSV:", error);
    return NextResponse.json(
      {
        error: "Failed to generate sample CSV",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
