## Multi-Currency & FX – UX Flow & Wireframes

This document captures the UX flow and screen-by-screen wireframes for the multi-currency and FX features: automatic historical rate suggestions, per-business FX failure policy, and manual rate override with clear indicators.

---

## 1. High-Level UX Flow Map

```text
[Dashboard]
	 |
	 v
[Settings > Organization > Financial]
	 - Configure base currency (existing)
	 - Configure FX failure policy (new)

[Transactions List]
	 - Filter by currency
	 - See dual amounts and manual FX indicator
	 |
	 +--> [New Transaction]
	 |        - Choose currency and date
	 |        - Auto-suggest FX rate for foreign currency
	 |        - Optional manual override + note
	 |
	 +--> [Edit Transaction]
						- View existing FX info (rate, source, manual flag, note)
						- Change currency/date
						- Re-suggest FX rate or override manually

[Accounts / Reports]
	 - Continue to show balances in base currency only (no new UI)
```

---

## 2. Settings – Financial: FX Failure Policy

### 2.1 Screen: Organization Settings – Financial Tab

**Entry points:**
- Sidebar: `Settings` → `Organization` → `Financial`

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Header                                                            │
│  ─────────────────────────────────────────────────────────────────  │
│  [<] Back   Organization Settings                                  │
│                                                                     │
│  Title: Financial Settings                                         │
│  Subtitle: Configure financial reporting preferences and base      │
│            currency                                                │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────── Base Currency (existing) ──────────────────────────┐
│ Current base currency: [ MYR ]                                     │
│ [Change Currency] (admin only)                                     │
│ Info: Changing the base currency does not automatically            │
│       recalculate historical transaction amounts.                  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────── Fiscal Year & Formats (existing) ───────────────────┐
│ [Fiscal Year Start Month]  [v]                                     │
│ [Date Format]              [v]                                     │
│ [Number Format]            [Decimal, Thousands]                    │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────── Exchange Rate Behavior (new) ──────────────────┐
│ Label: On exchange rate failure                                    │
│                                                                     │
│ ( ) Fallback to last available rate (recommended)                  │
│     • If today's rate is unavailable, use the latest prior rate    │
│       within the allowed lookback window.                          │
│                                                                     │
│ ( ) Require manual rate input                                      │
│     • If an automatic rate cannot be fetched, the transaction      │
│       form will require you to enter a manual rate before saving.  │
│                                                                     │
│ [Optional] Info text:                                              │
│  "This setting applies to all foreign-currency transactions for    │
│   this business."                                                  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ [Cancel]                        [Save Changes] (primary, admin)    │
└─────────────────────────────────────────────────────────────────────┘
```

State notes:
- Admins can toggle FX policy and save.
- Members see the Exchange Rate Behavior block in read-only mode with disabled controls.

---

## 3. Transactions List – Dual Amounts & Manual Indicator

### 3.1 Screen: Transactions List

**Entry points:**
- Sidebar: `Transactions`

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Header                                                            │
│  ─────────────────────────────────────────────────────────────────  │
│  Title: Transactions                                               │
│  Controls: [New Transaction] [Filters...]                          │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────── Filters (excerpt) ─────────────────────────────────┐
│ Date range: [Last 30 days] [v]                                     │
│ Currency:   [All currencies v]                                     │
│   • All currencies                                                 │
│   • {BaseCurrency} (e.g. MYR)                                      │
│   • USD, EUR, GBP, ...                                             │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────── Transactions Table ────────────────────────────────┐
│  Date       Description           Account    Amount                │
│────────────────────────────────────────────────────────────────────│
│  2025-11-15 Invoice #1234        Main Acc   USD 1,000.00 •        │
│                                                MYR 4,200.00  [M]  │
│                                Category: Consulting                │
│                                Client: ACME Corp                  │
│                                                                    │
│  2025-11-14 Software license     Card       EUR 200.00 •           │
│                                                MYR 940.00         │
│                                Category: Software                 │
│                                Vendor: SaaS Ltd                   │
│                                                                    │
│  2025-11-12 Local expense        Cash       MYR 150.00            │
│                                Category: Meals                     │
│                                Vendor: Cafe XYZ                    │
└────────────────────────────────────────────────────────────────────┘

Legend:
- For foreign-currency transactions:
	- Show original amount + original currency.
	- Show base-currency amount separated by a dot or bullet.
- [M] small badge/icon:
	- Appears only when `exchangeRateIsManual` is true.
	- Tooltip on hover: "Manual FX rate" or similar.
```

