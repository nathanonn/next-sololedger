/**
 * Dashboard Widget Registry
 * Defines all available dashboard widgets and their default configuration
 */

import type { DashboardWidgetDefinition } from "@/lib/dashboard-types";

/**
 * Registry of all available dashboard widgets
 */
export const DASHBOARD_WIDGETS: Record<string, DashboardWidgetDefinition> = {
  "ytd-summary": {
    id: "ytd-summary",
    title: "Financial Summary",
    description: "Income, expenses, and profit/loss metrics with period comparison",
    defaultVisible: true,
    defaultOrder: 1,
  },
  "income-expense-chart": {
    id: "income-expense-chart",
    title: "Income vs Expense Trends",
    description: "Monthly income and expense trends over time",
    defaultVisible: true,
    defaultOrder: 2,
  },
  "category-breakdown": {
    id: "category-breakdown",
    title: "Category Breakdown",
    description: "Top categories by income or expense",
    defaultVisible: true,
    defaultOrder: 3,
  },
  "accounts-overview": {
    id: "accounts-overview",
    title: "Accounts Overview",
    description: "Account balances and transaction counts",
    defaultVisible: true,
    defaultOrder: 4,
  },
  "recent-activity": {
    id: "recent-activity",
    title: "Recent Activity",
    description: "Latest transactions across all accounts",
    defaultVisible: true,
    defaultOrder: 5,
  },
};

/**
 * Get default dashboard layout
 */
export function getDefaultDashboardLayout() {
  return Object.values(DASHBOARD_WIDGETS).map((widget) => ({
    widgetId: widget.id,
    visible: widget.defaultVisible,
    order: widget.defaultOrder,
  }));
}

/**
 * Validate and merge user layout with defaults
 * Ensures all widget IDs are valid and adds any new widgets
 */
export function mergeDashboardLayout(
  userLayout: unknown
): ReturnType<typeof getDefaultDashboardLayout> {
  const defaultLayout = getDefaultDashboardLayout();

  // If no user layout, return defaults
  if (!userLayout || !Array.isArray(userLayout)) {
    return defaultLayout;
  }

  // Create a map of user preferences
  const userMap = new Map(
    userLayout.map((item: { widgetId: string; visible?: boolean; order?: number }) => [
      item.widgetId,
      item,
    ])
  );

  // Merge: use user preferences if valid, otherwise use defaults
  const merged = defaultLayout.map((defaultItem) => {
    const userItem = userMap.get(defaultItem.widgetId);
    if (userItem && DASHBOARD_WIDGETS[userItem.widgetId]) {
      return {
        widgetId: defaultItem.widgetId,
        visible: typeof userItem.visible === "boolean" ? userItem.visible : defaultItem.visible,
        order: typeof userItem.order === "number" ? userItem.order : defaultItem.order,
      };
    }
    return defaultItem;
  });

  // Sort by order
  return merged.sort((a, b) => a.order - b.order);
}
