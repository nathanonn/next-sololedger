## Reporting & Exports – Implementation Plan (P&L, Category/Vendor Reports, PDF & CSV)

This plan introduces a dedicated `Reports` area under each organization that provides a configurable Profit & Loss statement (fiscal year/YTD/custom, with comparisons and `includeInPnL` handling), category and vendor summary reports with drill‑downs into the existing Transactions view, plus export capabilities: PDF for P&L and other summary reports (with branding and page numbers) and CSV for transactions (date range, selectable columns, document references), all using base currency and `POSTED` transactions only, and with view vs export access control aligned to roles.

---

### Phase 1 – Routing, Navigation, Access Control

1. **Add `Reports` entry to org navigation**
	 - Update `app/o/[orgSlug]/layout.tsx` to add a new nav item under the `business` section:
		 - `id: "reports"`, `label: "Reports"`, `href: /o/[orgSlug]/reports`.
	 - Ensure the item follows existing nav typing and visibility conventions (e.g. same pattern as `transactions`, `accounts`, `categories`).

2. **Create `Reports` route shell**
	 - Add a new Server Component page at `app/o/[orgSlug]/reports/page.tsx`.
	 - In this page:
		 - Resolve `orgSlug` from `params` and load current user and org using `getCurrentUser` and `getOrgBySlug`.
		 - Require membership using `requireMembership` (redirect if unauthorized) but do not restrict to admins for viewing.
		 - Fetch necessary financial/org settings to pass down (e.g. `baseCurrency`, `dateFormat`, `fiscalYearStartMonth`).
		 - Render a page header (title `Reports`, short description) and a set of shadcn Tabs with four tabs:
			 - `Profit & Loss`
			 - `Category Report`
			 - `Vendor Report`
			 - `Transactions CSV Export`
		 - Each tab renders a feature component from `components/features/reporting/*` (implemented later).

3. **Role‑based access rules**
	 - Determine `isAdminOrSuperadmin` for the current user/org (reusing existing helpers such as `requireAdminOrSuperadmin` or equivalent role checks).
	 - Viewing:
		 - All members with org access can view the `Reports` page and see all four tabs and their data.
	 - Exporting:
		 - Only admins/superadmins may trigger PDF/CSV exports.
		 - Reflect this both in UI (export buttons hidden/disabled for non‑admins) and in API routes (server‑side checks).

---

### Phase 2 – Core P&L Aggregation (Server Helpers)

4. **Define reporting types for P&L**
	 - Create `lib/reporting-types.ts` with strongly typed interfaces:
		 - `PnLDateMode = "fiscalYear" | "ytd" | "custom"`.
		 - `PnLDetailLevel = "summary" | "detailed"`.
		 - `PnLConfig`:
			 - `organizationId: string`.
			 - `fiscalYearStartMonth: number` (1–12).
			 - `dateMode: PnLDateMode`.
			 - `customFrom?: string` and `customTo?: string` (ISO `YYYY-MM-DD`, used when `dateMode = "custom"`).
			 - `detailLevel: PnLDetailLevel`.
			 - Optionally `referenceDate?: Date` for testing.
		 - `PnLCategoryRow`:
			 - `categoryId: string`.
			 - `parentId: string | null`.
			 - `name: string`.
			 - `type: "INCOME" | "EXPENSE"`.
			 - `level: 0 | 1` (0 = parent, 1 = child).
			 - `sortOrder: number`.
			 - `totalBase: number` (aggregated base‑currency amount).
			 - Optional `children?: PnLCategoryRow[]` when building nested structures.
		 - `PnLTotals`:
			 - `income: number`.
			 - `expenses: number`.
			 - `net: number`.
		 - `PnLComparison`:
			 - `current: PnLTotals`.
			 - `previous: PnLTotals`.
			 - `deltaPct: { income: number | null; expenses: number | null; net: number | null }` (percentage changes, null when previous is zero).
		 - `PnLPeriodBounds`:
			 - `from: Date`.
			 - `to: Date`.
		 - `PnLResult`:
			 - `incomeRows: PnLCategoryRow[]`.
			 - `expenseRows: PnLCategoryRow[]`.
			 - `comparison: PnLComparison`.
			 - `currentPeriod: PnLPeriodBounds`.
			 - `previousPeriod: PnLPeriodBounds`.

