/**
 * Category Report API route
 * GET /api/orgs/[orgSlug]/reports/categories
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership } from "@/lib/org-helpers";
import { getCategoryReport } from "@/lib/reporting-helpers";
import { getYTDRange } from "@/lib/sololedger-formatters";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET handler for Category report
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ orgSlug: string }> }
) {
  try {
    const { orgSlug } = await context.params;

    // Authenticate user
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get organization
    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Require membership
    await requireMembership(user.id, org.id);

    // Get financial settings
    const settings = await db.organizationSettings.findUnique({
      where: { organizationId: org.id },
    });

    if (!settings) {
      return NextResponse.json(
        { error: "Organization settings not found" },
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const typeParam = searchParams.get("type") || "both";

    // Default to YTD if no dates provided
    let from: Date;
    let to: Date;

    if (fromParam && toParam) {
      from = new Date(fromParam);
      to = new Date(toParam);
    } else {
      // Default to YTD
      const ytdRange = getYTDRange(settings.fiscalYearStartMonth || 1);
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

    // Return result with org settings
    return NextResponse.json({
      ...result,
      baseCurrency: settings.baseCurrency || "MYR",
      dateFormat: settings.dateFormat || "DD_MM_YYYY",
      decimalSeparator: settings.decimalSeparator || "DOT",
      thousandsSeparator: settings.thousandsSeparator || "COMMA",
      period: {
        from: from.toISOString().split("T")[0],
        to: to.toISOString().split("T")[0],
      },
    });
  } catch (error) {
    console.error("Category Report API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
