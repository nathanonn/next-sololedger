In this phase we will refactor Sololedger’s multi-currency handling from an exchange-rate–centric model to an explicit dual-currency model, where each transaction always stores an authoritative base-currency amount and optionally a secondary (original) currency amount. We will apply this through the data model, APIs, transaction forms, and UI displays, while preserving backwards compatibility via a migration from the existing `amountOriginal` / `exchangeRateToBase` fields. All filtering, sorting, reporting, and dashboards will continue to run purely on base-currency amounts, with secondary currency used only for display and reference.

## Implementation Plan – Dual Currency Model (Section 7)

### 1. Data Model & Prisma

1.1 Extend `Transaction` model

- In `prisma/schema.prisma`, extend the `Transaction` model to support explicit base and secondary currencies:
  - Keep `amountBase Decimal(18, 2)` as the canonical base amount field (already present).
  - Add `currencyBase String @db.VarChar(3)` (required) to store the organization’s base currency code per transaction.
  - Add `amountSecondary Decimal @db.Decimal(18, 2)?` (optional) to store the original/secondary transaction amount.
  - Add `currencySecondary String? @db.VarChar(3)` (optional) for the original/secondary currency code.
- Retain legacy fields for now (for migration and audit only): - `amountOriginal`, `currencyOriginal`, `exchangeRateToBase` and any related metadata. - Mark them as legacy in comments and stop using them in new business logic after migration.

  1.2 Database migration

- Create a Prisma migration to add `currencyBase`, `amountSecondary`, and `currencySecondary` to `Transaction`:
  - Temporarily allow `currencyBase` to be nullable or default to a placeholder, then backfill values via a script and enforce non-null.
- Verify that `organization_settings.baseCurrency` values are:
  - Non-null.
  - Uppercased 3-letter codes.
  - Valid ISO 4217 codes (or at least syntactically valid) before relying on them for migration.

### 2. Shared Currency Utilities & ISO Validation

2.1 Shared currency list and helpers

- Add a new module `lib/currencies.ts` that exports: - A full ISO 4217 currency list as an array of `{ code: string; name: string }`. - `isValidCurrencyCode(code: string): boolean` that checks uppercase 3-letter codes against this list.

  2.2 Server-side currency validation

- Use `isValidCurrencyCode` in server routes to enforce ISO codes:
  - `app/api/orgs/[orgSlug]/settings/financial/route.ts` when saving `baseCurrency`.
  - `app/api/orgs/[orgSlug]/transactions/route.ts` and `app/api/orgs/[orgSlug]/transactions/[transactionId]/route.ts` for `currencySecondary` (and any `currencyBase` input if accepted).
- Update Zod schemas to refine currency strings: - `.string().length(3).transform((v) => v.toUpperCase()).refine(isValidCurrencyCode, { message: "Invalid currency code" })`.

  2.3 Client-side usage (mirroring server)

- Replace ad-hoc currency lists with shared ISO data where appropriate:
  - `app/onboarding/[orgSlug]/financial/page.tsx` (base currency selection).
  - `app/o/[orgSlug]/settings/organization/(tabs)/financial/page.tsx` (base currency change dialog).
  - `components/features/transactions/transaction-form.tsx` (secondary currency selection).
- Keep a “common currencies” subset at the top of dropdowns for UX, but still validate against the full ISO list.

### 3. Transaction API – Dual Currency Fields

3.1 Create transaction (POST /api/orgs/[orgSlug]/transactions)

- In `app/api/orgs/[orgSlug]/transactions/route.ts`, update the POST schema and handler:
  - New primary fields:
    - `amountBase: z.number().positive("Amount must be greater than 0")`.
  - Optional secondary fields (all-or-nothing):
    - `amountSecondary: z.number().positive().optional()`.
    - `currencySecondary: z
	 .string()
	 .length(3)
	 .transform((v) => v.toUpperCase())
	 .refine(isValidCurrencyCode, { message: "Invalid currency code" })
	 .optional()`.
  - Cross-field validation for secondary:
    - If `amountSecondary` is provided → `currencySecondary` must be present and valid.
    - If `currencySecondary` is provided → `amountSecondary` must be present and positive.
  - Base currency handling:
    - Load `orgSettings` and read `baseCurrency`.
    - Force `currencyBase` to `orgSettings.baseCurrency` (ignore or hard-validate any incoming `currencyBase` field).
  - Data persistence:
    - Write `amountBase` and `currencyBase` for every transaction.
    - Write `amountSecondary` and `currencySecondary` only when valid secondary data is provided; otherwise leave them null.
