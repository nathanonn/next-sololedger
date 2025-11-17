/**
 * Reporting helpers for P&L, Category, and Vendor reports
 * Server-side only (Node runtime)
 */

import { db } from "@/lib/db";
import {
  getFiscalYearRange,
  getYTDRange,
} from "@/lib/sololedger-formatters";
import { computePreviousPeriod } from "@/lib/dashboard-helpers";
import type {
  PnLConfig,
  PnLPeriodBounds,
  PnLResult,
  PnLCategoryRow,
  PnLTotals,
  PnLComparison,
  CategoryReportResult,
  CategoryReportRow,
  VendorReportRow,
} from "@/lib/reporting-types";

/**
 * Compute P&L date bounds based on configuration
 */
export function computePnLDateBounds(config: PnLConfig): PnLPeriodBounds {
  const referenceDate = config.referenceDate || new Date();

  switch (config.dateMode) {
    case "fiscalYear": {
      const { startDate, endDate } = getFiscalYearRange(
        config.fiscalYearStartMonth,
        referenceDate
      );
      return { from: startDate, to: endDate };
    }

    case "ytd": {
      const { startDate, endDate } = getYTDRange(
        config.fiscalYearStartMonth,
        referenceDate
      );
      return { from: startDate, to: endDate };
    }

    case "custom": {
      if (config.customFrom && config.customTo) {
        return {
          from: new Date(config.customFrom),
          to: new Date(config.customTo),
        };
      }
      // Fallback to YTD if custom dates not provided
      const { startDate, endDate } = getYTDRange(
        config.fiscalYearStartMonth,
        referenceDate
      );
      return { from: startDate, to: endDate };
    }

    default: {
      const { startDate, endDate } = getYTDRange(
        config.fiscalYearStartMonth,
        referenceDate
      );
      return { from: startDate, to: endDate };
    }
  }
}

/**
 * Compute P&L comparison period bounds
 */
export function computePnLComparisonBounds(
  current: PnLPeriodBounds,
  dateMode: string,
  fiscalYearStartMonth: number
): PnLPeriodBounds {
  if (dateMode === "fiscalYear") {
    // For fiscal year, get the previous fiscal year
    const prevYearDate = new Date(current.from);
    prevYearDate.setFullYear(prevYearDate.getFullYear() - 1);

    const { startDate, endDate } = getFiscalYearRange(
      fiscalYearStartMonth,
      prevYearDate
    );
    return { from: startDate, to: endDate };
  }

  // For YTD and custom, use equal-length previous period
  return computePreviousPeriod(current);
}

/**
 * Get Profit & Loss statement
 */
export async function getProfitAndLoss(
  config: PnLConfig
): Promise<PnLResult> {
  // Compute current period bounds
  const currentPeriod = computePnLDateBounds(config);

  // Compute previous period bounds
  const previousPeriod = computePnLComparisonBounds(
    currentPeriod,
    config.dateMode,
    config.fiscalYearStartMonth
  );

  // Fetch current period transactions
  const currentTransactions = await db.transaction.findMany({
    where: {
      organizationId: config.organizationId,
      status: "POSTED",
      deletedAt: null,
      date: {
        gte: currentPeriod.from,
        lte: currentPeriod.to,
      },
      category: {
        includeInPnL: true,
      },
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          type: true,
          parentId: true,
          sortOrder: true,
          parent: {
            select: {
              id: true,
              name: true,
              sortOrder: true,
            },
          },
        },
      },
    },
  });

  // Fetch previous period transactions for totals only
  const previousTransactions = await db.transaction.findMany({
    where: {
      organizationId: config.organizationId,
      status: "POSTED",
      deletedAt: null,
      date: {
        gte: previousPeriod.from,
        lte: previousPeriod.to,
      },
      category: {
        includeInPnL: true,
      },
    },
    select: {
      type: true,
      amountBase: true,
    },
  });

  // Aggregate current period by category
  const categoryTotals = new Map<string, number>();

  currentTransactions.forEach((t) => {
    const categoryId = t.categoryId;
    const amount = Number(t.amountBase);
    categoryTotals.set(
      categoryId,
      (categoryTotals.get(categoryId) || 0) + amount
    );
  });

  // Build category metadata map
  const categoryMetadata = new Map<
    string,
    {
      id: string;
      name: string;
      type: "INCOME" | "EXPENSE";
      parentId: string | null;
      sortOrder: number;
      parentName?: string;
      parentSortOrder?: number;
    }
  >();

  currentTransactions.forEach((t) => {
    if (!categoryMetadata.has(t.categoryId)) {
      categoryMetadata.set(t.categoryId, {
        id: t.category.id,
        name: t.category.name,
        type: t.category.type,
        parentId: t.category.parentId,
        sortOrder: t.category.sortOrder,
        parentName: t.category.parent?.name,
        parentSortOrder: t.category.parent?.sortOrder,
      });
    }
  });

  // Build parent/child structures
  const { incomeRows, expenseRows } = buildCategoryRows(
    categoryTotals,
    categoryMetadata,
    config.detailLevel
  );

  // Calculate current period totals
  const income = currentTransactions
    .filter((t) => t.category.type === "INCOME")
    .reduce((sum, t) => sum + Number(t.amountBase), 0);

  const expenses = currentTransactions
    .filter((t) => t.category.type === "EXPENSE")
    .reduce((sum, t) => sum + Number(t.amountBase), 0);

  const net = income - expenses;

  const currentTotals: PnLTotals = { income, expenses, net };

  // Calculate previous period totals
  const prevIncome = previousTransactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + Number(t.amountBase), 0);

  const prevExpenses = previousTransactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + Number(t.amountBase), 0);

  const prevNet = prevIncome - prevExpenses;

  const previousTotals: PnLTotals = {
    income: prevIncome,
    expenses: prevExpenses,
    net: prevNet,
  };

  // Calculate percentage deltas
  const incomeDeltaPct =
    prevIncome === 0 ? null : ((income - prevIncome) / prevIncome) * 100;
  const expensesDeltaPct =
    prevExpenses === 0
      ? null
      : ((expenses - prevExpenses) / prevExpenses) * 100;
  const netDeltaPct =
    prevNet === 0 ? null : ((net - prevNet) / Math.abs(prevNet)) * 100;

  const comparison: PnLComparison = {
    current: currentTotals,
    previous: previousTotals,
    deltaPct: {
      income: incomeDeltaPct,
      expenses: expensesDeltaPct,
      net: netDeltaPct,
    },
  };

  return {
    incomeRows,
    expenseRows,
    comparison,
    currentPeriod,
    previousPeriod,
  };
}