5. **Implement P&L date range helpers**
	 - Create `lib/reporting-helpers.ts` (or extend if it already exists) and import:
		 - `getFiscalYearRange`, `getYTDRange` from `lib/sololedger-formatters`.
		 - `computePreviousPeriod` from `lib/dashboard-helpers`.
	 - Implement `computePnLDateBounds(config: PnLConfig): PnLPeriodBounds`:
		 - For `dateMode = "fiscalYear"`:
			 - Use `getFiscalYearRange(config.fiscalYearStartMonth, referenceDate)`.
		 - For `dateMode = "ytd"`:
			 - Use `getYTDRange(config.fiscalYearStartMonth, referenceDate)`.
		 - For `dateMode = "custom"`:
			 - If `customFrom` and `customTo` are provided, return these as Date objects.
			 - If missing/invalid, fall back to YTD bounds.
	 - Implement `computePnLComparisonBounds(current: PnLPeriodBounds, dateMode: PnLDateMode, fiscalYearStartMonth: number): PnLPeriodBounds`:
		 - For `"fiscalYear"`:
			 - Use `getFiscalYearRange` with the previous fiscal year (subtract 1 year from the fiscal year determined by current bounds).
		 - For `"ytd"` or `"custom"`:
			 - Use `computePreviousPeriod(current)` to get previous period of equal length.

6. **Implement core P&L aggregation**
	 - In `lib/reporting-helpers.ts` implement `getProfitAndLoss(config: PnLConfig): Promise<PnLResult>`:
		 - Compute `currentPeriod` using `computePnLDateBounds`.
		 - Compute `previousPeriod` using `computePnLComparisonBounds`.
		 - Build a Prisma `TransactionWhereInput` analogous to `buildDashboardTransactionWhere`, but:
			 - Always constrain to `organizationId = config.organizationId`.
			 - Restrict to `status = "POSTED"` (exclude Drafts per requirements).
			 - Filter `date` between `currentPeriod.from` and `currentPeriod.to`.
			 - Filter categories to only those with `includeInPnL = true`.
		 - Query current transactions from `db.transaction`:
			 - Include `category` with `parent` and `type` and `sortOrder`.
			 - Select `amountBase`, `type`, category identifiers.
		 - Aggregate current amounts:
			 - Build a map keyed by categoryId with total `amountBase` per category.
			 - Ensure parent relationships are captured (parent category may have own transactions or only child transactions).
		 - Build parent/child structures:
			 - Load or reuse category metadata (id, name, type, parentId, sortOrder) from the query or via a separate category lookup for the org.
			 - For each category with nonzero totals:
				 - If `parentId` is null, treat as parent; else attach as child to its parent.
			 - For detail level:
				 - Summary: only parent rows, with totals equal to sum of their own + child totals.
				 - Detailed: include parent rows plus explicit child rows, using `children` arrays and `level` to indicate nesting.
			 - Separate rows into `incomeRows` and `expenseRows` by `type`.
		 - Compute `currentTotals`:
			 - `income` = sum of totals across all income categories.
			 - `expenses` = sum of totals across all expense categories.
			 - `net` = `income - expenses`.
		 - Repeat aggregation for previous period:
			 - Run a similar query with dates between `previousPeriod.from` and `previousPeriod.to` and same filters.
			 - Compute `previousTotals` (income/expenses/net) but you do not need per‑category rows for v1 (unless later needed for comparative breakdowns).
		 - Compute percentage deltas:
			 - For each metric, if previous value is 0, set deltaPct to `null`; otherwise `(current - previous) / previous * 100`.
		 - Return a `PnLResult` object with rows, totals, and period metadata.

