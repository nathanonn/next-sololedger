import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/accounts/balances
 * Get account balances for a date range
 * Query params: from, to (optional, defaults to last 30 days)
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

    // Default to last 30 days if not specified
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(now.getDate() - 30);

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

    // Get all active accounts for this organization
    const accounts = await db.account.findMany({
      where: {
        organizationId: org.id,
        active: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
        active: true,
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    // Get transaction balances grouped by account
    const transactionBalances = await db.transaction.groupBy({
      by: ["accountId"],
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
    });

    // Create a map of account balances
    const balanceMap = new Map(
      transactionBalances.map((balance) => [
        balance.accountId,
        {
          count: balance._count.id,
          balanceBase: balance._sum.amountBase
            ? Number(balance._sum.amountBase)
            : 0,
        },
      ])
    );

    // Combine accounts with their balances
    const accountsWithBalances = accounts.map((account) => {
      const balance = balanceMap.get(account.id);
      return {
        id: account.id,
        name: account.name,
        description: account.description,
        isDefault: account.isDefault,
        active: account.active,
        balanceBase: balance?.balanceBase || 0,
        transactionCount: balance?.count || 0,
      };
    });

    return NextResponse.json({
      accounts: accountsWithBalances,
      dateRange: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching account balances:", error);
    return NextResponse.json(
      { error: "Failed to fetch account balances" },
      { status: 500 }
    );
  }
}
