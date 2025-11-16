## Multi-Currency – UX Flow & Wireframes

### 1. High-Level UX Flow

```text
[Onboarding - Financial Config]
	↓ (base currency chosen)
[Org Dashboard]
	↓
[Transactions List]
	├─ Filter by base amount / original currency
	├─ Create Transaction → [Transaction Form]
	└─ Click row → [Transaction Detail]

[Settings → Organization → Financial]
	├─ View base currency
	└─ Change base currency (advanced warning dialog)

[Transactions Trash]
	└─ View deleted transactions with base + optional secondary display

[Exports]
	└─ Export CSV with base + secondary currency columns
```

### 2. Screens & Wireframes

#### 2.1 Onboarding – Financial Configuration (Base Currency)

```text
┌───────────────────────────────────────────────┐
│  Step 3 of 4 – Financial configuration       │
├───────────────────────────────────────────────┤
│  Title: Financial configuration              │
│  Subtitle: Choose your base currency,        │
│            fiscal year, and formats          │
├───────────────────────────────────────────────┤
│  Base Currency *                             │
│  ┌───────────────────────────────────────┐   │
│  │ [MYR – Malaysian Ringgit        ▾]    │   │
│  └───────────────────────────────────────┘   │
│  Helper: Reports and dashboards use this      │
│          as the base currency                 │
│                                               │
│  [If "Other" selected]                       │
│  Enter currency code (ISO 4217) *             │
│  ┌───────────────────────────────────────┐   │
│  │ JPY                                   │   │
│  └───────────────────────────────────────┘   │
│  Helper: 3-letter ISO currency code           │
│                                               │
│  (Fiscal year start, date format, number      │
│   format sections – unchanged from current)   │
├───────────────────────────────────────────────┤
│  [← Back]                         [Continue]  │
└───────────────────────────────────────────────┘
```

#### 2.2 Settings → Organization → Financial – Base Currency & Change Dialog

```text
┌───────────────────────────────────────────────┐
│  Settings / Organization / Financial          │
├───────────────────────────────────────────────┤
│  Card: Financial Settings                     │
│  Subtitle: Configure financial reporting      │
│             preferences and base currency     │
├───────────────────────────────────────────────┤
│  Section: Base Currency                       │
│  Text: The primary currency for financial     │
│        reporting and analysis                 │
│                                               │
│  Current base currency card:                  │
│  ┌─────────────────────────────────────────┐  │
│  │  Current Base Currency: MYR             │  │
│  │  Malaysian Ringgit                      │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  [Change Currency] (admin only)               │
│                                               │
│  Info alert:                                  │
│  "Changing the base currency does not        │
│   automatically recalculate historical        │
│   transaction amounts. Existing transactions  │
│   retain their original base amounts.         │
│   Historical comparisons may be less          │
│   meaningful across base-currency changes."   │
│                                               │
│  (Fiscal year, date format, number format     │
│   sections follow below – existing behavior)  │
└───────────────────────────────────────────────┘

Change Base Currency Dialog

┌───────────────────────────────────────────────┐
│  Dialog Title: Change Base Currency           │
│  Subtitle: This is a critical change that     │
│            affects all financial reporting.   │
├───────────────────────────────────────────────┤
│  Destructive Alert (inside dialog):           │
│  • This does NOT recalculate historical       │
│    transaction amounts                        │
│  • Existing transactions retain their         │
│    original base amounts                      │
│  • Historical comparisons may be less         │
│    meaningful                                  │
│  • Reports will use the new currency going    │
│    forward                                    │
├───────────────────────────────────────────────┤
│  New Base Currency                            │
│  ┌───────────────────────────────────────┐    │
│  │ [USD – US Dollar               ▾]    │    │
│  └───────────────────────────────────────┘    │
│  (Searchable dropdown backed by ISO list)     │
├───────────────────────────────────────────────┤
│  Confirmation checkbox:                       │
│  [ ] I understand that historical amounts     │
│      will not be recalculated and that past   │
│      reports may be less comparable.          │
│                                               │
│  Confirmation text:                           │
│  Label: Type "CHANGE" to confirm             │
│  ┌──────────────────────────────┐             │
│  │ CHANGE                       │             │
│  └──────────────────────────────┘             │
├───────────────────────────────────────────────┤
│  [Cancel]                        [Change]     │
└───────────────────────────────────────────────┘
```

