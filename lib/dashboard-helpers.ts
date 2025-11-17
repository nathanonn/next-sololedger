/**
 * Dashboard & Analytics Server Helpers
 * Server-side aggregation and filtering logic for dashboard metrics
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type {
  DashboardDateRange,
  DashboardTransactionFilters,
  DashboardSummary,
  DashboardMonthlyPoint,
  CategoryBreakdownItem,
  DateRangeBounds,
} from "@/lib/dashboard-types";
import { getYTDRange } from "@/lib/sololedger-formatters";

/**
 * Compute date bounds from a DashboardDateRange
 */
export function computeDateBounds(
  dateRange: DashboardDateRange,
  fiscalYearStartMonth: number,
  referenceDate: Date = new Date()
): DateRangeBounds {
  const now = referenceDate;
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11

  switch (dateRange.kind) {
    case "ytd": {
      const { startDate, endDate } = getYTDRange(fiscalYearStartMonth, now);
      return { from: startDate, to: endDate };
    }

    case "last30": {
      const to = now;
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      return { from, to };
    }

    case "thisMonth": {
      const from = new Date(currentYear, currentMonth, 1);
      const to = new Date(currentYear, currentMonth + 1, 0); // Last day of current month
      return { from, to };
    }

    case "lastMonth": {
      const from = new Date(currentYear, currentMonth - 1, 1);
      const to = new Date(currentYear, currentMonth, 0); // Last day of last month
      return { from, to };
    }

    case "custom": {
      if (!dateRange.from || !dateRange.to) {
        // Fallback to YTD if custom dates not provided
        const { startDate, endDate } = getYTDRange(fiscalYearStartMonth, now);
        return { from: startDate, to: endDate };
      }
      return {
        from: new Date(dateRange.from),
        to: new Date(dateRange.to),
      };
    }

    default: {
      // Default to YTD
      const { startDate, endDate } = getYTDRange(fiscalYearStartMonth, now);
      return { from: startDate, to: endDate };
    }
  }
}

/**
 * Compute the previous period date range (same length as current period)
 */
export function computePreviousPeriod(current: DateRangeBounds): DateRangeBounds {
  const lengthMs = current.to.getTime() - current.from.getTime();
  const to = new Date(current.from.getTime() - 1); // Day before current period starts
  const from = new Date(to.getTime() - lengthMs);
  return { from, to };
}

/**
 * Build Prisma where clause for dashboard transaction filters
 */
export function buildDashboardTransactionWhere(
  filters: DashboardTransactionFilters
): Prisma.TransactionWhereInput {
  const { organizationId, dateRange, categoryIds, view, originCurrency, fiscalYearStartMonth } =
    filters;

  // Compute date bounds
  const { from, to } = computeDateBounds(dateRange, fiscalYearStartMonth);

  // Base constraints
  const where: Prisma.TransactionWhereInput = {
    organizationId,
    status: "POSTED", // Only posted transactions
    deletedAt: null, // Exclude soft-deleted
    date: {
      gte: from,
      lte: to,
    },
  };

  // Category filter
  if (categoryIds.length > 0) {
    where.categoryId = {
      in: categoryIds,
    };
  }

  // View filter (income/expense/both)
  if (view === "income") {
    where.type = "INCOME";
  } else if (view === "expense") {
    where.type = "EXPENSE";
  }
  // If "both", no type constraint

  // Origin currency filter
  if (originCurrency === "base") {
    // Base currency only = no secondary currency
    where.currencySecondary = null;
  } else if (originCurrency !== "all") {
    // Specific ISO code
    where.currencySecondary = originCurrency;
  }
  // If "all", no currency constraint

  return where;
}

/**
 * Get summary metrics with current and previous period comparison
 */
export async function getDashboardSummary(
  filters: DashboardTransactionFilters
): Promise<DashboardSummary> {
  const { fiscalYearStartMonth, dateRange } = filters;

  // Compute current period bounds
  const current = computeDateBounds(dateRange, fiscalYearStartMonth);

  // Compute previous period bounds
  const previous = computePreviousPeriod(current);

  // Build where clause for current period
  const currentWhere = buildDashboardTransactionWhere(filters);

  // Build where clause for previous period
  const previousWhere: Prisma.TransactionWhereInput = {
    ...currentWhere,
    date: {
      gte: previous.from,
      lte: previous.to,
    },
  };

  // Fetch current period transactions with P&L filter
  const currentTransactions = await db.transaction.findMany({
    where: {
      ...currentWhere,
      category: {
        includeInPnL: true,
      },
    },
    select: {
      type: true,
      amountBase: true,
    },
  });

  // Fetch previous period transactions with P&L filter
  const previousTransactions = await db.transaction.findMany({
    where: {
      ...previousWhere,
      category: {
        includeInPnL: true,
      },
    },
    select: {
      type: true,
      amountBase: true,
    },
  });

  // Calculate current period metrics
  const income = currentTransactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + Number(t.amountBase), 0);

  const expenses = currentTransactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + Number(t.amountBase), 0);

  const profitLoss = income - expenses;

  // Calculate previous period metrics
  const prevIncome = previousTransactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + Number(t.amountBase), 0);

  const prevExpenses = previousTransactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + Number(t.amountBase), 0);

  const prevProfitLoss = prevIncome - prevExpenses;

  // Calculate percentage changes (safe division)
  const incomeDeltaPct =
    prevIncome === 0 ? null : ((income - prevIncome) / prevIncome) * 100;
  const expensesDeltaPct =
    prevExpenses === 0 ? null : ((expenses - prevExpenses) / prevExpenses) * 100;
  const profitLossDeltaPct =
    prevProfitLoss === 0 ? null : ((profitLoss - prevProfitLoss) / Math.abs(prevProfitLoss)) * 100;

  return {
    income,
    expenses,
    profitLoss,
    prevIncome,
    prevExpenses,
    prevProfitLoss,
    incomeDeltaPct,
    expensesDeltaPct,
    profitLossDeltaPct,
    currentPeriod: {
      from: current.from.toISOString().split("T")[0],
      to: current.to.toISOString().split("T")[0],
    },
    previousPeriod: {
      from: previous.from.toISOString().split("T")[0],
      to: previous.to.toISOString().split("T")[0],
    },
  };
}

