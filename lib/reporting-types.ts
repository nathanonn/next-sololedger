/**
 * Reporting types for P&L, Category, and Vendor reports
 */

/**
 * P&L date mode options
 */
export type PnLDateMode = "fiscalYear" | "ytd" | "custom";

/**
 * P&L detail level options
 */
export type PnLDetailLevel = "summary" | "detailed";

/**
 * P&L configuration
 */
export interface PnLConfig {
  organizationId: string;
  fiscalYearStartMonth: number; // 1-12
  dateMode: PnLDateMode;
  customFrom?: string; // ISO YYYY-MM-DD
  customTo?: string; // ISO YYYY-MM-DD
  detailLevel: PnLDetailLevel;
  referenceDate?: Date; // For testing
}

/**
 * P&L category row
 */
export interface PnLCategoryRow {
  categoryId: string;
  parentId: string | null;
  name: string;
  type: "INCOME" | "EXPENSE";
  level: 0 | 1; // 0 = parent, 1 = child
  sortOrder: number;
  totalBase: number;
  children?: PnLCategoryRow[]; // For detailed mode
}

/**
 * P&L totals
 */
export interface PnLTotals {
  income: number;
  expenses: number;
  net: number;
}

/**
 * P&L comparison
 */
export interface PnLComparison {
  current: PnLTotals;
  previous: PnLTotals;
  deltaPct: {
    income: number | null;
    expenses: number | null;
    net: number | null;
  };
}

/**
 * P&L period bounds
 */
export interface PnLPeriodBounds {
  from: Date;
  to: Date;
}

/**
 * P&L result
 */
export interface PnLResult {
  incomeRows: PnLCategoryRow[];
  expenseRows: PnLCategoryRow[];
  comparison: PnLComparison;
  currentPeriod: PnLPeriodBounds;
  previousPeriod: PnLPeriodBounds;
}

/**
 * Category report result row
 */
export interface CategoryReportRow {
  categoryId: string;
  parentId: string | null;
  name: string;
  type: "INCOME" | "EXPENSE";
  level: 0 | 1;
  sortOrder: number;
  transactionCount: number;
  totalBase: number;
  parentName?: string | null;
}

/**
 * Category report result
 */
export interface CategoryReportResult {
  items: CategoryReportRow[];
}

/**
 * Vendor report row
 */
export interface VendorReportRow {
  vendorId: string | null;
  vendorName: string;
  totalIncomeBase: number;
  totalExpenseBase: number;
  netBase: number;
}
