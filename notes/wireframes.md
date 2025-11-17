## Reporting & Exports – UX Flow & Wireframes

This document describes the UX flow and ASCII wireframes for the new Reporting area: a `Reports` page under each organization with tabs for Profit & Loss, Category Report, Vendor Report, and Transactions CSV Export, including navigation, filters, drill‑downs into Transactions, and export actions.

---

## UX Flow Map

```text
Entry: Org Dashboard Shell

1. Sidebar Navigation
	 - User is on any `/o/[orgSlug]/...` page
	 - Left sidebar shows sections (e.g. Overview, Business, Settings)
	 - Under Business section, a new item appears: [Reports]

2. Reports Home (Tabs)
	 - Path: /o/[orgSlug]/reports
	 - Auth: Org member or above
	 - Layout:
		 - Header: "Reports" + short description
		 - Tabs:
			 - [Profit & Loss]
			 - [Category Report]
			 - [Vendor Report]
			 - [Transactions CSV Export]

3. Profit & Loss Tab
	 - Path: /o/[orgSlug]/reports (default tab)
	 - Inputs:
		 - Date Mode: (Full fiscal year | Year-to-date | Custom)
		 - Custom From/To (visible when Custom selected)
		 - Detail Level: (Summary | Detailed)
	 - Actions:
		 - View Income/Expense tables
		 - Drill down: View transactions for a given category
		 - Export to PDF (admins only)

4. Category Report Tab
	 - Path: /o/[orgSlug]/reports?tab=categories (or internal tab state)
	 - Inputs:
		 - Date Range From/To
		 - Type Filter: (All | Income | Expense)
	 - Actions:
		 - View category/subcategory totals and counts
		 - Drill down: View transactions for selected category
		 - Export to PDF (admins only)

5. Vendor Report Tab
	 - Path: /o/[orgSlug]/reports?tab=vendors
	 - Inputs:
		 - Date Range From/To
		 - View Filter: (All | Income | Expense)
		 - Optional sort control
	 - Actions:
		 - View totals per vendor (Income, Expense, Net)
		 - Drill down: View transactions for selected vendor
		 - Export to PDF (admins only)

6. Transactions CSV Export Tab
	 - Path: /o/[orgSlug]/reports?tab=export
	 - Inputs:
		 - Date Range From/To
		 - Column selection: (All fields | Custom selection)
		 - Toggles: Include document IDs, Include document names
	 - Actions:
		 - Export CSV (admins only)

7. Drill-Down to Transactions
	 - From P&L/Category/Vendor tables
	 - Opens `/o/[orgSlug]/transactions` with query params:
		 - type, status=POSTED, dateFrom/dateTo, categoryIds, vendorId
	 - User can further refine in Transactions page or navigate back to Reports.

8. PDF Generation Flow
	 - From report tab, admin clicks "Export to PDF"
	 - Browser hits `/api/orgs/[orgSlug]/reports/<report>/pdf?...`
	 - Server renders print route in headless browser and returns PDF
	 - Browser downloads PDF; user can print or share.
```

---

## Screen Wireframes

### 1. Org Layout – Sidebar with Reports

```text
+---------------------------------------------------------------------------------+
| Sololedger Logo                                   User Avatar / Org Switcher   |
+---------------------------------------------------------------------------------+
| Sidebar (left)                         | Main Content                           |
|----------------------------------------+----------------------------------------|
| [Dashboard]                            |                                        |
| [Transactions]                         |   (Any existing org page)              |
| [Accounts]                             |                                        |
| [Categories]                           |                                        |
| [Vendors]                              |                                        |
| [Clients]                              |                                        |
| [Reports]  <-- new                     |                                        |
|                                        |                                        |
| [Settings]                             |                                        |
|   - Organization                       |                                        |
|   - Members                            |                                        |
|   - AI / Integrations                  |                                        |
|                                        |                                        |
+---------------------------------------------------------------------------------+
```

---

### 2. Reports Page – Tabs Shell

