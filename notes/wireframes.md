# Sololedger Milestone 1 – UX Flow & Wireframes (Copilot)

## 1. High-level UX Flow Map

```text
User signs in
	 |
	 v
Has at least one organization?
	 |-- No -------------------------------> Onboarding Step 1: Create Business
	 |                                         |
	 |                                         v
	 |                            Organization created (onboardingComplete = false)
	 |                                         |
	 |                                         v
	 |-------------------------------> Onboarding Step 2: Business Details
																						 |
																						 v
																		Onboarding Step 3: Financial Config
																						 |
																						 v
																		Onboarding Step 4: Category Setup
																						 |
																						 v
															 Mark onboardingComplete = true for organization
																						 |
																						 v
															 Redirect to /o/[orgSlug]/dashboard


When accessing any /o/[orgSlug]/... route:

	Request -> Check auth & membership -> Check org.onboardingComplete
		|                                        |
		|                                        |-- false --> Redirect to next onboarding step
		|                                        |
		|                                        `-- true  --> Allow normal access
		v
	Load Business Shell
		|
		v
	Sidebar navigation (Business section):
		- Dashboard (/o/[orgSlug]/dashboard)
		- Transactions (/o/[orgSlug]/transactions)
		- Accounts (/o/[orgSlug]/settings/accounts)
		- Categories (/o/[orgSlug]/settings/categories)
