/**
 * Date-range CSV export API
 * POST /api/orgs/[orgSlug]/transactions/export-range
 * Export transactions by date range with configurable columns
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { generateTransactionsCsv, AVAILABLE_CSV_COLUMNS, type CsvColumn } from "@/lib/export-helpers";

export const runtime = "nodejs";

/**
 * POST handler for date-range export
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

    // Require admin or superadmin (export access control)
    try {
      await requireAdminOrSuperadmin(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Admin or superadmin access required" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await req.json();
    const {
      from: fromStr,
      to: toStr,
      type,
      status = "POSTED",
      categoryIds,
      vendorId,
      clientId,
      columns: requestedColumns,
    } = body;

    // Validate required fields
    if (!fromStr || !toStr) {
      return NextResponse.json(
        { error: "From and to dates are required" },
        { status: 400 }
      );
    }

    // Parse dates
    const from = new Date(fromStr);
    const to = new Date(toStr);

    // Validate date range
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    if (from > to) {
      return NextResponse.json(
        { error: "From date must be before or equal to to date" },
        { status: 400 }
      );
    }

    // Cap date span to 5 years to prevent pathological queries
    const maxSpanMs = 5 * 365 * 24 * 60 * 60 * 1000; // 5 years
    if (to.getTime() - from.getTime() > maxSpanMs) {
      return NextResponse.json(
        { error: "Date range cannot exceed 5 years" },
        { status: 400 }
      );
    }

    // Validate and process columns
    let columns: CsvColumn[] = [...AVAILABLE_CSV_COLUMNS];

    if (requestedColumns && Array.isArray(requestedColumns)) {
      // Validate requested columns
      const validColumns = requestedColumns.filter((col) =>
        AVAILABLE_CSV_COLUMNS.includes(col as CsvColumn)
      );

      if (validColumns.length === 0) {
        return NextResponse.json(
          { error: "At least one valid column is required" },
          { status: 400 }
        );
      }

      columns = validColumns as CsvColumn[];
    }

    // Generate CSV
    const result = await generateTransactionsCsv({
      organizationId: org.id,
      from,
      to,
      type,
      status,
      categoryIds,
      vendorId,
      clientId,
      columns,
    });

    // Return CSV response
    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    console.error("CSV export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
