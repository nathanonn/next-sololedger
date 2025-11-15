import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/transactions/export?ids=id1,id2,...
 * Export selected transactions to CSV
 * Members and admins can export
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgSlug } = await params;

    // Get organization
    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Require membership
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Parse transaction IDs from query params
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json(
        { error: "Transaction IDs are required" },
        { status: 400 }
      );
    }

    const transactionIds = idsParam.split(",").filter((id) => id.trim());

    if (transactionIds.length === 0) {
      return NextResponse.json(
        { error: "At least one transaction ID is required" },
        { status: 400 }
      );
    }

    // Get transactions
    const transactions = await db.transaction.findMany({
      where: {
        id: { in: transactionIds },
        organizationId: org.id,
        deletedAt: null,
      },
      include: {
        category: true,
        account: true,
        vendor: true,
        client: true,
      },
      orderBy: { date: "desc" },
    });

    // Generate CSV
    const csvRows: string[] = [];

    // Header row
    csvRows.push(
      [
        "ID",
        "Date",
        "Type",
        "Status",
        "Description",
        "Category",
        "Account",
        "Vendor",
        "Client",
        "Amount (Original)",
        "Currency (Original)",
        "Exchange Rate",
        "Amount (Base)",
        "Notes",
      ].join(",")
    );

    // Data rows
    for (const transaction of transactions) {
      const row = [
        transaction.id,
        transaction.date.toISOString().split("T")[0],
        transaction.type,
        transaction.status,
        `"${transaction.description.replace(/"/g, '""')}"`, // Escape quotes
        `"${transaction.category.name.replace(/"/g, '""')}"`,
        `"${transaction.account.name.replace(/"/g, '""')}"`,
        transaction.vendorName
          ? `"${transaction.vendorName.replace(/"/g, '""')}"`
          : "",
        transaction.clientName
          ? `"${transaction.clientName.replace(/"/g, '""')}"`
          : "",
        transaction.amountOriginal.toString(),
        transaction.currencyOriginal,
        transaction.exchangeRateToBase.toString(),
        transaction.amountBase.toString(),
        transaction.notes ? `"${transaction.notes.replace(/"/g, '""')}"` : "",
      ];

      csvRows.push(row.join(","));
    }

    const csv = csvRows.join("\n");

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `transactions-export-${timestamp}.csv`;

    // Return CSV response
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting transactions:", error);
    return NextResponse.json(
      { error: "Failed to export transactions" },
      { status: 500 }
    );
  }
}
