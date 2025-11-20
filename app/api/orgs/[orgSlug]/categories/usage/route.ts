import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/categories/usage
 * Get category usage analytics: transaction count, total amount, last used date
 * Query params: from, to (optional, defaults to last 12 months)
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
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Require membership
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    // Default to last 12 months if not specified
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setFullYear(now.getFullYear() - 1);

    const from = fromParam ? new Date(fromParam) : defaultFrom;
    const to = toParam ? new Date(toParam) : now;

    // Validate dates
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    if (from > to) {
      return NextResponse.json(
        { error: "From date must be before to date" },
        { status: 400 }
      );
    }

    // Get all categories for this organization
    const categories = await db.category.findMany({
      where: {
        organizationId: org.id,
      },
      select: {
        id: true,
        name: true,
        type: true,
        active: true,
        sortOrder: true,
      },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
    });

    // Get transaction analytics grouped by category
    const transactionStats = await db.transaction.groupBy({
      by: ["categoryId"],
      where: {
        organizationId: org.id,
        status: "POSTED",
        date: {
          gte: from,
          lte: to,
        },
        deletedAt: null,
      },
      _count: {
        id: true,
      },
      _sum: {
        amountBase: true,
      },
      _max: {
        date: true,
      },
    });

    // Create a map of category stats
    const statsMap = new Map(
      transactionStats.map((stat) => [
        stat.categoryId,
        {
          count: stat._count.id,
          totalAmount: stat._sum.amountBase
            ? Number(stat._sum.amountBase)
            : 0,
          lastUsedAt: stat._max.date,
        },
      ])
    );

    // Combine categories with their usage stats
    const usage = categories.map((category) => {
      const stats = statsMap.get(category.id);
      return {
        id: category.id,
        name: category.name,
        type: category.type,
        active: category.active,
        sortOrder: category.sortOrder,
        transactionCount: stats?.count || 0,
        totalAmount: stats?.totalAmount || 0,
        lastUsedAt: stats?.lastUsedAt || null,
      };
    });

    return NextResponse.json({
      usage,
      dateRange: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching category usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch category usage" },
      { status: 500 }
    );
  }
}
