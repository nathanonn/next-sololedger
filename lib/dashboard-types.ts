/**
 * Dashboard & Analytics Types
 * Shared data contracts for dashboard filters, metrics, and chart data
 */

/**
 * Dashboard date range selector
 */
export interface DashboardDateRange {
  kind: "ytd" | "last30" | "thisMonth" | "lastMonth" | "custom";
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}

/**
 * Dashboard filter state
 */
export interface DashboardFilters {
  dateRange: DashboardDateRange;
  categoryIds: string[]; // Selected category IDs
  view: "income" | "expense" | "both"; // Income/Expense/Both view
  originCurrency: "all" | "base" | string; // "all" | "base" | ISO currency code
}

/**
 * Dashboard summary metrics (current + previous period comparison)
 */
export interface DashboardSummary {
  // Current period totals
  income: number;
  expenses: number;
  profitLoss: number;

  // Previous period totals
  prevIncome: number;
  prevExpenses: number;
  prevProfitLoss: number;

  // Percentage changes (null if prev = 0)
  incomeDeltaPct: number | null;
  expensesDeltaPct: number | null;
  profitLossDeltaPct: number | null;

  // Date ranges for display
  currentPeriod: {
    from: string; // YYYY-MM-DD
    to: string; // YYYY-MM-DD
  };
  previousPeriod: {
    from: string; // YYYY-MM-DD
    to: string; // YYYY-MM-DD
  };
}

/**
 * Monthly trend data point
 */
export interface DashboardMonthlyPoint {
  month: string; // YYYY-MM format (e.g., "2025-01")
  income: number;
  expenses: number;
  profitLoss: number;
}

/**
 * Category breakdown item
 */
export interface CategoryBreakdownItem {
  categoryId: string | "other"; // "other" for aggregated smaller categories
  name: string;
  type: "INCOME" | "EXPENSE";
  amountBase: number;
  transactionCount: number;
  color?: string | null;
  icon?: string | null;
}

/**
 * Widget definition in the registry
 */
export interface DashboardWidgetDefinition {
  id: string;
  title: string;
  description: string;
  defaultVisible: boolean;
  defaultOrder: number;
}

/**
 * Layout item for a single widget
 */
export interface DashboardLayoutItem {
  widgetId: string;
  visible: boolean;
  order: number;
}

/**
 * Complete dashboard layout configuration
 */
export type DashboardLayout = DashboardLayoutItem[];

/**
 * Date range computation helpers
 */
export interface DateRangeBounds {
  from: Date;
  to: Date;
}

/**
 * Transaction aggregation where clause builder input
 */
export interface DashboardTransactionFilters {
  organizationId: string;
  dateRange: DashboardDateRange;
  categoryIds: string[];
  view: "income" | "expense" | "both";
  originCurrency: "all" | "base" | string;
  fiscalYearStartMonth: number;
}

/**
 * Recent activity transaction item
 */
export interface RecentActivityTransaction {
  id: string;
  type: "INCOME" | "EXPENSE";
  status: "DRAFT" | "POSTED";
  date: string;
  description: string;
  amountBase: number;
  currencyBase: string;
  category: {
    id: string;
    name: string;
  };
  account: {
    id: string;
    name: string;
  };
  hasDocuments?: boolean;
  clientName?: string | null;
  vendorName?: string | null;
}