/**
 * Build category rows with parent/child structure
 */
function buildCategoryRows(
  categoryTotals: Map<string, number>,
  categoryMetadata: Map<
    string,
    {
      id: string;
      name: string;
      type: "INCOME" | "EXPENSE";
      parentId: string | null;
      sortOrder: number;
      parentName?: string;
      parentSortOrder?: number;
    }
  >,
  detailLevel: "summary" | "detailed"
): { incomeRows: PnLCategoryRow[]; expenseRows: PnLCategoryRow[] } {
  // Separate categories by type
  const incomeCategories: PnLCategoryRow[] = [];
  const expenseCategories: PnLCategoryRow[] = [];

  // Build parent rows map
  const parentRows = new Map<string, PnLCategoryRow>();
  const childRows = new Map<string, PnLCategoryRow[]>();

  categoryMetadata.forEach((meta, categoryId) => {
    const total = categoryTotals.get(categoryId) || 0;

    if (meta.parentId === null) {
      // Parent category
      const row: PnLCategoryRow = {
        categoryId: meta.id,
        parentId: null,
        name: meta.name,
        type: meta.type,
        level: 0,
        sortOrder: meta.sortOrder,
        totalBase: total,
        children: [],
      };
      parentRows.set(categoryId, row);
    } else {
      // Child category
      const row: PnLCategoryRow = {
        categoryId: meta.id,
        parentId: meta.parentId,
        name: meta.name,
        type: meta.type,
        level: 1,
        sortOrder: meta.sortOrder,
        totalBase: total,
      };

      if (!childRows.has(meta.parentId)) {
        childRows.set(meta.parentId, []);
      }
      childRows.get(meta.parentId)!.push(row);
    }
  });

  // Attach children to parents and calculate parent totals
  childRows.forEach((children, parentId) => {
    const parent = parentRows.get(parentId);
    if (parent) {
      // Sort children by sortOrder
      const sortedChildren = children.sort(
        (a, b) => a.sortOrder - b.sortOrder
      );

      // Add child totals to parent
      const childTotal = sortedChildren.reduce(
        (sum, child) => sum + child.totalBase,
        0
      );
      parent.totalBase += childTotal;

      if (detailLevel === "detailed") {
        parent.children = sortedChildren;
      }
    } else {
      // Create parent placeholder if not found
      const firstChild = children[0];
      const parentMeta = categoryMetadata.get(parentId);

      if (parentMeta || firstChild) {
        const parentRow: PnLCategoryRow = {
          categoryId: parentId,
          parentId: null,
          name: parentMeta?.name || firstChild.name.split(" / ")[0] || "Unknown",
          type: firstChild.type,
          level: 0,
          sortOrder: parentMeta?.sortOrder || firstChild.sortOrder,
          totalBase: 0,
          children: [],
        };

        const sortedChildren = children.sort(
          (a, b) => a.sortOrder - b.sortOrder
        );

        const childTotal = sortedChildren.reduce(
          (sum, child) => sum + child.totalBase,
          0
        );
        parentRow.totalBase = childTotal;

        if (detailLevel === "detailed") {
          parentRow.children = sortedChildren;
        }

        parentRows.set(parentId, parentRow);
      }
    }
  });

  // Convert to arrays and sort by sortOrder
  const allRows = Array.from(parentRows.values()).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  // Separate by type
  allRows.forEach((row) => {
    if (row.type === "INCOME") {
      incomeCategories.push(row);
    } else if (row.type === "EXPENSE") {
      expenseCategories.push(row);
    }
  });

  return {
    incomeRows: incomeCategories,
    expenseRows: expenseCategories,
  };
}