7. **(Optional) Unit tests for P&L helper**
	 - If you decide to add tests:
		 - Create a small test file (e.g. using your current test tooling) to validate:
			 - Date bounds for fiscal year/YTD/custom.
			 - Previous period computation for different modes.
			 - Correct aggregation of income/expense and net totals for simple synthetic datasets.

---

### Phase 3 – P&L API and UI

8. **P&L API route**
	 - Add `app/api/orgs/[orgSlug]/reports/pnl/route.ts` with `export const runtime = "nodejs"`.
	 - In `GET` or `POST` handler (choose POST if you prefer JSON body):
		 - Authenticate user via `getCurrentUser`; return 401 if not authenticated.
		 - Resolve `{ orgSlug }` from `params` and load org via `getOrgBySlug`; return 404 if missing.
		 - Require membership via `requireMembership`; return 403 if not a member.
		 - Load financial settings for the org (base currency, fiscalYearStartMonth, dateFormat) using the existing financial settings APIs/helpers.
		 - Parse incoming parameters:
			 - `dateMode` (`fiscalYear` | `ytd` | `custom`).
			 - `customFrom` and `customTo` (when `dateMode = "custom"`).
			 - `detailLevel` (`summary` | `detailed`).
		 - Construct a `PnLConfig` using org id and `fiscalYearStartMonth`.
		 - Call `getProfitAndLoss(config)`.
		 - Return the `PnLResult` along with `baseCurrency` and `dateFormat` for client formatting.

9. **P&L tab component (client)**
	 - Create `components/features/reporting/pnl-report.tsx` as a client component.
	 - Props:
		 - `orgSlug: string`.
		 - `baseCurrency: string`.
		 - `dateFormat: DateFormat` (from Prisma type).
		 - `fiscalYearStartMonth: number`.
		 - `isAdmin: boolean` (for export buttons).
	 - Internal state:
		 - `dateMode` (`"fiscalYear"` by default).
		 - `customFrom`, `customTo` (string dates, initially empty).
		 - `detailLevel` (`"summary"` by default).
		 - `loading`, `error`, and `data: PnLResult | null`.
	 - Behavior:
		 - On initial mount and when filters change, call `/api/orgs/${orgSlug}/reports/pnl` with the current config.
		 - Show a loading state (spinner or skeleton) and handle errors with `toast.error`.
	 - UI layout:
		 - Filter row:
			 - Date mode selector (shadcn `Select`) with options `Full fiscal year`, `Year-to-date`, `Custom` mapped to `dateMode`.
			 - When `Custom` is selected, show from/to date inputs or a `Calendar` picker.
			 - Detail level selector (e.g. `RadioGroup` for Summary vs Detailed).
		 - Header:
			 - Business name and logo (from props or higher‑level header) and report title `Profit & Loss Statement`.
			 - Period covered: use `formatDateRange(currentPeriod.from, currentPeriod.to, dateFormat)`.
		 - Summary metrics:
			 - Use a grid or cards to display `Total Income`, `Total Expenses`, `Net Profit/Loss` in base currency using `formatTransactionAmount` or a dedicated base‑only formatter.
			 - Show previous period values and `%` changes, with small up/down indicators where appropriate.
		 - Tables:
			 - Two sections: `Income` and `Expenses`.
			 - For each section, render a table:
				 - Columns: Category, Amount (base currency).
				 - Summary mode: one row per parent category.
				 - Detailed mode: parent rows in bold, child rows indented (e.g. `pl-4`) or using `Parent / Child` notation.
			 - Optional action column with a "View transactions" link (see Phase 6) per row.
		 - Export button:
			 - If `isAdmin`, include `Export to PDF` button that triggers the P&L PDF API (wired in Phase 8).

---

### Phase 4 – Category Report (Server & UI)

