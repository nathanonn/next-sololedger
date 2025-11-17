In this phase we will turn the existing organization dashboard into a fully featured analytics hub. Server-side, we’ll add Prisma-powered aggregations and a small API surface for YTD/period summaries, month-by-month trends, category breakdowns, and account balances, filtered by date range, category, income/expense view, and origin currency. Client-side, we’ll use Recharts for visualizations, a shared dashboard filter bar (driven by URL params plus per-user defaults), and a widget shell that supports hide/show and reset, with layout stored per membership, while keeping drill-down flows consistent with the existing transactions list.

## Implementation Plan – Dashboard & Analytics (Section 11)

### 1. Inventory existing pieces and define target behavior

1.1 Audit current dashboard implementation

- Review `app/o/[orgSlug]/dashboard/page.tsx` to confirm:
  - YTD cards for income, expenses, profit/loss using `getYTDRange`, `formatCurrency`.
  - Recent activity panel (last 20 transactions) with type/status and “Edit” links.
  - `AccountsOverviewWidget` integration for account balances in base currency.
- Review `components/features/dashboard/accounts-overview-widget.tsx`, `dashboard-shell.tsx`, and `sidebar.tsx` to understand:
  - How widgets are currently composed within the shell.
  - Any existing notions of “widgets” or layout that can be reused.
- Confirm transaction and account model details in `prisma/schema.prisma`:
  - `Transaction`: `type`, `status`, `amountBase`, `currencyBase`, `amountSecondary`, `currencySecondary`, `date`, `deletedAt`, `categoryId`, `accountId`.
  - `Category`: `includeInPnL`, parent/child relationships, color, icon.
  - `Account`: fields used in account balance calculations.
- Review `app/o/[orgSlug]/transactions/page.tsx` to map:
  - Existing filters (date, type, status, category, vendor, amount, currency).
  - URL query param parsing for filters to align drill-down behavior.

Outcome: clear map of what is already satisfied (YTD summary, accounts overview, recent activity) and what must be added (filters, trends, charts, customization, origin currency filters).

### 2. Shared data contracts for dashboard analytics

2.1 Types for filters and data

- Define `DashboardDateRange`:
  - `{ kind: "ytd" | "last30" | "thisMonth" | "lastMonth" | "custom"; from?: string; to?: string }`.
- Define `DashboardFilters`:
  - `dateRange: DashboardDateRange`.
  - `categoryIds: string[]` (selected categories; may include parents that expand to children server-side).
  - `view: "income" | "expense" | "both"` (user choice for income/expense/both view).
  - `originCurrency: "all" | "base" | string` (ISO code for original/secondary currency filter).
- Define core DTOs: - `DashboardSummary`: - `income`, `expenses`, `profitLoss` (current period totals in base currency). - `prevIncome`, `prevExpenses`, `prevProfitLoss` (previous period totals). - `incomeDeltaPct`, `expensesDeltaPct`, `profitLossDeltaPct` (percentage changes). - `DashboardMonthlyPoint`: - `month: string` (e.g. `"2025-01"`). - `income`, `expenses`, `profitLoss`. - `CategoryBreakdownItem`: - `categoryId | "other"`, `name`, `type`, `amountBase`, `transactionCount`, `color?`, `icon?`.

  2.2 Placement

- Put shared types in a central TS file (e.g. `lib/dashboard-types.ts`) to be reused by:
  - `DashboardPage` server logic.
  - Dashboard API routes (if created).
  - Client widgets and chart components.

### 3. Server-side aggregation and filtering logic

3.1 Filter-building helper

- Implement a helper (e.g. `buildDashboardTransactionWhere(filters, orgId)`): - Base constraints: - `organizationId = orgId`. - `status = "POSTED"` (exclude drafts). - `deletedAt = null` (exclude soft-deleted). - Date range: - Use `getYTDRange(settings.fiscalYearStartMonth)` for `kind="ytd"`. - Compute `from/to` for `last30`, `thisMonth`, `lastMonth` on server. - For `custom`, use `from/to` parsed from filters (validate and clamp if needed). - Category filter: - If `categoryIds` is non-empty, restrict to `categoryId in categoryIds`. - Optionally expand parent IDs to include their children by querying `Category` first. - View filter: - `view="income"` → `type = "INCOME"`. - `view="expense"` → `type = "EXPENSE"`. - `view="both"` → no additional type constraint. - Origin currency filter (choice 6/a): - `originCurrency = "all"` → no constraint. - `originCurrency = "base"` → `currencySecondary = null`. - ISO code (e.g. `"USD"`) → `currencySecondary = originCurrency`. - P&L flag: - For summary and P&L-style metrics, ensure `category.includeInPnL = true` via joins or separate queries.

  3.2 Summary metrics (11.1 financial summary)