Interactions:
- Clicking a row opens the Edit Transaction screen.
- Filtering by currency with "All currencies" / base currency / specific FX currencies behaves as current filters plus the new options.

---

## 4. New Transaction – Auto FX & Manual Override

### 4.1 Screen: New Transaction

**Entry points:**
- Transactions List → `[New Transaction]`

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Header                                                            │
│  ─────────────────────────────────────────────────────────────────  │
│  [<] Back   New Transaction                                        │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────── Basic Details ─────────────────────────────────────┐
│ Type:   (• Income) (  Expense )                                    │
│ Status: (• Posted) (  Draft   )                                    │
│ Date:   [ 2025-11-16          ]  (date picker)                     │
│                                                                     │
│ Description: [___________________________________________]         │
│ Category:    [Select category v]                                   │
│ Account:     [Select account  v]                                   │
│ Client/Vendor fields (as per type)                                 │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────── Amount & Currency ─────────────────────────────────┐
│ Amount (original): [ 1000.00     ]                                 │
│ Currency:          [ USD v ]                                       │
│   - MYR (base currency)                                            │
│   - USD, EUR, GBP, ...                                             │
│   - Other... (shows custom ISO code field)                         │
│                                                                     │
│ (Base currency: MYR)                                               │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────── Exchange Rate to Base ─────────────────────────────┐
│ Label: Exchange rate to MYR                                        │
│                                                                     │
│ [AUTO/MANUAL TOGGLE ROW]                                           │
│  (o) Use automatic rate (recommended)                              │
│  ( ) Use manual rate                                               │
│                                                                     │
│ Exchange rate: [ 4.20000000 ]  (read-only in AUTO, editable in     │
│                                   MANUAL for foreign currency)     │
│                                                                     │
│ Helper text (AUTO, success):                                       │
│  "Rate from Exchangerate.host for 2025-11-16"                      │
│  If fallback used:                                                 │
│  "Using 2025-11-15 rate due to market closure/availability."      │
│                                                                     │
│ Helper text (AUTO, failure + MANUAL policy):                       │
│  - Inline error below field: "We couldn't fetch a rate for this    │
│    date and currency. Please enter a manual rate."                │
│  - Toast message: similar wording.                                 │
│                                                                     │
│ Manual rate note (visible only when 'Use manual rate' selected):   │
│  Label: "Reason for manual rate (optional)"                        │
│  [_____________________________________________]                    │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────── Base Amount Preview ───────────────────────────────┐
│ Label: Base currency amount                                        │
│                                                                     │
│ Display (non-editable):                                            │
│  "MYR 4,200.00"                                                   │
│                                                                     │
│ Helper text:                                                       │
│  "Calculated as amount × exchange rate. Reports and balances      │
│   use this amount."                                               │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────── Notes & Actions ───────────────────────────────────┐
│ Notes (optional):                                                  │
│ [_______________________________________________________]         │
│                                                                     │
│ [Cancel]                             [Save Transaction] (primary)  │
└─────────────────────────────────────────────────────────────────────┘
```

Behavior notes:
- When the user selects a currency different from base and chooses a date:
	- On change of currency or date, the form calls the FX suggestion API (AUTO mode only).
- If the business FX policy is "FALLBACK":
	- The suggestion attempts provider, then local fallback within lookback window.
	- If still failing, the UI automatically switches to MANUAL mode with error message.
- If the policy is "MANUAL":
	- Any provider failure immediately switches to MANUAL and blocks save until a valid manual rate is provided.
- For base-currency transactions:
	- Currency select is base.
	- Exchange rate section shows a fixed `1.00` and hides the auto/manual toggle and note field.

---

## 5. Edit Transaction – FX Details & Recalculation

### 5.1 Screen: Edit Transaction

**Entry points:**
- Transactions List → click row

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Header                                                            │
│  ─────────────────────────────────────────────────────────────────  │
│  [<] Back   Edit Transaction                                       │
│  Right-side actions: [Delete] [More...]                            │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────── Basic Details (pre-filled) ────────────────────────┐
│ Date:        [ 2025-11-15          ]                               │
│ Type:        (• Income) (  Expense )                                │
│ Status:      (• Posted) (  Draft   )                                │
│ Description: [ Invoice #1234                 ]                      │
│ Category:    [ Consulting v ]                                       │
│ Account:     [ Main Account v ]                                     │
│ Client/Vendor fields                                                │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────── Amount & Currency (pre-filled) ────────────────────┐
│ Amount (original): [ 1000.00     ]                                 │
│ Currency:          [ USD v ]                                       │
│ (Base currency: MYR)                                               │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────── Exchange Rate to Base ─────────────────────────────┐
│ Label: Exchange rate to MYR                                        │
│                                                                     │
│ Current state summary row:                                         │
│  "Using manual rate: 4.20000000 (from bank statement)"            │
│   or                                                               │
│  "Using automatic rate: 4.19000000 from Exchangerate.host"       │
│                                                                     │
│ [AUTO/MANUAL TOGGLE ROW]                                           │
│  (o) Use automatic rate                                            │
│  ( ) Use manual rate                                               │
│                                                                     │
│ Exchange rate: [ 4.20000000 ]                                      │
│                                                                     │
│ Manual rate note (if manual):                                      │
│  ["Used bank rate from statement"                    ]             │
│                                                                     │
│ [Optional button] (visible only in AUTO mode and foreign currency):│
│  [Re-suggest rate for this date]                                   │
│   - Triggers FX suggestion using current date & currency.          │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────── Base Amount & FX Meta ─────────────────────────────┐
│ Base currency amount:  "MYR 4,200.00"                             │
│                                                                     │
│ Metadata (read-only, small text):                                  │
│  - Source: Manual override / Exchangerate.host                     │
│  - Last updated: 2025-11-15 10:45                                  │
│  - (If fallback used) "Based on rate from 2025-11-14"             │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────── Notes & Actions ───────────────────────────────────┐
│ Notes (optional):                                                  │
│ [_______________________________________________________]         │
│                                                                     │
│ [Cancel]                         [Save Changes] (primary)          │
└─────────────────────────────────────────────────────────────────────┘
```

Behavior notes:
- Changing amount or rate automatically updates the base amount preview.
- Changing date or currency while in AUTO mode can optionally trigger re-suggestion (or rely on server-side recalculation when saving, depending on performance trade-offs).
- If the user switches from AUTO to MANUAL, we preserve the last suggested rate as starting value.

---

## 6. Supporting Screenlets / States

### 6.1 FX Suggestion Loading State

```text
┌──────────────── Exchange Rate to Base ─────────────────────────────┐
│ Exchange rate: [ 4.20000000 ]    (field disabled)                  │
│                                                                     │
│ [Spinner] Fetching rate for 2025-11-16...                           │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 FX Suggestion Error (Auto → Manual switch)

```text
┌──────────────── Exchange Rate to Base ─────────────────────────────┐
│ Exchange rate: [            ]                                      │
│                                                                     │
│ Error (inline):                                                     │
│  "We couldn't fetch a rate for this date and currency.             │
│   Please enter a manual rate."                                    │
│                                                                     │
│ ( ) Use automatic rate                                             │
│ (o) Use manual rate                                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

These wireframes should be used in combination with the detailed plan in `notes/plan.md` when implementing the multi-currency & FX behavior across settings, APIs, and transaction screens.