- Backwards-compatibility path during rollout: - Optionally keep accepting `amountOriginal` + `currencyOriginal` + `exchangeRateToBase` for a short transition period. - If these legacy fields are present and new dual-currency fields are not, derive: - `amountBase` from `amountOriginal * exchangeRateToBase`. - Secondary from `amountOriginal`/`currencyOriginal` per migration logic. - Mark this path as deprecated and remove once clients are updated.

  3.2 Update transaction (PATCH /api/orgs/[orgSlug]/transactions/[transactionId])

- In `app/api/orgs/[orgSlug]/transactions/[transactionId]/route.ts`, extend the Zod schema for PATCH:
  - Allow optional `amountBase`, `amountSecondary`, and `currencySecondary` with the same constraints as POST.
  - Reuse cross-field validation for secondary.
- Update handler logic:
  - When `amountBase` is provided, update `amountBase` for the transaction (respect soft-closed period rules and activity logging).
  - Always enforce that `currencyBase` remains equal to `orgSettings.baseCurrency` (if base currency settings change later, handle recompute via separate logic, not per-transaction PATCH).
  - For secondary fields:
    - If both `amountSecondary` and `currencySecondary` are present and valid → update them.
    - If both are explicitly cleared (e.g. null/undefined in payload semantics) → clear `amountSecondary` and `currencySecondary` to represent base-only.
- Keep existing rules (type/category alignment, soft-close warnings, vendor/client handling) unchanged.

  3.3 List transactions (GET /api/orgs/[orgSlug]/transactions)

- In the GET handler in `transactions/route.ts`:
  - Confirm amount range filters use `where.amountBase` only (already implemented but re-verify).
  - Adjust currency filter semantics to operate on original/secondary currency:
    - Interpret `?currency=` query as follows:
      - `currency=all` (or no param) → no filter.
      - `currency=BASE` (reserved value) → `where.currencySecondary = null` (base-only transactions).
      - `currency=XXX` → `where.currencySecondary = XXX` (transactions originally in that currency).
  - Include new fields in the response payload:
    - `amountBase`, `currencyBase`, `amountSecondary`, `currencySecondary`.
- Ensure ordering by amount (if present) uses `amountBase`.

### 4. Migration – Exchange-Rate Model to Dual Currency

4.1 Migration script

- Create `scripts/migrate-currency-model.ts` that uses Prisma to transform existing data according to Section 7.6: - Load all organizations and their `organizationSettings.baseCurrency` values. - Iterate transactions in manageable batches (e.g. by organization and createdAt).

  4.2 Transformation rules

- For each transaction, read `amountOriginal`, `currencyOriginal`, `amountBase` (legacy), and the organization’s `baseCurrency`:
  - If `currencyOriginal !== baseCurrency`:
    - Set `amountSecondary = amountOriginal`.
    - Set `currencySecondary = currencyOriginal`.
    - Keep existing `amountBase` unchanged.
    - Set `currencyBase = baseCurrency`.
  - If `currencyOriginal === baseCurrency`:
    - Set `amountBase = amountOriginal` (overwriting if necessary).
    - Set `currencyBase = baseCurrency`.
    - Set `amountSecondary = null` and `currencySecondary = null`.
- Optional consistency checks: - For foreign-currency transactions, log rows where existing `amountBase` differs from `amountOriginal * exchangeRateToBase` beyond a small epsilon.

  4.3 Execution & safety

- Add CLI flags for:
  - `--dry-run`: log planned updates without writing.
  - `--batch-size`: tune performance.
- Run migration in staging first and manually inspect a sample of transactions per organization.
- Once satisfied, run in production during a controlled window.

  4.4 Cleanup migration