- Query current period:
  - Aggregate `amountBase` grouped by `type` (INCOME/EXPENSE) using Prisma `groupBy` or raw SQL.
  - Apply `buildDashboardTransactionWhere` for current `from/to`.
- Query previous period:
  - Given `[from, to]`, derive `[prevFrom, prevTo]` as a period of equal length immediately before `from`.
  - Run the same aggregate query against the previous range.
- Compute: - `income`, `expenses`, `profitLoss = income - expenses` for current period. - `prevIncome`, `prevExpenses`, `prevProfitLoss` similarly. - % deltas with safe handling for zero previous values: - `deltaPct = prev === 0 ? null : ((current - prev) / prev) * 100`.

  3.3 Month-over-month trends (11.1 Trends, 11.2 Income vs Expense chart)

- Use `groupBy` or raw SQL with `date_trunc('month', date)`:
  - Group by truncated `month` and `type`.
  - Sum `amountBase` per (month, type).
- Build a normalized list of `DashboardMonthlyPoint` covering all months in the date range, filling missing months with zeros.
- Compute `profitLoss` per month as `income - expenses`.
- Optionally compute month-on-month % change per metric for use in advanced tooltips.

  3.4 Category breakdown (11.2 Category breakdown chart)

- Aggregate by `(categoryId, category.type)` over the current filters:
  - Sum `amountBase` and count transactions.
  - Join `Category` to fetch `name`, `color`, `icon`, `includeInPnL`.
- Apply `includeInPnL` constraint if the breakdown is intended for P&L-style reporting only.
- Build `CategoryBreakdownItem[]` and then: - Sort by absolute `amountBase` descending. - Apply a `topN` slice (e.g. `5/10/15`), summing the rest into an `"other"` bucket.

  3.5 Recent activity (11.2 Recent activity panel)

- Reuse existing `recentTransactions` query in `DashboardPage`:
  - Ensure it includes `status`, `type`, `category`, `account`, and any document linkage or a boolean flag.
  - Limit to 20 items (choice 9/b) ordered by `date desc` and maybe `createdAt desc` as a secondary sort.
- If document linkage is currently modeled as a relation (e.g. `documents`), either: - Include `documents` and check `documents.length > 0` in UI, or - Add a cheap `select` of `documents: { select: { id: true }, take: 1 }` to avoid loading all docs.

  3.6 Account overview alignment (11.1 Account overview)

- Check `AccountsOverviewWidget`:
  - Ensure it uses `amountBase` and respects `status = POSTED`, `deletedAt = null`.
  - Decide whether balances should respect the dashboard’s date range or remain “current to date”:
    - For v1, keep current behavior if it already communicates “current balance”, but accept a `dateRange` prop for future alignment.

### 4. Dashboard filters and state flow

4.1 `DashboardFiltersBar` component

- Create `DashboardFiltersBar` in `components/features/dashboard/` as a client component.
- Props:
  - `initialFilters: DashboardFilters`.
  - `categories: Category[]` (or a minimal view type).
  - `availableOriginCurrencies: string[]` (derived from data or a static list).
  - `orgSlug: string`.
- Controls: - Date range selector (buttons or segmented control): `YTD` (default), `Last 30 days`, `This month`, `Last month`, `Custom`. - For `Custom`, show `from` and `to` date pickers using existing UI primitives. - Category multi-select: - Reuse UX from `TransactionsPage` (popover with search + checkboxes for parent/child categories). - View toggle (choice 7/c but as global view): - Segmented control: `Income`, `Expense`, `Both`. - Origin currency filter (choice 6/a): - Dropdown: `All currencies`, `Base currency only`, followed by a list of ISO codes seen in data (or from your currency list).

  4.2 URL + localStorage persistence (choice 4/c)

- Treat URL query params as source of truth:
  - Encode filters as `?view=both&origin=all&dateKind=ytd&from=YYYY-MM-DD&to=YYYY-MM-DD&categoryIds=id1,id2`.
- On first load in `DashboardPage`:
  - Parse query params into `DashboardFilters`.
  - If no relevant params exist, read defaults from `localStorage` using a key like `dashboardFilters:${userId}:${orgId}`; if none, fall back to `YTD` + `view="both"` + `origin="all"` + no categories.