10. **Category report helper**
		- Extend `lib/reporting-helpers.ts` to add `getCategoryReport`:
			- Signature: `getCategoryReport(params: { organizationId: string; from: Date; to: Date; typeFilter?: "INCOME" | "EXPENSE" | "both" }): Promise<CategoryReportResult>`.
			- Behavior:
				- Query `db.transaction.findMany` with:
					- `organizationId`.
					- `status: "POSTED"`.
					- `date: { gte: from, lte: to }`.
					- `category` included with `parent`, `type`, `sortOrder`.
					- Optional type filter via `category.type` when `typeFilter` is `INCOME` or `EXPENSE`.
				- Aggregate per category:
					- `transactionCount: number`.
					- `totalBase: number` (sum of `amountBase`).
				- Build a tree/grouping similar to P&L:
					- Parents and children with sort by `sortOrder`.
				- Do **not** filter by `includeInPnL`; all categories are eligible (analytics view).
		- Define `CategoryReportResult` type in `lib/reporting-types.ts`:
			- `items: Array<{ categoryId: string; parentId: string | null; name: string; type: "INCOME" | "EXPENSE"; level: 0 | 1; sortOrder: number; transactionCount: number; totalBase: number; parentName?: string | null }>`.

11. **Category report API**
		- Add `app/api/orgs/[orgSlug]/reports/categories/route.ts` with Node runtime.
		- Handler steps:
			- Authenticate and require membership, as with P&L.
			- Read query params `from`, `to`, and optional `type` (`income`, `expense`, `both`).
			- Validate and parse dates; if missing, consider defaulting to YTD or requiring explicit date range (v1 decision: default to YTD for convenience).
			- Map `type` to `typeFilter` or default to `"both"`.
			- Call `getCategoryReport` and return JSON with `items` plus `baseCurrency` and `dateFormat`.

12. **Category report UI**
		- Create `components/features/reporting/category-report.tsx` as a client component.
		- Props: `orgSlug`, `baseCurrency`, `dateFormat`.
		- State:
			- `from`, `to` (strings) and type filter (`"both" | "INCOME" | "EXPENSE"`).
			- `loading`, `error`, `data: CategoryReportResult | null`.
		- Behavior:
			- On mount, default date range to YTD based on org settings (or last 12 months) and fetch report.
			- On filter change, re-fetch via `/api/orgs/${orgSlug}/reports/categories`.
		- UI:
			- Filter bar: date range inputs and type select (All / Income / Expense).
			- Table:
				- Columns: Category, Type, Transactions, Total (Base), Action.
				- Represent parent/child as in P&L with indentation.
			- Each row has a "View transactions" link/button invoking drill‑down (Phase 6).
			- Admins see an `Export to PDF` button (if you choose to offer PDF for this report) wired later.

---

### Phase 5 – Vendor Report (Server & UI)

13. **Vendor report helper**
		- Extend `lib/reporting-helpers.ts` with `getVendorReport`:
			- Signature: `getVendorReport(params: { organizationId: string; from: Date; to: Date }): Promise<VendorReportRow[]>`.
			- Behavior:
				- Query `db.transaction.findMany` with:
					- `organizationId`.
					- `status: "POSTED"`.
					- `date` between `from` and `to`.
					- Include `vendor` relation (id, name) where it exists.
				- Group by vendor (by `vendorId` when present, otherwise treat `vendorName` as key for loose grouping if you want to include non‑linked vendors):
					- `totalIncomeBase`: sum of `amountBase` where `type = "INCOME"`.
					- `totalExpenseBase`: sum where `type = "EXPENSE"`.
					- `netBase = totalIncomeBase - totalExpenseBase`.
				- Return `VendorReportRow[]` with:
					- `vendorId: string | null`.
					- `vendorName: string`.
					- `totalIncomeBase`, `totalExpenseBase`, `netBase`.
		- Add `VendorReportRow` type to `lib/reporting-types.ts`.