```

---

## 2. Onboarding – Step 1: Create Business (Organization)

Route: `/onboarding/create-organization`

```text
+--------------------------------------------------------------+
| Centered card (max-w-md)                                    |
|                                                              |
|  [Title]  Create your business                              |
|  [Desc]   Set up a business to track your Sololedger data.  |
|                                                              |
|  [Progress indicator] Step 1 of 4                           |
|                                                              |
|  [Form]                                                     |
|    Label: Business name                                     |
|    [ Input: name ____________________________ ]             |
|    (Error message line, if any)                             |
|                                                              |
|    Label: Business URL                                      |
|    [ Input: slug _____________________________ ]            |
|    (Small text)                                             |
|      https://app.example.com/o/{slug-or-your-business}      |
|    (Helper text) "You can't change this later."            |
|                                                              |
|  [Primary button]  Continue                                 |
|  [Subtext]      Linked to your account {user.name}          |
|                                                              |
|  (On submit)                                                |
|    - POST /api/orgs (name, slug)                            |
|    - On success: redirect to                                |
|        /onboarding/{orgSlug}/business                       |
|                                                              |
|  (Error toast) "Failed to create business"                  |
|                                                              |
+--------------------------------------------------------------+
```

---

## 3. Onboarding – Step 2: Business Details

Route: `/onboarding/[orgSlug]/business`

```text
+-------------------------------------------------------------------+
| Onboarding layout (full page, centered card or narrow column)     |
|                                                                   |
|  Top bar:                                                         |
|    [Sololedger logo] ["Welcome, {user.name}"]                     |
|    [Step indicator]  Step 2 of 4 – Business details              |
|                                                                   |
|  [Card / Panel]                                                   |
|    [Title] Tell us about your business                           |
|    [Desc] This helps personalize your Sololedger setup.          |
|                                                                   |
|    [Form]                                                         |
|      Row:                                                         |
|        Label: Business name (*)                                   |
|        [ Input: businessName ____________________________ ]       |
|        (Prefilled from Organization.name)                         |
|        (Error line if empty)                                      |
|                                                                   |
|      Row:                                                         |
|        Label: Business type (*)                                   |
|        [ Select v ]                                               |
|          - Freelance                                              |
|          - Consulting                                             |
|          - Agency                                                 |
|          - SaaS                                                   |
|          - Other                                                  |
|        (Error line if not selected)                               |
|                                                                   |
|      Conditional row:                                             |
|        Shown only when type == "Other"                            |
|        Label: Describe your business                              |
|        [ Input: businessTypeOther _________________________ ]     |
|        (Error if empty when type == Other)                        |
|                                                                   |
|      Optional section:                                            |
|        [Subheading] Contact details (optional)                    |
|                                                                   |
|        Label: Address                                             |
|        [ Textarea / multi-line input _______________________ ]    |
|                                                                   |
|        Label: Phone                                               |
|        [ Input: phone _________________________________ ]         |
|                                                                   |
|        Label: Email                                               |
|        [ Input: email _________________________________ ]         |
|                                                                   |
|        Label: Tax ID / Registration                               |
|        [ Input: taxId _________________________________ ]         |
|                                                                   |
|    [Footer buttons]                                              |
|      [Secondary] Back                                            |
|      [Primary]  Save & Continue                                  |
|                                                                   |
|    (On Save & Continue)                                          |
|      - POST/PATCH /api/orgs/{orgId}/settings/business            |
|          - Update Organization.name                              |
|          - Upsert OrganizationSettings business fields           |
|      - On success: redirect to                                   |
|          /onboarding/{orgSlug}/financial                         |
|      - On error: toast error message                             |
|                                                                   |
|  Bottom: small text "You can change these later in Settings →    |
|           Business (Owner/Admin only)."                          |
|                                                                   |
+-------------------------------------------------------------------+
```

---

## 4. Onboarding – Step 3: Financial Configuration

Route: `/onboarding/[orgSlug]/financial`

```text
+-------------------------------------------------------------------+
| Onboarding layout                                                 |
|                                                                   |
|  Top bar:                                                         |
|    [Logo] ["Hi {user.name}, let's configure your finances"]      |
|    [Step indicator] Step 3 of 4 – Financial configuration         |
|                                                                   |
|  [Card / Panel]                                                   |
|    [Title] Financial configuration                               |
|    [Desc] Choose your base currency, fiscal year, and formats.   |
|                                                                   |
|    [Form]                                                         |
|      Section: Base currency (*)                                   |
|        Label: Base currency                                       |
|        [ Select (searchable) v ]                                  |
|          - MYR – Malaysian Ringgit (top)                          |
|          - USD – US Dollar                                       |
|          - EUR – Euro                                            |
|          - GBP – British Pound                                   |
|          - SGD – Singapore Dollar                                |
|          - Other... (opens custom input)                         |
|        When "Other" is selected:                                |
|          Label: Enter currency code (ISO 4217)                    |
|          [ Input: baseCurrencyCustom ___ ] (3 upper-case chars)   |
|        Helper text: "Reports and dashboards use this currency."  |
|        Error line if missing.                                     |
|                                                                   |
|      Section: Fiscal year start (*)                               |
|        Label: Fiscal year starts in                               |
|        [ Select month v ]                                         |
|          - January (1) (default)                                  |
|          - February (2)                                           |
|          ...                                                      |
|          - December (12)                                          |
|        Helper text: "Used to calculate YTD and fiscal labels."   |
|                                                                   |
|      Section: Date format                                         |
|        Label: Date format                                         |
|        (Radio or select)                                          |
|          ( ) DD/MM/YYYY                                           |
|          ( ) MM/DD/YYYY                                           |
|          (●) YYYY-MM-DD (default)                                 |
|        Preview (based on today):                                  |
|          "Preview: 2025-01-31"                                    |
|                                                                   |
|      Section: Number format                                       |
|        Label: Decimal separator                                   |
|        [ Select v ]  {DOT (.) , COMMA (,)} (default: DOT)         |
|                                                                   |
|        Label: Thousands separator                                 |
|        [ Select v ]  {COMMA, DOT, SPACE, NONE} (default: COMMA)   |
|                                                                   |
|        Preview text:                                              |
|          "Preview: 1,234.56" (using current selections)          |
|                                                                   |
|    [Footer buttons]                                              |
|      [Secondary] Back                                            |
|      [Primary]  Save & Continue                                  |
|                                                                   |
|    (On Save & Continue)                                          |
|      - PATCH /api/orgs/{orgId}/settings/financial                |
|      - Ensure baseCurrency and fiscalYearStartMonth set          |
|      - On success: redirect to                                   |
|          /onboarding/{orgSlug}/categories                        |
|                                                                   |
|  Bottom helper:                                                   |
|    "Owners/Admins can change these later in Business Settings.   |
|      We’ll show a warning before applying changes."              |
|                                                                   |
+-------------------------------------------------------------------+
```

---

## 5. Onboarding – Step 4: Category Setup

Route: `/onboarding/[orgSlug]/categories`

```text
+-------------------------------------------------------------------+
| Onboarding layout                                                 |
|                                                                   |
|  Top bar:                                                         |
|    [Logo] ["Set up your categories"]                             |
|    [Step indicator] Step 4 of 4 – Categories                      |
|                                                                   |
|  [Card / Panel]                                                   |
|    [Title] Income & expense categories                           |
|    [Desc] Start with a few useful categories. You can tweak      |
|           these later in Settings.                               |
|                                                                   |
|    [Info banner]                                                 |
|      "We’ve created some defaults for you (Owner contributions,  |
|       Tax, Transfers). You need at least one Income and one      |
|       Expense category to finish onboarding."                    |
|                                                                   |
|    Layout: two columns on desktop (stack on mobile)              |
|                                                                   |
|    Left column: Income                                            |
|      [Heading] Income categories                                 |
|      [Table]                                                      |
|        Columns: Name | Include in P&L | Active | Actions          |
|        Rows (seeded):                                              |
|          - General Income  | Yes | Active | [Edit]                |
|          - Tax Collected   | Yes | Active | [Edit]                |
|          - Owner Contributions | No | Active | [Edit]             |
|          - Transfers In    | No  | Active | [Edit]                |
|                                                                   |
|      [Button] + Add income category                              |
|        (Opens simple inline dialog: Name, Parent (optional),     |
|         Include in P&L, Color, Icon)                             |
|                                                                   |
|    Right column: Expense                                         |
|      [Heading] Expense categories                                |
|      [Table]                                                      |
|        Columns: Name | Include in P&L | Active | Actions          |
|        Rows (seeded):                                              |
|          - General Expense  | Yes | Active | [Edit]               |
|          - Tax Paid         | Yes | Active | [Edit]               |
|          - Owner Drawings   | No  | Active | [Edit]               |
|          - Transfers Out    | No  | Active | [Edit]               |
|                                                                   |
|      [Button] + Add expense category                             |
|                                                                   |
|    [Validation note]                                             |
|      - If Income list has no active rows → disable Finish button  |
|      - If Expense list has no active rows → disable Finish button |
|                                                                   |
|    [Footer buttons]                                              |
|      [Secondary] Back                                            |
|      [Primary]  Finish setup                                     |
|                                                                   |
|    (On Finish setup)                                             |
|      - Verify at least one active income & one active expense     |
|      - Mark org.onboardingComplete = true                         |
|      - Redirect to /o/{orgSlug}/dashboard                        |
|                                                                   |
|  Bottom helper:                                                   |
|    "You can refine categories later under Business → Categories."|
|                                                                   |
+-------------------------------------------------------------------+
```

---

## 6. Organization Shell (Business Section)

Route wrapper: `app/o/[orgSlug]/layout.tsx`

```text
+-------------------------------------------------------------------+
| Top app bar                                                      |
|  [Sololedger logo] [Current business name ▼] [User menu]         |
|                                                                   |
| Layout: Sidebar (left) + Main content (right)                    |
|                                                                   |
| Sidebar:                                                          |
|   Section: Business                                              |
|     - Dashboard        → /o/[orgSlug]/dashboard                  |
|     - Transactions     → /o/[orgSlug]/transactions               |
|     - Accounts         → /o/[orgSlug]/settings/accounts          |
|     - Categories       → /o/[orgSlug]/settings/categories        |
|   (Other boilerplate sections collapsed or hidden by default)    |
|                                                                   |
| Main content:                                                    |
|   [Outlet for page-specific content]                             |
|   (Dashboard, Transactions, Accounts, Categories etc.)           |
|                                                                   |
| On load:                                                         |
|   - Check onboardingComplete; if false, redirect to onboarding.  |
|                                                                   |
+-------------------------------------------------------------------+
```

---

## 7. Business Dashboard

Route: `/o/[orgSlug]/dashboard`

```text
+-------------------------------------------------------------------+
| Header row                                                       |
|  [Title] {Business name} dashboard                               |
|  [Subtext] Overview (YTD in {baseCurrency})                      |
|  Right side: [Org switcher] [Date range badge: YTD]              |
|                                                                   |
| Metrics cards row (3 cards)                                      |
|  +-------------------+  +-------------------+  +-----------------+
|  | YTD Income        |  | YTD Expenses      |  | YTD Profit/Loss |
|  |  {amountBase}     |  |  {amountBase}     |  |  {income-exp}   |
|  |  {currency code}  |  |  {currency code}  |  |  {currency code}|
|  |  (green/red trend)|  |  (trend indicator)|  |  (trend arrow)  |
|  +-------------------+  +-------------------+  +-----------------+
|                                                                   |
| Section: Account balances                                        |
|  [Card]                                                          |
|    [Heading] Accounts                                            |
|    [Table]                                                       |
|      Columns: Account | Active | Balance ({baseCurrency})        |
|      Rows:                                                |
|        - Main Account      | Yes    |  12,345.67                 |
|        - PayPal            | Yes    |   1,234.00                 |
|        - Closed Account    | No     |     0.00                   |
|    [Link] Manage accounts → /o/[orgSlug]/settings/accounts       |
|                                                                   |
| Section: Recent activity                                         |
|  [Card]                                                          |
|    [Heading] Recent activity                                     |
|    [Table]                                                       |
|      Columns: Date | Description | Type | Category | Account |    |
|               Amount ({base}) | Status | Actions                 |
|      Rows (last 10–20 txns, Draft + Posted):                     |
|        - 2025-01-31 | Client invoice #123 | Income | General    |
|          Main Account | 5,000.00 | [Badge: Posted] | [Edit]     |
|        - 2025-01-30 | Facebook Ads Jan   | Expense| Marketing   |
|          Main Account |  500.00  | [Badge: Draft]  | [Edit]     |
|                                                                   |
|    [Link] View all transactions → /o/[orgSlug]/transactions      |
|                                                                   |
+-------------------------------------------------------------------+
```

---

## 8. Transactions – List & Filters

Route: `/o/[orgSlug]/transactions`

```text
+-------------------------------------------------------------------+
| Header row                                                       |
|  [Title] Transactions                                            |
|  Right: [Button] + New transaction                              |
|                                                                   |
| Filters bar (horizontal)                                         |
|  [Date range picker: From ___ To ___]                            |
|  [Select: Type v]  (All, Income, Expense)                         |
|  [Select: Status v] (All, Draft, Posted)                          |
|  [Search box] Search description or vendor...                     |
|                                                                   |
| Transactions table                                               |
|  Columns:                                                        |
|    Date | Description | Type | Category | Account | Amount ({base}) |
|    Status | Actions                                         |
|                                                                   |
|  Rows:                                                            |
|    - 2025-01-31 | Client invoice #123 | Income  | General Income  |
|      Main Account | 5,000.00 | [Posted] | [Edit] [Delete]         |
|    - 2025-01-30 | FB Ads Jan         | Expense | Marketing        |
|      Main Account |   500.00 | [Draft]  | [Edit] [Delete]         |
|                                                                   |
|  [Pagination controls]                                           |
|                                                                   |
| (Delete) → soft delete: sets deletedAt, row disappears           |
|                                                                   |
| [New transaction button] opens create page                        |
|   /o/[orgSlug]/transactions/new (or same page modal)             |
|                                                                   |
+-------------------------------------------------------------------+
```

---

## 9. Transaction Create/Edit Page

Routes:

- Create: `/o/[orgSlug]/transactions/new`
- Edit: `/o/[orgSlug]/transactions/[id]`

```text
+-------------------------------------------------------------------+
| Header row                                                       |
|  [Back link] ← Back to transactions                              |
|  [Title] {New transaction | Edit transaction}                    |
|                                                                   |
| [Card / Form container]                                          |
|                                                                   |
|  Row: Type (*)                                                   |
|    Label: Type                                                   |
|    [ Segmented control ]  [● Income] [○ Expense]                 |
|                                                                   |
|  Row: Status (*)                                                 |
|    Label: Status                                                 |
|    [ Select v ] Draft | Posted                                   |
|                                                                   |
|  Row: Amount (*) & Currency (*)                                  |
|    Label: Amount                                                 |
|    [ Input: amountOriginal __________ ]                          |
|                                                                   |
|    Label: Currency                                               |
|    [ Select v ] (default baseCurrency; options: MYR, USD, etc.)  |
|                                                                   |
|  Row: Exchange rate to base (*) (when currency != base)          |
|    Label: Exchange rate to {baseCurrency}                         |
|    [ Input: exchangeRateToBase ______ ] (prefilled 1.00000000)   |
|    Helper: "We’ll calculate base amount using amount × rate."    |
|                                                                   |
|  Row: Base amount (read-only)                                    |
|    Label: Base amount ({baseCurrency})                           |
|    [ Read-only: amountBase ________ ]                            |
|                                                                   |
|  Row: Date (*)                                                   |
|    Label: Date                                                   |
|    [ Date picker ] (formatted per dateFormat)                    |
|    Validation:                                                   |
|      - Draft: allow future date, show warning icon+text          |
|      - Posted: block future date, show error message             |
|                                                                   |
|  Row: Description (*)                                            |
|    [ Input: description _________________________________ ]      |
|                                                                   |
|  Row: Category (*)                                               |
|    [ Select v ]  (filters to Income or Expense categories        |
|                    matching transaction type)                    |
|                                                                   |
|  Row: Account (*)                                                |
|    [ Select v ]  (list of active accounts)                       |
|                                                                   |
|  Row: Vendor (optional)                                          |
|    [ Input: vendorName (free text) ________________________ ]    |
|                                                                   |
|  Row: Notes (optional)                                           |
|    [ Textarea notes _________________________________ ]          |
|                                                                   |
| [Footer buttons]                                                 |
|   [Secondary] Cancel                                             |
|   [Primary]  Save                                                |
|                                                                   |
| (On Save)                                                        |
|   - Validate all rules (amount > 0, category type match,         |
|     date rules, FX calculations)                                 |
|   - POST/PATCH /api/orgs/{orgId}/transactions                    |
|   - On success: redirect back to /o/{orgSlug}/transactions       |
|                                                                   |
| (On Delete in edit view)                                         |
|   - Confirm dialog                                               |
|   - Soft delete via DELETE API                                   |
|                                                                   |
+-------------------------------------------------------------------+
```

---

## 10. Accounts Management

Route: `/o/[orgSlug]/settings/accounts`

```text
+-------------------------------------------------------------------+
| Header row                                                       |
|  [Title] Accounts                                                |
|  [Subtext] Where your money lives (bank, cash, payment services).|
|  Right: [Button] + New account                                   |
|                                                                   |
| Accounts table                                                   |
|  Columns: Name | Description | Default | Active | Actions         |
|                                                                   |
|  Rows:                                                             |
|    - Main Account     | Primary bank              | Yes | Yes | [Edit] |
|    - Cash             | Cash on hand             | No  | Yes | [Edit] |
|    - Old Bank         | Closed 2023              | No  | No  | [Edit] |
|                                                                   |
|  [Info banner] "Only Owners/Admins can manage accounts."        |
|                                                                   |
| New/Edit account dialog                                          |
|  [Title] {New account | Edit account}                            |
|  [Form]                                                          |
|    Label: Name (*)                                               |
|    [ Input: name __________________________ ]                     |
|                                                                   |
|    Label: Description                                            |
|    [ Input: description ___________________ ]                     |
|                                                                   |
|    Label: Default account                                        |
|    [ Switch ] (Yes/No)                                           |
|    Helper: "Only one default account per business."             |
|                                                                   |
|    Label: Active                                                 |
|    [ Switch ] (Yes/No)                                           |
|                                                                   |
|  [Buttons] Cancel | Save                                         |
|                                                                   |
| (On Save)                                                        |
|   - POST/PATCH /api/orgs/{orgId}/accounts                        |
|   - If setting Default = true, API clears default from others    |
|                                                                   |
+-------------------------------------------------------------------+
```

---

## 11. Categories Management

Route: `/o/[orgSlug]/settings/categories`

```text
+-------------------------------------------------------------------+
| Header row                                                       |
|  [Title] Categories                                              |
|  [Subtext] Income and expense categories for this business.      |
|  Right: [Button] + New category                                  |
|                                                                   |
| Tabs or Segmented control:                                       |
|  [● All] [○ Income] [○ Expense]                                  |
|                                                                   |
| Categories table                                                 |
|  Columns: Name | Type | Parent | Include in P&L | Active | Actions|
|                                                                   |
|  Rows:                                                            |
|    - General Income | Income  | -        | Yes | Yes | [Edit]     |
|    - Owner Contributions | Income | -    | No  | Yes | [Edit]     |
|    - General Expense| Expense | -        | Yes | Yes | [Edit]     |
|    - Tax Paid       | Expense | -        | Yes | Yes | [Edit]     |
|    - FB Ads         | Expense | Marketing| Yes | Yes | [Edit]     |
|                                                                   |
|  [Note] For now, delete/replace flows are limited; you can mark  |
|        categories inactive instead of full reassignment logic.   |
|                                                                   |
| New/Edit category dialog                                         |
|  [Title] {New category | Edit category}                          |
|  [Form]                                                          |
|    Label: Name (*)                                               |
|    [ Input: name ________________________ ]                       |
|                                                                   |
|    Label: Type (*)                                               |
|    [ Select v ] Income | Expense                                 |
|                                                                   |
|    Label: Parent category                                        |
|    [ Select v ] (None, or choose parent of same type)            |
|                                                                   |
|    Label: Include in Profit & Loss                               |
|    [ Switch ] (Yes/No)                                           |
|                                                                   |
|    Label: Active                                                 |
|    [ Switch ] (Yes/No)                                           |
|                                                                   |
|    Label: Color                                                  |
|    [ Small color picker / text input ]                           |
|                                                                   |
|    Label: Icon                                                   |
|    [ Input: icon name (Lucide) ]                                 |
|                                                                   |
|  [Buttons] Cancel | Save                                         |
|                                                                   |
+-------------------------------------------------------------------+
```

---

## 12. Onboarding Guards & Empty States

```text
Scenario: User navigates to /o/[orgSlug]/transactions but onboarding incomplete

