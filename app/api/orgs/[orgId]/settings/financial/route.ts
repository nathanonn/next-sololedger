import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";
import { requireAdminOrSuperadmin } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * PATCH /api/orgs/[orgId]/settings/financial
 * Update financial configuration for an organization
 * Admin-only access
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
): Promise<Response> {
  try {
    // CSRF validation
    const csrfError = await validateCsrf(request);
    if (csrfError) {
      return NextResponse.json({ error: csrfError }, { status: 403 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;

    // Require admin or superadmin access
    try {
      await requireAdminOrSuperadmin(user.id, orgId);
    } catch {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Validate request body
    const financialSettingsSchema = z.object({
      baseCurrency: z
        .string()
        .length(3, "Currency code must be 3 characters")
        .toUpperCase(),
      fiscalYearStartMonth: z
        .number()
        .int()
        .min(1)
        .max(12, "Month must be between 1 and 12"),
      dateFormat: z.enum(["DD_MM_YYYY", "MM_DD_YYYY", "YYYY_MM_DD"]),
      decimalSeparator: z.enum(["DOT", "COMMA"]),
      thousandsSeparator: z.enum(["COMMA", "DOT", "SPACE", "NONE"]),
    });

    const body = await request.json();
    const validation = financialSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Validate separator combination
    if (
      data.decimalSeparator === "DOT" &&
      data.thousandsSeparator === "DOT"
    ) {
      return NextResponse.json(
        {
          error:
            "Decimal and thousands separators cannot both be DOT",
        },
        { status: 400 }
      );
    }

    if (
      data.decimalSeparator === "COMMA" &&
      data.thousandsSeparator === "COMMA"
    ) {
      return NextResponse.json(
        {
          error:
            "Decimal and thousands separators cannot both be COMMA",
        },
        { status: 400 }
      );
    }

    // Upsert organization settings
    const settings = await db.organizationSettings.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        businessType: "Other", // Will be updated in business step
        baseCurrency: data.baseCurrency,
        fiscalYearStartMonth: data.fiscalYearStartMonth,
        dateFormat: data.dateFormat,
        decimalSeparator: data.decimalSeparator,
        thousandsSeparator: data.thousandsSeparator,
      },
      update: {
        baseCurrency: data.baseCurrency,
        fiscalYearStartMonth: data.fiscalYearStartMonth,
        dateFormat: data.dateFormat,
        decimalSeparator: data.decimalSeparator,
        thousandsSeparator: data.thousandsSeparator,
      },
    });

    return NextResponse.json({
      success: true,
      settings: {
        baseCurrency: settings.baseCurrency,
        fiscalYearStartMonth: settings.fiscalYearStartMonth,
        dateFormat: settings.dateFormat,
        decimalSeparator: settings.decimalSeparator,
        thousandsSeparator: settings.thousandsSeparator,
      },
    });
  } catch (error) {
    console.error("Error updating financial settings:", error);
    return NextResponse.json(
      { error: "Failed to update financial settings" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orgs/[orgId]/settings/financial
 * Get financial configuration for an organization
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;

    // Require admin or superadmin access
    try {
      await requireAdminOrSuperadmin(user.id, orgId);
    } catch {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get organization settings
    const settings = await db.organizationSettings.findUnique({
      where: { organizationId: orgId },
    });

    if (!settings) {
      return NextResponse.json(
        { settings: null },
        { status: 200 }
      );
    }

    return NextResponse.json({
      settings: {
        baseCurrency: settings.baseCurrency,
        fiscalYearStartMonth: settings.fiscalYearStartMonth,
        dateFormat: settings.dateFormat,
        decimalSeparator: settings.decimalSeparator,
        thousandsSeparator: settings.thousandsSeparator,
      },
    });
  } catch (error) {
    console.error("Error fetching financial settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch financial settings" },
      { status: 500 }
    );
  }
}
