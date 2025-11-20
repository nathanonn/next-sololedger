import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/transactions/trash
 * List soft-deleted transactions
 * Members and admins can view trash
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    const user = await getCurrentUser(request);
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

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const deletedFrom = searchParams.get("deletedFrom");
    const deletedTo = searchParams.get("deletedTo");
    const search = searchParams.get("search");

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: org.id,
      deletedAt: { not: null },
    };

    if (type && (type === "INCOME" || type === "EXPENSE")) {
      where.type = type;
    }

    if (deletedFrom || deletedTo) {
      where.deletedAt = {};
      if (deletedFrom) {
        (where.deletedAt as Record<string, unknown>).gte = new Date(deletedFrom);
      }
      if (deletedTo) {
        (where.deletedAt as Record<string, unknown>).lte = new Date(deletedTo);
      }
    }

    // Get soft-deleted transactions
    let transactions = await db.transaction.findMany({
      where,
      include: {
        category: true,
        account: true,
        vendor: true,
        client: true,
      },
      orderBy: { deletedAt: "desc" },
    });

    // Apply client-side search filter if provided
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      transactions = transactions.filter(
        (t) =>
          t.description.toLowerCase().includes(searchLower) ||
          (t.vendorName && t.vendorName.toLowerCase().includes(searchLower)) ||
          (t.clientName && t.clientName.toLowerCase().includes(searchLower))
      );
    }

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error("Error fetching trash transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch trash transactions" },
      { status: 500 }
    );
  }
}