#### 2.3 Transactions List – Dual Currency Display & Filters

```text
┌──────────────────────────────────────────────────────────────┐
│  Header: Transactions                                         │
│  Subtitle: View and manage income and expenses                │
├──────────────────────────────────────────────────────────────┤
│  Filter Bar                                                   │
│  ┌───────────────┬───────────────┬───────────────┬─────────┐ │
│  │ Date Range    │ Category      │ Vendor/Client │ Status  │ │
│  └───────────────┴───────────────┴───────────────┴─────────┘ │
│  ┌───────────────┬───────────────┬─────────────────────────┐ │
│  │ Amount Min     │ Amount Max     │ Search text            │ │
│  │ (Base)         │ (Base)         │ (desc, vendor, client) │ │
│  └───────────────┴───────────────┴─────────────────────────┘ │
│  ┌───────────────────────────────┬─────────────────────────┐ │
│  │ Currency filter              │ Type filter             │ │
│  │ ┌─────────────────────────┐  │ ┌────────────────────┐ │ │
│  │ │ All currencies   ▾      │  │ │ Income / Expense ▾ │ │ │
│  │ └─────────────────────────┘  │ └────────────────────┘ │ │
│  │ Options:                     │                         │ │
│  │  • All currencies            │                         │ │
│  │  • Base currency only        │                         │ │
│  │  • USD                       │                         │ │
│  │  • EUR                       │                         │ │
│  │  • GBP                       │                         │ │
│  │  • (etc., from ISO list)     │                         │ │
│  └───────────────────────────────┴─────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│  Transactions Table / List                                   │
│                                                              │
│  Row example (INCOME, with secondary currency):              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Left:                                                 │  │
│  │   • Date (formatted per settings)                      │  │
│  │   • Description                                        │  │
│  │   • Category > Subcategory                             │  │
│  │   • Account name                                       │  │
│  │   • Vendor / Client (if any)                           │  │
│  │                                                        │  │
│  │  Right:                                                │  │
│  │   • Primary line (base currency):                      │  │
│  │     +MYR 1,000.00                                      │  │
│  │     (styled green for INCOME, red for EXPENSE)         │  │
│  │   • Secondary line (original currency, smaller):       │  │
│  │     USD 250.00                                         │  │
│  │                                                        │  │
│  │   • Action buttons: [Edit] [Delete]                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Row example (base-only, no secondary):                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Left: (same metadata fields)                          │  │
│  │  Right:                                                │  │
│  │   • Only base line shown:                              │  │
│  │     -MYR 320.00                                        │  │
│  │   • No secondary line rendered                         │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

#### 2.4 Transaction Form – Create/Edit with Base + Secondary Currency

```text
┌──────────────────────────────────────────────────────────────┐
│  Header: New Transaction / Edit Transaction                   │
├──────────────────────────────────────────────────────────────┤
│  Left column: core fields                                    │
│                                                              │
│  Transaction Type *                                          │
│  [● Income] [○ Expense]                                      │
│                                                              │
│  Status *                                                    │
│  [● Posted] [○ Draft]                                       │
│                                                              │
│  Date *                                                      │
│  ┌──────────────────────┐                                   │
│  │ 2025-11-16           │ (date picker)                     │
│  └──────────────────────┘                                   │
│                                                              │
│  Description *                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ e.g. Stripe payout                                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  Category *  (select with parent > child)                    │
│  Account *   (select, default account preselected)           │
│                                                              │
│  Vendor / Client (optional, autocomplete)                    │
├──────────────────────────────────────────────────────────────┤
│  Right column: currency and amounts                          │
│                                                              │
│  Section: Base Amount (required)                             │
│  Label: Amount (Base) *                                      │
│  ┌──────────────────────────────┐                            │
│  │ 1000.00                      │                            │
│  └──────────────────────────────┘                            │
│  Helper: Base currency: MYR                                  │
│                                                              │
│  Section: Secondary (Original) Currency (optional)           │
│  Helper: Use this if the transaction was in another          │
│          currency. Both amount and currency are required      │
│          if one is provided.                                 │
│                                                              │
│  Secondary amount                                             │
│  ┌──────────────────────────────┐                            │
│  │ 250.00                       │                            │
│  └──────────────────────────────┘                            │
│                                                              │
│  Secondary currency                                           │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ [USD – US Dollar                              ▾]      │   │
│  └───────────────────────────────────────────────────────┘   │
│  (Searchable dropdown using ISO list; type to filter)        │
│                                                              │
│  Validation states (shown inline or via toast):              │
│   • If secondary amount present but no currency → error      │
│     "Please select a secondary currency"                    │
│   • If secondary currency selected but no amount → error     │
│     "Please enter a secondary amount"                       │
├──────────────────────────────────────────────────────────────┤
│  Notes (optional)                                            │
│  ┌───────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│  Footer:                                                     │
│  [Cancel]                        [Save Transaction]          │
└──────────────────────────────────────────────────────────────┘
```

#### 2.5 Transaction Detail – Dual Currency Summary

```text
┌──────────────────────────────────────────────────────────────┐
│  Header: Transaction Detail                                  │
│  Breadcrumb: Transactions / #1234                            │
├──────────────────────────────────────────────────────────────┤
│  Top summary row                                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Left:                                                 │  │
│  │   • Type badge: [Income] / [Expense]                   │  │
│  │   • Status badge: [Posted] / [Draft]                   │  │
│  │   • Date                                              │  │
│  │   • Category > Subcategory                            │  │
│  │   • Account                                           │  │
│  │   • Vendor / Client                                   │  │
│  │                                                        │  │
│  │  Right:                                               │  │
│  │   • Base amount (large, colored):                     │  │
│  │       MYR 1,000.00                                    │  │
│  │   • Secondary line (if present, smaller):             │  │
│  │       USD 250.00 (Original currency)                  │  │
│  └────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  Details sections                                            │
│  • Description                                               │
│  • Notes                                                     │
│  • Linked documents                                          │
│  • Audit log snippet (created/edited info)                   │
├──────────────────────────────────────────────────────────────┤
│  Actions: [Edit] [Delete] [Back to Transactions]             │
└──────────────────────────────────────────────────────────────┘
```

#### 2.6 Transactions Trash – Base + Optional Secondary

```text
┌──────────────────────────────────────────────────────────────┐
│  Header: Trash – Transactions                                │
├──────────────────────────────────────────────────────────────┤
│  Columns:                                                    │
│   • Date                                                     │
│   • Description                                              │
│   • Category                                                 │
│   • Account                                                  │
│   • Amount (Base)                                            │
│   • Secondary amount (if any)                               │
│   • Deleted at                                               │
│   • Actions: [Restore] [Delete permanently]                  │
│                                                              │
│  Row with secondary:                                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Date       Description      Category   Account        │  │
│  │  2025-11-01 SaaS subscription Software  Bank          │  │
│  │                                                    →  │  │
│  │  Amount:   -MYR 1,000.00                              │  │
│  │  Original: -USD 250.00                                │  │
│  │  Deleted at: 2025-11-10 14:32                         │  │
│  │  [Restore] [Delete permanently]                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Row base-only:                                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Amount: -MYR 320.00 (no secondary line)               │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

#### 2.7 CSV Export – Columns Overview (Conceptual)

```text
┌──────────────────────────────────────────────────────────────┐
│  Export Transactions – Column overview                        │
├──────────────────────────────────────────────────────────────┤
│  Included columns (relevant to currency):                     │
│   • amountBase (e.g. 1000.00)                                │
│   • currencyBase (e.g. MYR)                                  │
│   • amountSecondary (e.g. 250.00, empty if base-only)        │
│   • currencySecondary (e.g. USD, empty if base-only)         │
│  (Other columns: date, type, status, description, category,  │
│   account, vendor/client, notes, etc.)                        │
└──────────────────────────────────────────────────────────────┘
```