- After successful migration and verification:
  - Create a follow-up Prisma migration to drop obsolete fields from `Transaction`:
    - `exchangeRateToBase`.
    - Any optional `rateSource`, `rateTimestamp`, manual override fields if present.
  - Decide separately when to remove `amountOriginal` and `currencyOriginal` (they can be kept longer-term as legacy/audit fields).

### 5. Base Currency Settings & Changes

5.1 Onboarding and financial settings

- In `app/onboarding/[orgSlug]/financial/page.tsx` and `app/api/orgs/[orgSlug]/settings/financial/route.ts`: - Replace hardcoded currency lists with the shared ISO currency list. - Validate base currency via `isValidCurrencyCode` on the server. - Ensure base currency is stored in uppercase and used consistently across the app.

  5.2 Base currency change behavior (v1 – no recompute)

- Maintain the current behavior where changing base currency does not recompute historical `amountBase` values:
  - `organizationSettings.baseCurrency` changes.
  - Existing `amountBase` values remain numerically the same.
  - UI labels for base currency update to the new code.
- Update copy in `app/o/[orgSlug]/settings/organization/(tabs)/financial/page.tsx` to clearly state:
  - Historical transaction amounts are not recalculated.
  - Reports may be misleading across a base-currency change.
  - New transactions use the new base currency code.
- Reserve room in the design for a future enhancement that recomputes base amounts for transactions that have `currencySecondary` populated.

### 6. Transaction Form UX (Create/Edit)

6.1 Form state model changes

- In `components/features/transactions/transaction-form.tsx`, refactor state: - Replace `amountOriginal`, `currencyOriginal`, and `exchangeRate` state with: - `amountBase` (string; required). - `amountSecondary` (string; optional). - `currencySecondary` (string; optional, uppercase 3-letter code). - Keep `settings.baseCurrency` as a read-only reference for the base currency.

  6.2 Inputs and client-side validation

- Base amount:
  - Input labeled “Amount (Base)” with a required indicator.
  - Helper text showing the base currency code, e.g. `Base currency: MYR`.
  - Validate that `amountBase` is a positive number before submit.
- Secondary currency (optional, all-or-nothing):
  - Numeric `Secondary amount` input.
  - Searchable dropdown for `Secondary currency` using the ISO list module:
    - Implement via existing `Select` + an internal searchable component (e.g. `Command`), or a custom searchable dropdown pattern.
  - Client-side rules:
    - If `amountSecondary` is non-empty → require a valid `currencySecondary` and show inline error/toast if missing.
    - If `currencySecondary` is set → require `amountSecondary` > 0.
- Remove the explicit `exchangeRate` UI entirely.

  6.3 Submit payloads

- For create:
  - POST body should send `{ type, status, amountBase, amountSecondary?, currencySecondary?, date, description, categoryId, accountId, vendorName?, clientName?, notes? }`.
- For edit:
  - PATCH body should send only changed fields, including `amountBase`, `amountSecondary`, and `currencySecondary` when modified.
- Ensure date rules, category type matching, account selection, and soft-close confirmations continue to operate as before.

### 7. Dual-Currency Display in UI

7.1 Transactions list page

- In `app/o/[orgSlug]/transactions/page.tsx`, enhance the amount display for each row: - Primary line (base currency): - Use `formatCurrency(amountBase, settings.baseCurrency, settings.decimalSeparator, settings.thousandsSeparator)` as today. - Secondary line (only when present): - If `currencySecondary && amountSecondary`: - Render below the primary line in smaller, muted text. - Display as `currencySecondary` + formatted `amountSecondary` using `formatCurrency` with `currencySecondary`. - If no secondary currency, render only the primary line (no “N/A” text).

  7.2 Transaction detail page

- In `app/o/[orgSlug]/transactions/[id]/page.tsx`, mirror the list behavior with more detail: - Show a prominent base amount section. - If secondary exists, add a labeled “Original currency” section beneath, displaying secondary amount and code.

  7.3 Trash and other views

