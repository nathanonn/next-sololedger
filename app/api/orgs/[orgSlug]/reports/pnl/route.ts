/**
 * P&L API route
 * GET/POST /api/orgs/[orgSlug]/reports/pnl
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership } from "@/lib/org-helpers";
import { getProfitAndLoss } from "@/lib/reporting-helpers";
import { db } from "@/lib/db";
import type { PnLConfig, PnLDateMode, PnLDetailLevel } from "@/lib/reporting-types";

export const runtime = "nodejs";

/**
 * GET handler for P&L report
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ orgSlug: string }> }
) {
  try {
    const { orgSlug } = await context.params;

    // Authenticate user
    const user = await getCurrentUser();
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
    const dateMode = (searchParams.get("dateMode") || "fiscalYear") as PnLDateMode;
    const customFrom = searchParams.get("customFrom") || undefined;
    const customTo = searchParams.get("customTo") || undefined;
    const detailLevel = (searchParams.get("detailLevel") || "summary") as PnLDetailLevel;

    // Build P&L config
    const config: PnLConfig = {
      organizationId: org.id,
      fiscalYearStartMonth: settings.fiscalYearStartMonth || 1,
      dateMode,
      customFrom,
      customTo,
      detailLevel,
    };

    // Get P&L data
    const result = await getProfitAndLoss(config);

    // Return result with org settings
    return NextResponse.json({
      ...result,
      baseCurrency: settings.baseCurrency || "MYR",
      dateFormat: settings.dateFormat || "DD_MM_YYYY",
      decimalSeparator: settings.decimalSeparator || "DOT",
      thousandsSeparator: settings.thousandsSeparator || "COMMA",
    });
  } catch (error) {
    console.error("P&L API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST handler for P&L report (alternative to GET)
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ orgSlug: string }> }
) {
  try {
    const { orgSlug } = await context.params;

    // Authenticate user
    const user = await getCurrentUser();
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

    // Parse request body
    const body = await req.json();
    const dateMode = (body.dateMode || "fiscalYear") as PnLDateMode;
    const customFrom = body.customFrom || undefined;
    const customTo = body.customTo || undefined;
    const detailLevel = (body.detailLevel || "summary") as PnLDetailLevel;

    // Build P&L config
    const config: PnLConfig = {
      organizationId: org.id,
      fiscalYearStartMonth: settings.fiscalYearStartMonth || 1,
      dateMode,
      customFrom,
      customTo,
      detailLevel,
    };

    // Get P&L data
    const result = await getProfitAndLoss(config);

    // Return result with org settings
    return NextResponse.json({
      ...result,
      baseCurrency: settings.baseCurrency || "MYR",
      dateFormat: settings.dateFormat || "DD_MM_YYYY",
      decimalSeparator: settings.decimalSeparator || "DOT",
      thousandsSeparator: settings.thousandsSeparator || "COMMA",
    });
  } catch (error) {
    console.error("P&L API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