/**
 * Get Category Report
 * Returns all categories with transaction counts and totals (not filtered by includeInPnL)
 */
export async function getCategoryReport(params: {
  organizationId: string;
  from: Date;
  to: Date;
  typeFilter?: "INCOME" | "EXPENSE" | "both";
}): Promise<CategoryReportResult> {
  const { organizationId, from, to, typeFilter = "both" } = params;

  // Build where clause
  const where: {
    organizationId: string;
    status: "POSTED";
    deletedAt: null;
    date: { gte: Date; lte: Date };
    category?: { type: "INCOME" | "EXPENSE" };
  } = {
    organizationId,
    status: "POSTED",
    deletedAt: null,
    date: {
      gte: from,
      lte: to,
    },
  };

  // Add type filter if specified
  if (typeFilter !== "both") {
    where.category = { type: typeFilter };
  }

  // Fetch transactions
  const transactions = await db.transaction.findMany({
    where,
    include: {
      category: {
        select: {
          id: true,
          name: true,
          type: true,
          parentId: true,
          sortOrder: true,
          parent: {
            select: {
              id: true,
              name: true,
              sortOrder: true,
            },
          },
        },
      },
    },
  });

  // Aggregate by category
  const categoryMap = new Map<
    string,
    {
      id: string;
      name: string;
      type: "INCOME" | "EXPENSE";
      parentId: string | null;
      parentName: string | null;
      sortOrder: number;
      transactionCount: number;
      totalBase: number;
      level: 0 | 1;
    }
  >();

  transactions.forEach((t) => {
    const categoryId = t.categoryId;
    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, {
        id: t.category.id,
        name: t.category.name,
        type: t.category.type,
        parentId: t.category.parentId,
        parentName: t.category.parent?.name || null,
        sortOrder: t.category.sortOrder,
        transactionCount: 0,
        totalBase: 0,
        level: t.category.parentId === null ? 0 : 1,
      });
    }

    const data = categoryMap.get(categoryId)!;
    data.transactionCount += 1;
    data.totalBase += Number(t.amountBase);
  });

  // Convert to array and sort
  const items: CategoryReportRow[] = Array.from(categoryMap.values())
    .map((cat) => ({
      categoryId: cat.id,
      parentId: cat.parentId,
      name: cat.name,
      type: cat.type,
      level: cat.level,
      sortOrder: cat.sortOrder,
      transactionCount: cat.transactionCount,
      totalBase: cat.totalBase,
      parentName: cat.parentName,
    }))
    .sort((a, b) => {
      // Sort by parent first (parents before children), then by sortOrder
      if (a.level !== b.level) {
        return a.level - b.level;
      }
      return a.sortOrder - b.sortOrder;
    });

  return { items };
}

/**
 * Get Vendor Report
 * Returns income/expense totals per vendor for a given period
 */
export async function getVendorReport(params: {
  organizationId: string;
  from: Date;
  to: Date;
}): Promise<VendorReportRow[]> {
  const { organizationId, from, to } = params;

  // Fetch transactions
  const transactions = await db.transaction.findMany({
    where: {
      organizationId,
      status: "POSTED",
      deletedAt: null,
      date: {
        gte: from,
        lte: to,
      },
    },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Aggregate by vendor
  const vendorMap = new Map<
    string,
    {
      vendorId: string | null;
      vendorName: string;
      totalIncomeBase: number;
      totalExpenseBase: number;
    }
  >();

  transactions.forEach((t) => {
    // Use vendor ID if present, otherwise use vendorName as key (for non-linked vendors)
    const vendorKey = t.vendorId || `name:${t.vendorName || "No vendor"}`;

    if (!vendorMap.has(vendorKey)) {
      vendorMap.set(vendorKey, {
        vendorId: t.vendorId,
        vendorName: t.vendor?.name || t.vendorName || "No vendor",
        totalIncomeBase: 0,
        totalExpenseBase: 0,
      });
    }

    const data = vendorMap.get(vendorKey)!;
    const amount = Number(t.amountBase);

    if (t.type === "INCOME") {
      data.totalIncomeBase += amount;
    } else if (t.type === "EXPENSE") {
      data.totalExpenseBase += amount;
    }
  });

  // Convert to array and calculate net
  const rows: VendorReportRow[] = Array.from(vendorMap.values())
    .map((vendor) => ({
      vendorId: vendor.vendorId,
      vendorName: vendor.vendorName,
      totalIncomeBase: vendor.totalIncomeBase,
      totalExpenseBase: vendor.totalExpenseBase,
      netBase: vendor.totalIncomeBase - vendor.totalExpenseBase,
    }))
    .sort((a, b) => b.netBase - a.netBase); // Sort by net descending

  return rows;
}