+-------------------------------------------------------------------+
| Full-page message                                                |
|  [Icon: info]                                                    |
|  [Title] Finish setting up your business                         |
|  [Body] To start tracking income and expenses, please complete   |
|         your business setup.                                     |
|  [Primary button] Resume onboarding                              |
|     → /onboarding/{orgSlug}/[next-step]                          |
|                                                                   |
|  [Secondary link] Switch business                                |
|                                                                   |
+-------------------------------------------------------------------+
```

```text
Scenario: Transactions page has no categories yet (after accidental deletion)

+-------------------------------------------------------------------+
| Inline empty state inside /transactions                           |
|  [Icon: tag]                                                      |
|  [Title] Add categories to get started                            |
|  [Body] You need at least one income and one expense category     |
|         before you can record transactions.                       |
|  [Primary button] Manage categories                               |
|     → /o/{orgSlug}/settings/categories                            |
|                                                                   |
+-------------------------------------------------------------------+
```

```text
Scenario: No accounts created (for some reason)

+-------------------------------------------------------------------+
| Inline empty state inside /transactions                           |
|  [Icon: wallet]                                                   |
|  [Title] Add an account                                           |
|  [Body] Create at least one account (bank, cash, or wallet) to    |
|         assign your transactions.                                 |
|  [Primary button] Manage accounts                                 |
|                                                                   |
+-------------------------------------------------------------------+
```

---

## 13. Summary

```text
This wireframe set covers:
- A mandatory 4-step onboarding flow (create business, business details, financial configuration, category setup).
- A business-focused shell with navigation to Dashboard, Transactions, Accounts, and Categories.
- A minimal but functional dashboard showing YTD metrics, account balances, and recent activity.
- A transactions list and detailed create/edit form honoring Sololedger rules (type/category matching, FX behavior, date constraints).
- Basic management screens for accounts and categories aligned with role-based permissions and future extensibility.
```