14. **Vendor report API**
		- Add `app/api/orgs/[orgSlug]/reports/vendors/route.ts` with Node runtime.
		- Handler:
			- Authenticate and require membership.
			- Parse `from`, `to`, and optional `view` query param (`all`, `income`, `expense`).
			- Call `getVendorReport`.
			- If `view = "income"`, filter out rows with `totalIncomeBase = 0` (similar for `view = "expense"`). Otherwise keep all rows.
			- Return rows plus `baseCurrency` and `dateFormat`.

15. **Vendor report UI**
		- Create `components/features/reporting/vendor-report.tsx`.
		- Props: `orgSlug`, `baseCurrency`, `dateFormat`.
		- State:
			- `from`, `to` date range.
			- `viewFilter: "all" | "income" | "expense"`.
			- `sortBy` (e.g. `"name" | "netDesc"`).
			- Loading/error/data.
		- Behavior:
			- Default date range to YTD or last 12 months.
			- Fetch vendor report when filters change.
		- UI:
			- Filter row with date range and view filter.
			- Table columns: Vendor, Total Income, Total Expenses, Net, Actions.
			- Sorting controls (e.g. toggle sort by net descending vs name ascending).
			- "View transactions" action per vendor, linking to `Transactions` page with vendor filter (Phase 6).
			- Admin‑only `Export to PDF` button pointing to vendor PDF endpoint (Phase 8).

---

### Phase 6 – Drill‑Down to Transactions

16. **Drill‑down URL conventions**
		- Reuse existing query parameters handled by `app/o/[orgSlug]/transactions/page.tsx`:
			- `type`, `status`, `dateFrom`, `dateTo`, `categoryIds`, `vendorId`, `clientId`, etc.
		- From P&L and Category rows:
			- For Income category rows: link to `/o/${orgSlug}/transactions?type=INCOME&status=POSTED&categoryIds=<categoryId>&dateFrom=<from>&dateTo=<to>`.
			- For Expense category rows: same but with `type=EXPENSE`.
		- From Vendor rows:
			- Link to `/o/${orgSlug}/transactions?vendorId=<vendorId>&status=POSTED&dateFrom=<from>&dateTo=<to>`.

17. **UI wiring for drill‑downs**
		- In P&L, Category, and Vendor report tables:
			- Add an Actions column with a `View transactions` button or link.
			- Use `useRouter` in client components to `push` to the constructed URL.
		- Ensure the `Transactions` page continues to interpret URL params as it already does for filters.

---

### Phase 7 – Branding Data for Report Headers

18. **Schema update for logo support**
		- Add `logoUrl` field to `Organization` model (nullable, Text type).
		- Generate and apply Prisma migration: `npx prisma migrate dev --name add_logo_url_to_organization`.

19. **Branding helper**
		- Create `lib/reporting-branding.ts` with a helper `getOrgBranding(orgId: string)` that returns:
			- `displayName: string` (organization name).
			- `logoUrl: string | null` (from Organization.logoUrl field).
			- `address: string | null`, `email: string | null`, `phone: string | null`, `taxId: string | null` (from OrganizationSettings).
		- Returns an `OrgBranding` interface with all fields.

20. **Reusable report header component**
		- Create `components/features/reporting/report-header.tsx` as a server component.
		- Props: `branding: OrgBranding`, `reportTitle: string`, `periodDescription: string`, `baseCurrency: string`.
		- Renders:
			- Logo (if available) + business name.
			- Business contact info (address, email, phone, tax ID).
			- Report title, period, and currency.
		- Reused across all print routes for consistency.

---

### Phase 8 – Browser-Based PDF Export (Simplified Approach)