```text
Path: /o/[orgSlug]/reports

+---------------------------------------------------------------------------------+
| Header                                                                        |
|-------------------------------------------------------------------------------|
| Reports                                                                       |
| Small text: Overview of profit & loss, category, vendor and export reports.   |
+---------------------------------------------------------------------------------+
| Tabs                                                                          |
|-------------------------------------------------------------------------------|
| [ Profit & Loss ] [ Category Report ] [ Vendor Report ] [ Transactions CSV ]  |
|-------------------------------------------------------------------------------|
|                                                                               |
| (Active tab content below)                                                    |
|                                                                               |
+---------------------------------------------------------------------------------+
```

---

### 3. Profit & Loss Tab – Summary View

```text
Path: /o/[orgSlug]/reports  (Profit & Loss tab active)

+---------------------------------------------------------------------------------+
| Header                                                                        |
|-------------------------------------------------------------------------------|
| Business Logo   Business Name                                                 |
| Title: Profit & Loss Statement                                                |
| Subtitle: Period: 01 Jan 2025 – 31 Dec 2025 (Base: MYR)                      |
+---------------------------------------------------------------------------------+
| Filters Row                                                                   |
|-------------------------------------------------------------------------------|
| Date Mode: [ Full fiscal year v ]  [ Year-to-date ]  [ Custom ]               |
| When Custom: From [ 2025-01-01 ]  To [ 2025-03-31 ]                           |
|                                                                               |
| Detail Level: ( ) Summary    ( ) Detailed                                     |
|                                                                               |
| [ Refresh ]                         [ Export to PDF ] (admins only)           |
+---------------------------------------------------------------------------------+
| Summary Cards                                                                 |
|-------------------------------------------------------------------------------|
| +-----------------+  +-----------------+  +-------------------------------+   |
| | Total Income    |  | Total Expenses  |  | Net Profit / Loss            |   |
| | MYR 125,000.00  |  | MYR 80,000.00   |  | MYR 45,000.00                |   |
| | Prev: 110,000   |  | Prev: 70,000    |  | Prev: 40,000                 |   |
| | +13.6% vs prev  |  | +14.3% vs prev  |  | +12.5% vs prev               |   |
| +-----------------+  +-----------------+  +-------------------------------+   |
+---------------------------------------------------------------------------------+
| Income Section                                                                 |
|-------------------------------------------------------------------------------|
| Heading: Income                                                                |
|                                                                               |
| Summary mode table (parent categories only):                                   |
|                                                                               |
| +-----------------------------------------------+----------------------------+ |
| | Category                                      | Amount (Base)             | |
| +-----------------------------------------------+----------------------------+ |
| | Consulting Revenue                            | MYR 60,000.00             | |
| | Product Sales                                 | MYR 45,000.00             | |
| | Other Income                                  | MYR 20,000.00             | |
| +-----------------------------------------------+----------------------------+ |
| | Total Income                                  | MYR 125,000.00            | |
| +-----------------------------------------------+----------------------------+ |
| (Per-row action: [View transactions])                                            |
+---------------------------------------------------------------------------------+
| Expenses Section                                                                |
|-------------------------------------------------------------------------------|
| Heading: Expenses                                                               |
|                                                                               |
| +-----------------------------------------------+----------------------------+ |
| | Category                                      | Amount (Base)             | |
| +-----------------------------------------------+----------------------------+ |
| | Operating Expenses                           | MYR 30,000.00             | |
| | Payroll                                      | MYR 35,000.00             | |
| | Travel & Meals                               | MYR 10,000.00             | |
| | Other Expenses                               | MYR 5,000.00              | |
| +-----------------------------------------------+----------------------------+ |
| | Total Expenses                               | MYR 80,000.00             | |
| +-----------------------------------------------+----------------------------+ |
| (Per-row action: [View transactions])                                            |
+---------------------------------------------------------------------------------+
```

---

### 4. Profit & Loss Tab – Detailed View (with Parent + Child)