/**
 * Get month-over-month trend data
 */
export async function getDashboardMonthlyTrends(
  filters: DashboardTransactionFilters
): Promise<DashboardMonthlyPoint[]> {
  const { fiscalYearStartMonth, dateRange } = filters;

  // Compute date bounds
  const { from, to } = computeDateBounds(dateRange, fiscalYearStartMonth);

  // Build where clause
  const where = buildDashboardTransactionWhere(filters);

  // Fetch transactions with P&L filter
  const transactions = await db.transaction.findMany({
    where: {
      ...where,
      category: {
        includeInPnL: true,
      },
    },
    select: {
      type: true,
      date: true,
      amountBase: true,
    },
  });

  // Group by month
  const monthlyMap = new Map<string, { income: number; expenses: number }>();

  transactions.forEach((t) => {
    const date = new Date(t.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { income: 0, expenses: 0 });
    }

    const data = monthlyMap.get(monthKey)!;
    if (t.type === "INCOME") {
      data.income += Number(t.amountBase);
    } else if (t.type === "EXPENSE") {
      data.expenses += Number(t.amountBase);
    }
  });

  // Generate all months in range (fill gaps with zeros)
  const result: DashboardMonthlyPoint[] = [];
  const currentDate = new Date(from);
  const endDate = new Date(to);

  while (currentDate <= endDate) {
    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
    const data = monthlyMap.get(monthKey) || { income: 0, expenses: 0 };

    result.push({
      month: monthKey,
      income: data.income,
      expenses: data.expenses,
      profitLoss: data.income - data.expenses,
    });

    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return result;
}

/**
 * Get category breakdown with top N and "Other" bucket
 */
export async function getDashboardCategoryBreakdown(
  filters: DashboardTransactionFilters,
  topN: number = 10
): Promise<CategoryBreakdownItem[]> {
  // Build where clause
  const where = buildDashboardTransactionWhere(filters);

  // Fetch transactions grouped by category with P&L filter
  const transactions = await db.transaction.findMany({
    where: {
      ...where,
      category: {
        includeInPnL: true,
      },
    },
    select: {
      categoryId: true,
      type: true,
      amountBase: true,
      category: {
        select: {
          id: true,
          name: true,
          type: true,
          color: true,
          icon: true,
        },
      },
    },
  });

  // Group by category
  const categoryMap = new Map<
    string,
    {
      id: string;
      name: string;
      type: "INCOME" | "EXPENSE";
      amount: number;
      count: number;
      color?: string | null;
      icon?: string | null;
    }
  >();

  transactions.forEach((t) => {
    const key = t.categoryId;
    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        id: t.category.id,
        name: t.category.name,
        type: t.category.type,
        amount: 0,
        count: 0,
        color: t.category.color,
        icon: t.category.icon,
      });
    }

    const data = categoryMap.get(key)!;
    data.amount += Number(t.amountBase);
    data.count += 1;
  });

  // Convert to array and sort by amount descending
  const sorted = Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount);

  // Take top N and aggregate the rest into "Other"
  const topItems = sorted.slice(0, topN);
  const restItems = sorted.slice(topN);

  const result: CategoryBreakdownItem[] = topItems.map((item) => ({
    categoryId: item.id,
    name: item.name,
    type: item.type,
    amountBase: item.amount,
    transactionCount: item.count,
    color: item.color,
    icon: item.icon,
  }));

  // Add "Other" bucket if there are remaining items
  if (restItems.length > 0) {
    const otherAmount = restItems.reduce((sum, item) => sum + item.amount, 0);
    const otherCount = restItems.reduce((sum, item) => sum + item.count, 0);

    result.push({
      categoryId: "other",
      name: "Other",
      type: restItems[0].type, // Use type from first item (or could be mixed)
      amountBase: otherAmount,
      transactionCount: otherCount,
      color: null,
      icon: null,
    });
  }

  return result;
}

/**
 * Get dashboard layout for a membership
 */
export async function getDashboardLayoutForMembership(
  userId: string,
  orgId: string
): Promise<unknown | null> {
  const membership = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: orgId,
      },
    },
    select: {
      dashboardLayout: true,
    },
  });

  return membership?.dashboardLayout || null;
}

/**
 * Save dashboard layout for a membership
 */
export async function saveDashboardLayoutForMembership(
  userId: string,
  orgId: string,
  layout: unknown
): Promise<void> {
  await db.membership.update({
    where: {
      userId_organizationId: {
        userId,
        organizationId: orgId,
      },
    },
    data: {
      dashboardLayout: layout as object,
    },
  });
}