21. **Print‑optimized HTML routes for each report**
		- Add the following server component pages that render clean, print‑friendly HTML:
			- `app/o/[orgSlug]/reports/pnl/print/page.tsx`.
			- `app/o/[orgSlug]/reports/categories/print/page.tsx`.
			- `app/o/[orgSlug]/reports/vendors/print/page.tsx`.
		- Each page:
			- Authenticates and requires membership using `getCurrentUser`, `getOrgBySlug`, and `requireMembership`.
			- Parses searchParams mirroring the interactive filters (`dateMode`, `from`, `to`, `detailLevel`, `type`, `view`, etc.).
			- Fetches data using the same helpers (`getProfitAndLoss`, `getCategoryReport`, `getVendorReport`).
			- Fetches branding using `getOrgBranding(org.id)`.
			- Renders:
				- `ReportHeader` component with branding and report metadata.
				- Tables displaying report data (income/expenses, categories, or vendors).
				- Footer with business name and generation date.
			- Uses print-optimized CSS:
				- `@media print` styles for clean PDF output (white background, dark text, proper page breaks).
				- No interactive elements (no buttons, filters, or tabs).
				- Clean table layouts optimized for A4/Letter paper sizes.

22. **Wire export buttons in UI**
		- In each report tab component (`pnl-report.tsx`, `category-report.tsx`, `vendor-report.tsx`):
			- If `isAdmin` is true, enable the `Export to PDF` button (currently disabled placeholder).
			- On click:
				- Construct the print route URL with current filter params as search params.
				- Open URL in new tab using `window.open(url, "_blank")`.
				- User sees clean print view and can press Cmd/Ctrl+P to save as PDF.
			- Example:
				```typescript
				window.open(`/o/${orgSlug}/reports/pnl/print?dateMode=${dateMode}&detailLevel=${detailLevel}`, "_blank");
				```

23. **Remove server-side PDF generation dependencies**
		- Remove `playwright` from `package.json` (no longer needed).
		- No need for `lib/pdf.ts` wrapper or API endpoints for PDF generation.
		- Simpler implementation: browser handles PDF rendering with full user control over print settings (margins, orientation, paper size, etc.).

**Benefits of browser-print approach:**
- Simpler codebase (no headless browser complexity).
- Faster implementation (no server-side rendering overhead).
- Better user experience (users control PDF settings via browser print dialog).
- Reduced server load (no PDF generation compute).
- Works offline once page is loaded.

---

### Phase 9 – Enhanced Transactions CSV Export (Date Range, Columns, Documents)

24. **CSV export helper**
		- Create `lib/export-helpers.ts` with a function `generateTransactionsCsv(config: TransactionCsvExportConfig)`:
			- `TransactionCsvExportConfig`:
				- `organizationId: string`.
				- `from: Date`.
				- `to: Date`.
				- Optional filters: `type?`, `status?` (default `POSTED`), `categoryIds?`, `vendorId?`, `clientId?`.
				- `columns: string[]` representing requested columns (e.g. `"id"`, `"date"`, `"type"`, `"status"`, `"description"`, `"category"`, `"account"`, `"vendor"`, `"client"`, `"amountBase"`, `"currencyBase"`, `"amountSecondary"`, `"currencySecondary"`, `"exchangeRate"`, `"notes"`, `"documentIds"`, `"documentNames"`).
			- Query `db.transaction.findMany` with includes:
				- `category`, `account`, `vendor`, `client`, and `documents` (if you have a documents relation; otherwise adjust accordingly).
			- For each transaction:
				- Compute `exchangeRate` when both base and secondary amounts exist, reusing the logic from `app/api/orgs/[orgSlug]/transactions/export/route.ts`.
				- Build CSV rows using only the requested columns.
				- For document references:
					- `documentIds`: `;`‑separated list of document IDs.
					- `documentNames`: `;`‑separated names or filenames.
			- Generate header row from `columns` to maintain order.
			- Return `{ filename: string; csv: string }`, with filename including date range.