```text
Path: /o/[orgSlug]/reports  (Profit & Loss tab, Detailed)

Filters row same as Summary, Detail Level = Detailed.

Income table (example):

+-----------------------------------------------------------+------------------+
| Category                                                  | Amount (Base)    |
+-----------------------------------------------------------+------------------+
| Consulting Revenue                                       | MYR 60,000.00    |
|   - Consulting / Retainer                                | MYR 40,000.00    |
|   - Consulting / Hourly                                  | MYR 20,000.00    |
| Product Sales                                            | MYR 45,000.00    |
|   - Product / Hardware                                   | MYR 30,000.00    |
|   - Product / Software                                   | MYR 15,000.00    |
| Other Income                                             | MYR 20,000.00    |
|   - Interest Income                                      | MYR 5,000.00     |
|   - Miscellaneous                                       | MYR 15,000.00    |
+-----------------------------------------------------------+------------------+
| Total Income                                             | MYR 125,000.00   |
+-----------------------------------------------------------+------------------+

Expenses table structured similarly, with parent rows and indented children.
Each row can still expose [View transactions] actions.
```

---

### 5. Category Report Tab

```text
Path: /o/[orgSlug]/reports  (Category Report tab active)

+---------------------------------------------------------------------------------+
| Header                                                                        |
|-------------------------------------------------------------------------------|
| Category Report                                                               |
| Subtitle: Totals by category and subcategory for a selected date range.      |
+---------------------------------------------------------------------------------+
| Filters Row                                                                   |
|-------------------------------------------------------------------------------|
| From [ 2025-01-01 ]   To [ 2025-03-31 ]   Type: [ All v ] (Income | Expense) |
|                                                                               |
| [ Apply ]                         [ Export to PDF ] (admins only)            |
+---------------------------------------------------------------------------------+
| Table                                                                         |
|-------------------------------------------------------------------------------|
| Columns: Category | Type | Transactions | Total (Base) | Actions             |
|                                                                               |
| +-----------------------------------+--------+-------------+-----------------+ |
| | Consulting Revenue                | INCOME | 12          | MYR 40,000.00   | |
| |   - Consulting / Retainer        | INCOME | 7           | MYR 25,000.00   | |
| |   - Consulting / Hourly          | INCOME | 5           | MYR 15,000.00   | |
| | Product Sales                    | INCOME | 20          | MYR 30,000.00   | |
| |   - Product / Hardware           | INCOME | 10          | MYR 18,000.00   | |
| |   - Product / Software           | INCOME | 10          | MYR 12,000.00   | |
| | Operating Expenses               | EXPENSE| 15          | MYR 18,000.00   | |
| |   - Office Supplies              | EXPENSE| 8           | MYR 6,000.00    | |
| |   - Utilities                    | EXPENSE| 7           | MYR 12,000.00   | |
| +-----------------------------------+--------+-------------+-----------------+ |
| | (Action column) [View transactions] for each row                           |
|-------------------------------------------------------------------------------|
| Empty state: "No transactions found for this range."                         |
+---------------------------------------------------------------------------------+
```

---

### 6. Vendor Report Tab

```text
Path: /o/[orgSlug]/reports  (Vendor Report tab active)

+---------------------------------------------------------------------------------+
| Header                                                                        |
|-------------------------------------------------------------------------------|
| Vendor Report                                                                 |
| Subtitle: Total income, expenses and net per vendor for a period.            |
+---------------------------------------------------------------------------------+
| Filters Row                                                                   |
|-------------------------------------------------------------------------------|
| From [ 2025-01-01 ]   To [ 2025-03-31 ]   View: [ All v ]                    |
| Sort by: [ Net (desc) v ]                                                    |
|                                                                               |
| [ Apply ]                         [ Export to PDF ] (admins only)            |
+---------------------------------------------------------------------------------+
| Table                                                                         |
|-------------------------------------------------------------------------------|
| Columns: Vendor | Total Income | Total Expenses | Net | Actions               |
|                                                                               |
| +----------------------+--------------+----------------+--------------------+ |
| | ACME Supplies        | MYR 0.00     | MYR 25,000.00  | -MYR 25,000.00     | |
| | Big Client Co        | MYR 60,000.00| MYR 0.00       |  MYR 60,000.00     | |
| | Freelance Designer   | MYR 5,000.00 | MYR 3,000.00   |  MYR 2,000.00      | |
| +----------------------+--------------+----------------+--------------------+ |
| | (Actions) [View transactions] per row                                      |
|-------------------------------------------------------------------------------|
| Empty state: "No vendor activity in this period."                            |
+---------------------------------------------------------------------------------+
```