- On filter change in `DashboardFiltersBar`:
  - Use `router.replace`/`router.push` to update URL query params.
  - Save current `DashboardFilters` to `localStorage` under the same key.
- `DashboardPage` uses the current query params to compute filters and fetch data on each request (SSR), ensuring sharable URLs.

### 5. Metrics cards & visual indicators (11.1)

5.1 Cards layout and content

- Keep three cards in the header area of `DashboardPage`:
  - `YTD/period Income` (green accent, `TrendingUp` icon).
  - `YTD/period Expenses` (red accent, `TrendingDown` icon).
  - `YTD/period Profit/Loss` (color depends on sign).
- Each card shows: - Main value: `formatCurrency(total, settings.baseCurrency, settings.decimalSeparator, settings.thousandsSeparator)`. - Subtext with active date range (e.g. `From 1 Jan 2025 to 17 Nov 2025`).

  5.2 Trend arrows and color coding

- For each metric, use `DashboardSummary` deltas to display:
  - A small line indicating `+X.X% vs previous period` or `-X.X% vs previous period`.
  - An icon from Lucide:
    - `TrendingUp` for positive changes (good direction for the metric).
    - `TrendingDown` for negative changes.
    - `Minus` for no meaningful change or `prev = 0`.
- Define “good direction” per metric:
  - Profit/Loss: higher is better → green for positive delta, red for negative.
  - Income: higher is typically good → green for positive delta, red for negative.
  - Expenses: lower is typically good → green for negative delta, red for positive.

### 6. Charts with Recharts (11.2)

6.1 Library integration

- Add Recharts as a dependency and configure it for client components only.
- Create chart widgets under `components/features/dashboard/`: - `income-expense-chart-widget.tsx`. - `category-breakdown-chart-widget.tsx`.

  6.2 Income vs Expense by month chart

- Component: `IncomeExpenseChartWidget` (client).
- Props:
  - `data: DashboardMonthlyPoint[]`.
  - `filters: DashboardFilters`.
  - `orgSlug: string`.
- Behavior: - Render a line or bar chart with: - X-axis: months (formatted labels like `Jan 2025`). - Y-axis: base currency amounts. - Two series: `Income` and `Expenses`. - Series toggling: - Either use Recharts legend interactivity (click to toggle), or explicit checkboxes bound to local state. - Tooltip: - Use a custom tooltip to show exact monthly amounts formatted via `formatCurrency` and `settings.baseCurrency`. - Drill-down: - On click of a bar/point, compute `from`/`to` for that month and push to: - `/o/${orgSlug}/transactions?from=YYYY-MM-01&to=YYYY-MM-lastDay&view=both&origin=${filters.originCurrency}&categoryIds=${filters.categoryIds.join(",")}`. - Ensure `TransactionsPage` reads these query params to set initial filters.

  6.3 Category breakdown chart

- Component: `CategoryBreakdownChartWidget` (client).
- Props:
  - `data: CategoryBreakdownItem[]`.
  - `filters: DashboardFilters`.
  - `orgSlug: string`.
  - `defaultTopN: number` (e.g. 10).
- UI:
  - View toggle (reuse global `filters.view`, but allow local override if needed):
    - `Income`, `Expense`, `Both` (choice 7/c).
  - Top N selector:
    - Dropdown or small control to choose 5/10/15.
- Rendering:
  - For `view="income"` or `"expense"`:
    - Show a single series bar chart with categories along the X-axis.
  - For `view="both"`:
    - Either stacked bars or side-by-side grouped bars differentiating income vs expense per category.
  - Include an `"Other"` bar when applicable, representing aggregated smaller categories.
- Drill-down: - On bar click: - If not `"other"`, navigate to `TransactionsPage` with `categoryIds` set to the clicked category (and `from/to`, `originCurrency`, `view` preserved).

  6.4 Recent activity panel

- Keep the existing “Recent Activity” card in `DashboardPage`, but ensure it matches requirements:
  - Show last 10–20 transactions (limit at 20).
  - Display for each item:
    - Type badge (`INCOME`/`EXPENSE`).
    - Status badge (`POSTED` vs `DRAFT` with different styles).
    - Linked documents indicator (paperclip icon) if any docs are linked.
    - Description, category, account, date.
    - Amount formatted with base currency and color based on type.
  - Quick actions:
    - `Edit` button linking to `/o/${orgSlug}/transactions/[id]`.
    - `View documents` link or button, wired to existing document view behavior.