25. **Date‑range export API**
		- Add `app/api/orgs/[orgSlug]/transactions/export-range/route.ts` with Node runtime.
		- Handler behavior:
			- Authenticate user and require admin/superadmin (export access rule).
			- Parse request body (POST) containing:
				- `from`, `to` (required ISO dates).
				- Optional filters (type/status/categoryIds/vendorId/clientId), default status to `POSTED`.
				- `columns` array.
			- Validate date range (e.g. ensure `from <= to` and cap span to a reasonable number of years).
			- Call `generateTransactionsCsv`.
			- Return CSV response with content headers mirroring the existing `transactions/export` route.

26. **Reuse helper in existing selected‑IDs export**
		- Refactor `app/api/orgs/[orgSlug]/transactions/export/route.ts` to:
			- Map its `ids` query parameter to a config that filters `id: { in: [...] }` instead of date range.
			- Optionally allow specifying columns and document flags in query/body; if not provided, default to the current v1 columns.
			- Call `generateTransactionsCsv` to produce the CSV, to keep logic centralized.

27. **Transactions CSV Export UI (Report tab)**
		- Create `components/features/reporting/transactions-export.tsx` as a client component used in the `Transactions CSV Export` tab.
		- Props: `orgSlug`, `isAdmin`.
		- State:
			- `from`, `to` date range.
			- Column selection:
				- Option `All fields` (preselect all columns).
				- Option for custom columns via a checklist (likely using `Checkbox` and a simple list of field labels).
			- Toggles for `Include document IDs` and `Include document names`.
			- `isSubmitting` flag.
		- Behavior:
			- If user is not admin, show a read‑only message explaining that only admins can export CSV.
			- On submit (admin only):
				- POST to `/api/orgs/${orgSlug}/transactions/export-range` with chosen dates and columns.
				- On success, trigger file download (e.g. by creating a Blob URL or by letting the endpoint return a file directly if you call it via `window.location.href` with encoded payload token).
			- Use `toast` for errors and success acknowledgments.

28. **Bulk export improvements (optional v1)**
		- Enhance `handleBulkExportCSV` in `app/o/[orgSlug]/transactions/page.tsx` to:
			- Optionally open a small dialog to collect column preferences before calling the export endpoint.
			- Call either the existing `transactions/export` route (with `ids`) or a new `transactions/export-selected` route that uses the shared helper with id filters.
			- This can reuse the same column definitions used in the `Transactions CSV Export` tab.

---

### Phase 10 – Constraints, Performance, and Polish

29. **Status and date caps**
		- Ensure all reporting queries (P&L, Category, Vendor, CSV) explicitly filter `status = "POSTED"` (per accounting expectations).
		- Enforce a maximum allowed date span for heavy reports (e.g. max 5 years) to avoid pathological queries; return a clear error if exceeded.

30. **Sorting and pagination decisions**
		- P&L:
			- No pagination; number of categories is expected to be manageable.
			- Sort parents and children by `sortOrder` to reflect user‑configured ordering.
		- Category report:
			- Sort primarily by `totalBase` descending or `name` ascending; no pagination in v1 unless you encounter performance issues.
		- Vendor report:
			- Provide sorting (e.g. net descending, name ascending); pagination can be added later if there are many vendors.

31. **Error handling and UX polish**
		- Standardize JSON error responses in report/exports APIs to match existing patterns (e.g. `{ error: string }`).
		- In all client components:
			- Use `toast.error` for failures.
			- Show friendly empty states when no data is returned for a given date range.
		- Ensure the `Reports` page and tab components degrade gracefully when org settings (e.g. fiscal year) are missing or misconfigured.

32. **Incremental rollout strategy**
		- Recommended implementation order:
			1. P&L server helper + API + UI tab (no exports yet).
			2. Category and Vendor server helpers + APIs + UI tabs.
			3. Drill‑downs to Transactions from P&L/Category/Vendor.
			4. CSV export helper + export‑range API + Transactions CSV Export tab.
			5. PDF exports for P&L, Category, Vendor (print views + headless browser integration).
			6. Optional refinements (bulk export column selection, pagination, additional comparisons).