---

### 7. Transactions CSV Export Tab

```text
Path: /o/[orgSlug]/reports  (Transactions CSV Export tab active)

+---------------------------------------------------------------------------------+
| Header                                                                        |
|-------------------------------------------------------------------------------|
| Transactions CSV Export                                                      |
| Subtitle: Export raw transaction data for analysis in spreadsheets.          |
+---------------------------------------------------------------------------------+
| Access Notice                                                                 |
|-------------------------------------------------------------------------------|
| If user is not admin:                                                        |
|   "Only organization admins can export transactions to CSV."                |
|   (Disable the form below.)                                                  |
| If admin: show full form.                                                    |
+---------------------------------------------------------------------------------+
| Export Form (admins only)                                                    |
|-------------------------------------------------------------------------------|
| Date Range                                                                   |
|   From [ 2025-01-01 ]   To [ 2025-03-31 ]                                    |
|                                                                               |
| Columns                                                                      |
|   ( ) All fields                                                             |
|   (o) Custom selection                                                       |
|       [x] ID                                                                 |
|       [x] Date                                                               |
|       [x] Type                                                               |
|       [x] Status                                                             |
|       [x] Description                                                        |
|       [x] Category                                                           |
|       [x] Account                                                            |
|       [x] Vendor                                                             |
|       [x] Client                                                             |
|       [x] Amount (Base)                                                      |
|       [x] Currency (Base)                                                    |
|       [ ] Amount (Secondary)                                                 |
|       [ ] Currency (Secondary)                                               |
|       [ ] Exchange Rate                                                      |
|       [x] Notes                                                              |
|       [ ] Document IDs                                                       |
|       [ ] Document Names                                                     |
|                                                                               |
| [ Export CSV ]                                                               |
| (Shows toast on success/failure; triggers file download)                     |
+---------------------------------------------------------------------------------+
```

---

### 8. Drill-Down: Transactions Page (Filtered)

```text
Path example from P&L: /o/[orgSlug]/transactions?type=EXPENSE&status=POSTED&categoryIds=cat123&dateFrom=2025-01-01&dateTo=2025-03-31

+---------------------------------------------------------------------------------+
| Header: Transactions                                                          |
|-------------------------------------------------------------------------------|
| Filters row shows:                                                            |
|   Type: [ Expense ]    Status: [ Posted ]                                     |
|   Date From: [ 2025-01-01 ]   Date To: [ 2025-03-31 ]                        |
|   Category: [ Selected 1 ]                                                   |
|   Vendor: [ All vendors ]                                                    |
|   ... (existing filters)                                                     |
|                                                                               |
| [ Clear filters ]                                                             |
+---------------------------------------------------------------------------------+
| Transactions table as currently implemented.                                  |
| User can adjust filters or navigate back to Reports.                          |
+---------------------------------------------------------------------------------+
```

---

### 9. Print Layout for PDF (Generic Pattern)

```text
Used by /o/[orgSlug]/reports/*/print routes.

+---------------------------------------------------------------------------------+
| Top Header (minimal, print-friendly)                                         |
|-------------------------------------------------------------------------------|
| [Logo]  Business Name                                                        |
|                                                                               |
| Report Title (e.g. "Profit & Loss Statement")                               |
| Period: 01 Jan 2025 – 31 Dec 2025                                            |
| Base Currency: MYR                                                           |
+---------------------------------------------------------------------------------+
| Report Body (tables as in interactive view, but without tabs or filters)     |
|-------------------------------------------------------------------------------|
| Income table                                                                 |
| Expenses table                                                               |
| Totals summary                                                               |
| (For Category/Vendor reports, the relevant tables)                           |
+---------------------------------------------------------------------------------+
| Footer (printed on each page via PDF header/footer templates)                |
|-------------------------------------------------------------------------------|
| Business Name • Generated on 2025-11-17 • Page X of Y                        |
+---------------------------------------------------------------------------------+
```