- In `app/o/[orgSlug]/transactions/trash/page.tsx` and any other views that show transaction amounts: - Continue to use base amount as the main figure. - Optionally show a secondary line similar to the main list for consistency.

  7.4 Helper function for dual display

- In `lib/sololedger-formatters.ts` (or a new module), add:
  - `formatDualCurrency(amountBase, currencyBase, amountSecondary, currencySecondary, decimalSeparator, thousandsSeparator)` that returns `{ primary: string; secondary: string | null }`.
- Use this helper in list, detail, and trash views to keep formatting logic centralized.

### 8. Searching, Filtering & Sorting

8.1 Amount range filters and sorting

- Ensure all amount-based operations use `amountBase` only: - `GET /transactions` amount filters (`amountMin`, `amountMax`) already apply to `where.amountBase`; re-confirm and update labels if needed. - Any sorting by amount in the transactions list should order by `amountBase`.

  8.2 Currency filters

- Adjust the currency filter on the transactions page: - In the UI (`transactions/page.tsx`): - Provide options: “All currencies”, “Base currency only”, and a set of specific original currencies (e.g. USD, EUR, etc.). - In the API (`GET /transactions`): - Map UI selections to query params and apply filters as defined in 3.3.

  8.3 Search by amount

- Document and ensure that any free-text search by amount (if implemented) treats values as base-currency amounts.
- Do not attempt to search by secondary amount for v1.

### 9. Reporting & Dashboard

9.1 Dashboard metrics

- In `app/o/[orgSlug]/dashboard/page.tsx` and any other dashboard code: - Confirm that all aggregates (YTD income, expenses, profit/loss) sum `amountBase` only. - Ensure labels use `settings.baseCurrency`.

  9.2 Future currency reports (design alignment)

- When implementing Section 12.2 “Currency Reports” later, plan to:
  - Group by `currencySecondary`.
  - For each currency group, show:
    - Total income/expense in original (secondary) currency (sum of `amountSecondary`).
    - Corresponding totals in base currency (sum of `amountBase`).
  - Keep this design in mind while modeling data and APIs now.

### 10. Export & Import Adjustments

10.1 CSV export

- In `app/api/orgs/[orgSlug]/transactions/export/route.ts`: - Update the exported columns to reflect the new model: - Include `amountBase` and `currencyBase`. - Include `amountSecondary` and `currencySecondary` (blank for base-only transactions). - Remove `exchangeRateToBase` from exported CSV per Section 7.6. - Update header labels and any related docs.

  10.2 CSV import

- When refining CSV import (Section 13.1):
  - Treat base amount and currency as required:
    - Either infer base currency from org settings or require an explicit column that matches it.
  - Treat secondary amount and currency as optional but all-or-nothing:
    - Apply the same validation rules as the transaction API.
  - Validate currency codes via `isValidCurrencyCode` during import.

### 11. Testing & Verification

11.1 Unit tests

- Add unit tests for: - `isValidCurrencyCode` and any helper functions in `lib/currencies.ts`. - New Zod schemas for POST/PATCH transaction payloads (including all combinations of base/secondary fields). - Pure transformation logic used in the migration script (given a transaction + baseCurrency, assert the correct new fields).

  11.2 Integration tests

- If you have API test infrastructure (e.g. Jest + supertest or similar): - Test creating a base-only transaction via POST. - Test creating a dual-currency transaction (both base and secondary) via POST. - Test updating secondary currency and amount via PATCH. - Test currency filter semantics in GET (`BASE`, specific secondary currency, all).

  11.3 UI tests / manual QA

- Manually or via E2E tests: - Create/edit transactions through `TransactionForm` with and without secondary currency. - Verify dual-currency display in the list, detail, and trash views. - Verify amount filters and currency filters behave as expected.

  11.4 Migration dry-run and rollout

- Run the migration script in dry-run mode against staging or a snapshot:
  - Inspect logs for anomalies and sample-check per organization.
- After running for real:
  - Compare a sample of transactions before and after migration to confirm:
    - Base amounts and codes are correct.
    - Secondary amounts and codes are correctly assigned.
  - Only then proceed to drop legacy fields and flip clients fully to the new model.