### 7. Widget registry and layout customization (hide/show + reset)

7.1 Widget registry

- Introduce `components/features/dashboard/dashboard-config.ts` with a registry: - Each widget definition: - `id: string` (e.g. `"ytd-summary"`, `"income-expense-chart"`, `"category-breakdown"`, `"accounts-overview"`, `"recent-activity"`). - `title`, `description`. - `defaultVisible: boolean`. - `defaultOrder: number`. - `render: (props) => JSX.Element` that wraps the concrete widget component in a `Card`.

  7.2 Layout model

- Define `DashboardLayoutItem` and `DashboardLayout` types:
  - `DashboardLayoutItem = { widgetId: string; visible: boolean; order: number }`.
  - `DashboardLayout = DashboardLayoutItem[]`.
- Default layout: - Derived from registry by order and `defaultVisible` values.

  7.3 Persistence per membership (choice 10/a)

- Add `dashboardLayout Json?` to the membership model in `prisma/schema.prisma`.
- Create helper functions in `lib/org-helpers.ts` or a new `lib/dashboard-helpers.ts`:
  - `getDashboardLayoutForMembership(userId, orgId): Promise<DashboardLayout | null>`.
  - `saveDashboardLayoutForMembership(userId, orgId, layout: DashboardLayout): Promise<void>`.
- Implement `POST /api/orgs/[orgSlug]/dashboard/layout`: - Node runtime. - Authenticates the user, resolves membership by `orgSlug`. - Validates body as `DashboardLayout` (widget IDs must exist in registry). - Persists to the membership’s `dashboardLayout` field.

  7.4 Client customization UI (choice 3/b)

- In `dashboard-shell.tsx` or a dedicated `DashboardLayoutManager` client component:
  - Render widgets in a fixed but responsive grid based on `DashboardLayout` order.
  - Add a “Customize layout” button:
    - Toggles `customizeMode` state.
  - In `customizeMode`:
    - Each widget card header shows a visibility `Switch` or checkbox.
    - Changing visibility updates local layout state.
  - Provide a “Save layout” action:
    - Calls the `dashboard/layout` API to persist changes.
  - Provide a “Reset layout” action:
    - Clears the saved layout on server (e.g. sends empty payload or a special flag).
    - Resets local layout to registry-derived defaults.
- Drag-and-drop is explicitly out of scope for this iteration (can be layered later using `@dnd-kit` or similar).

### 8. Navigation & drill-down consistency

8.1 Query parameter conventions

- Standardize dashboard → transactions links to use: - `from`: start date (YYYY-MM-DD). - `to`: end date (YYYY-MM-DD). - `type`: `"INCOME" | "EXPENSE" | "all"` (align with existing `typeFilter`). - `categoryIds`: comma-separated list of category IDs. - `originCurrency`: `"all" | "base" | ISO code`.

  8.2 Transactions page integration

- Update `app/o/[orgSlug]/transactions/page.tsx` to:
  - On mount, read these query params via `useSearchParams` and set initial state for:
    - `dateFromFilter`, `dateToFilter`.
    - `typeFilter`.
    - `selectedCategoryIds`.
    - `currencyFilter` (mapped from `originCurrency`).
  - Ensure “Apply Filters” uses both state and query params coherently.
- This guarantees that clicks from charts or metrics land the user on a correctly filtered transaction list.

### 9. Validation, testing, and performance

9.1 Business rules validation

- Verify that all dashboard metrics and charts: - Exclude `status !== "POSTED"` transactions. - Exclude `deletedAt != null` transactions. - Respect `includeInPnL` where applicable. - Use `amountBase` (and `currencyBase`) for all arithmetic.

  9.2 Tests

- Unit tests:
  - `buildDashboardTransactionWhere` for various filter combinations.
  - Monthly aggregation helper (ensuring it fills missing months correctly).
  - Category top-N + "Other" grouping helper.
- Integration tests (if infra exists): - Endpoints or page-level loaders for summary, monthly data, category breakdown with differing filters.

  9.3 Performance considerations

- Review and add indexes where necessary:
  - `transaction(organizationId, date, status, deletedAt)`.
  - `transaction(categoryId)` and `transaction(currencySecondary)` if used in filters.
- Keep queries aggregated and avoid per-widget N+1 patterns:
  - When possible, share base `where` conditions and reuse results or combine queries.

With this plan in place, implementation can proceed incrementally: start with shared filters and summary cards, then add the income/expense chart, category breakdown, recent activity enhancements, and finally the widget customization layer.
