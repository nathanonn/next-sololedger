This plan introduces an organization-scoped FX rate store and service, wires automatic daily historical exchange-rate fetching into transaction create/update flows with per-business failure policies, and adds explicit manual override metadata and UI so users can see and control how foreign-currency amounts convert into base currency while keeping reports based solely on stored base amounts.

## Phases Overview

1. Data model & settings
2. FX service & provider adapter
3. API integration (transactions)
4. UI integration (transaction form)
5. Indicators & listing/report hooks
6. Testing & configuration

---

## Phase 1 – Data Model & Org Settings

### 1.1 Add `FxRate` model (Prisma)

- Define new `FxRate` model in `prisma/schema.prisma`:
	- `id: String @id @default(cuid())`
	- `organizationId: String`
	- `baseCurrency: String @db.VarChar(3)`
	- `quoteCurrency: String @db.VarChar(3)`
	- `date: DateTime` (normalized to UTC midnight for that rate day)
	- `rate: Decimal @db.Decimal(18, 8)`
	- `source: String @db.VarChar(50)` (e.g. `"EXCHANGERATE_HOST"`)
	- `retrievedAt: DateTime @default(now())`
- Relations & indexes:
	- Relation to `Organization` via `organizationId` (cascade on delete).
	- Unique constraint on `(organizationId, baseCurrency, quoteCurrency, date)`.
	- Index on `(organizationId, quoteCurrency, date)` to support lookback queries.
- Semantics:
	- Rates are logically global, but we store them per org for tenant isolation and potential org-specific overrides later.

### 1.2 Extend `OrganizationSettings` with FX policy

- Add fields to `OrganizationSettings` in `prisma/schema.prisma`:
	- `fxFailurePolicy: String @db.VarChar(20)`
		- Values: `"FALLBACK" | "MANUAL"` (string-based, or a dedicated Prisma enum if preferred).
	- Optional: `fxMaxLookbackDays: Int?` (if we want per-org overrides; otherwise global env only).
- Defaults and migrations:
	- Default `fxFailurePolicy` to `"FALLBACK"` in migration for existing rows.
	- Leave `fxMaxLookbackDays` null initially so env default applies.
- API: `app/api/orgs/[orgSlug]/settings/financial/route.ts`:
	- `GET` should include `fxFailurePolicy` (and `fxMaxLookbackDays` if present) in `settings` payload.
	- `PATCH` should accept and persist `fxFailurePolicy` (and `fxMaxLookbackDays` if implemented) for admins.
- UI: `app/o/[orgSlug]/settings/organization/(tabs)/financial/page.tsx`:
	- Add an "Exchange Rate Behavior" section under financial settings:
		- Radio group:
			- Option A: "Fallback to last available rate (recommended)" → `"FALLBACK"`.
			- Option B: "Require manual rate when automatic fetch fails" → `"MANUAL"`.
		- Show helper text describing each behavior.
	- Bound to `fxFailurePolicy` from financial settings hook.
	- Editable only for admins; members see a read-only description.

### 1.3 Extend `Transaction` model with FX metadata

- In `Transaction` model in `prisma/schema.prisma`, add:
	- `exchangeRateIsManual: Boolean @default(false)`
	- `exchangeRateNote: String? @db.Text`
	- `exchangeRateSource: String? @db.VarChar(50)` (e.g. `"EXCHANGERATE_HOST"`, `"MANUAL"`, `"BASE_CURRENCY"`).
- Migration behavior:
	- Existing transactions get `exchangeRateIsManual = false` and `exchangeRateSource = null` (or optionally a placeholder like `"LEGACY"`).
- Semantics:
	- Provider-derived rate: `exchangeRateIsManual = false`, `exchangeRateSource = provider code`.
	- Manual override: `exchangeRateIsManual = true`, `exchangeRateSource = "MANUAL"`, `exchangeRateNote` populated when user supplies a justification.

---

## Phase 2 – FX Service & Provider Adapter

### 2.1 Core FX service module

- Create `lib/fx-service.ts` as a server-only module.
- Types:
	- `type FxFailurePolicy = "FALLBACK" | "MANUAL";`
	- `type FxRateResult = { rate: number; source: string; date: Date; usedFallback: boolean; };`
	- `type FxProvider = { getHistoricalRate(params: { baseCurrency: string; quoteCurrency: string; date: Date; }): Promise<{ rate: number; date: Date; source: string; }>; };`
- Public functions:
	- `async function getFxSettingsForOrg(organizationId: string): Promise<{ failurePolicy: FxFailurePolicy; maxLookbackDays: number; }>`:
		- Reads `OrganizationSettings` for `fxFailurePolicy` (fallback to `"FALLBACK"` if null).
		- `maxLookbackDays` from `fxMaxLookbackDays` or env `FX_MAX_LOOKBACK_DAYS` (default 30).
	- `async function getOrFetchRate(params: { organizationId: string; baseCurrency: string; quoteCurrency: string; date: Date; failurePolicy: FxFailurePolicy; maxLookbackDays: number; }): Promise<FxRateResult | null>`:
		- Normalize `date` to a UTC midnight "rate date".
		- Step 1: Check existing `FxRate` for `(organizationId, baseCurrency, quoteCurrency, rateDate)`.
			- If found, return cached `rate` and `source`, `usedFallback: false`.
		- Step 2: If not found, call provider via `getFxProvider().getHistoricalRate(...)`.
			- On success:
				- Persist a new `FxRate` row.
				- Return `{ rate, source, date: rateDate, usedFallback: false }`.
			- On failure:
				- If `failurePolicy === "FALLBACK"`:
					- Query `FxRate` for latest previous date within `maxLookbackDays` for same `(org, base, quote)`.
					- If found, return with `usedFallback: true`.
					- If not found, return `null`.
				- If `failurePolicy === "MANUAL"`, return `null` immediately.

### 2.2 Provider adapter with pluggable implementation

- Add `lib/fx-providers/exchangerate-host.ts`:
	- Implements `FxProvider` using `https://api.exchangerate.host/{YYYY-MM-DD}?base=BASE&symbols=QUOTE`.
	- Parses JSON, extracts `rates[QUOTE]`.
	- Validates and throws on missing/invalid rate.
	- Uses `FX_API_BASE_URL` env when present; defaults to the public host.
- Add `lib/fx-providers/index.ts`:
	- Exports `getFxProvider(): FxProvider`.
	- Chooses implementation based on `process.env.FX_PROVIDER` (e.g. `"EXCHANGERATE_HOST"` or `"MOCK"`).
- Ensure all provider calls stay server-side (in routes or server libs), never in client components.

### 2.3 Mock provider for tests/dev

- Implement `lib/fx-providers/mock.ts`:
	- `getHistoricalRate` returns deterministic values from an in-memory map or simple logic (e.g. `1 USD = 4.20000000 MYR`).
	- Optionally supports a small override mechanism for tests (e.g. `setMockRate(...)`).
- Configure tests/dev:
	- In tests, set `FX_PROVIDER="MOCK"`.
	- Optionally allow local dev to use MOCK when no internet or while API keys are missing.

---

## Phase 3 – API Integration (Transactions)

### 3.1 POST `/api/orgs/[orgSlug]/transactions` – auto FX application

- Update zod schema in `app/api/orgs/[orgSlug]/transactions/route.ts` for POST:
	- Existing fields remain (type, status, amountOriginal, currencyOriginal, date, etc.).
	- Add FX-related fields:
		- `useManualRate: z.boolean().optional().default(false)`.
		- `exchangeRateToBase: z.number().positive().optional()` (required when `useManualRate` true and `currencyOriginal !== baseCurrency`).
		- `exchangeRateNote: z.string().nullable().optional()`.
- Server logic (after validation, org + membership checks):
	1. Load `OrganizationSettings` to get `baseCurrency` and FX settings via `getFxSettingsForOrg(org.id)`.
	2. Determine `finalCurrency` from `currencyOriginal`.
	3. If `finalCurrency === baseCurrency`:
		 - Set `rate = 1.0`.
		 - Set `exchangeRateIsManual = false`.
		 - Set `exchangeRateSource = "BASE_CURRENCY"`.
	4. Else if `useManualRate === true`:
		 - Require `exchangeRateToBase` > 0 in zod and runtime.
		 - Set `rate = exchangeRateToBase`.
		 - `exchangeRateIsManual = true`.
		 - `exchangeRateSource = "MANUAL"`.
		 - `exchangeRateNote` from body (optional).
	5. Else (auto FX mode for foreign currency):
		 - Call `getOrFetchRate` with `(org.id, baseCurrency, finalCurrency, new Date(date), failurePolicy, maxLookbackDays)`.
		 - If result is `null`:
			 - Return 400 with an error like "Could not fetch an exchange rate; please enter a manual rate.".
		 - If result found:
			 - `rate = result.rate`.
			 - `exchangeRateIsManual = false`.
			 - `exchangeRateSource = result.source`.
			 - (Optional) If `result.usedFallback`, include that in the response payload for UI messaging.
	6. Compute base amount:
		 - `amountBase = amountOriginal * rate` (convert Prisma `Decimal` to `Number` where needed, consistent with `CLAUDE.md`).
	7. Create transaction with:
		 - `amountOriginal`, `currencyOriginal`, `exchangeRateToBase: rate`, `amountBase`.
		 - `exchangeRateIsManual`, `exchangeRateSource`, `exchangeRateNote`.
- Response:
	- Include `exchangeRateToBase`, `amountBase`, `exchangeRateIsManual`, `exchangeRateSource`, and `exchangeRateNote` so the client can reflect the final state.

### 3.2 PATCH `/api/orgs/[orgSlug]/transactions/[transactionId]` – FX-aware updates

- Update PATCH zod schema in `app/api/orgs/[orgSlug]/transactions/[transactionId]/route.ts`:
	- Add optional FX fields:
		- `useManualRate: z.boolean().optional()`.
		- `exchangeRateToBase: z.number().positive().optional()`.
		- `exchangeRateNote: z.string().nullable().optional()`.
		- `autoRecalculateRate: z.boolean().optional()` (to explicitly request re-fetch when editing).
- Server logic (after auth/org checks and fetching existing transaction):
	1. Determine `finalCurrency`:
		 - Use `data.currencyOriginal` if provided; else `existing.currencyOriginal`.
	2. Determine `finalDate`:
		 - Use `data.date` if provided; else `existing.date`.
	3. If `finalCurrency === baseCurrency`:
		 - Set `rate = 1.0`, `exchangeRateIsManual = false`, `exchangeRateSource = "BASE_CURRENCY"`.
	4. Else if `useManualRate === true`:
		 - Require `exchangeRateToBase` > 0.
		 - `rate = exchangeRateToBase`.
		 - `exchangeRateIsManual = true`.
		 - `exchangeRateSource = "MANUAL"`.
		 - `exchangeRateNote` from body.
	5. Else if `autoRecalculateRate === true` or currency/date changed:
		 - Use `getOrFetchRate` as in POST.
		 - Same error handling if result is `null`.
	6. Else (no explicit FX change):
		 - Keep existing `exchangeRateToBase`, `exchangeRateIsManual`, `exchangeRateSource`, and `exchangeRateNote`.
	7. Recalculate `amountBase` when needed:
		 - Determine `finalAmountOriginal` (updated or existing).
		 - If either `finalAmountOriginal` or `rate` differ from existing, set `amountBase = finalAmountOriginal * rate`.
	8. Persist updates accordingly.

### 3.3 Include FX metadata in GET `/transactions`

- Ensure `GET /api/orgs/[orgSlug]/transactions` includes, for each transaction:
	- `currencyOriginal`, `amountOriginal`, `exchangeRateToBase`, `exchangeRateIsManual`, `exchangeRateSource`.
- This powers dual display and manual-rate indicators in the UI.

---

## Phase 4 – UI Integration (Transaction Form)

### 4.1 Extend transaction form data model

- In `components/features/transactions/transaction-form.tsx`:
	- Extend `TransactionData` with:
		- `exchangeRateIsManual?: boolean`.
		- `exchangeRateNote?: string`.
	- Local React state additions:
		- `rateMode: "AUTO" | "MANUAL"` (derive initial from `initialData.exchangeRateIsManual`).
		- `exchangeRateNote` controlled input.
	- Derived flags:
		- `const isBaseCurrency = finalCurrency === settings.baseCurrency;`
		- `const isForeignCurrency = !isBaseCurrency;`.

### 4.2 Auto-suggest rate on currency/date change

- Add a dedicated FX suggestion route (server):
	- `GET /api/orgs/[orgSlug]/fx/suggest-rate?currency=XXX&date=YYYY-MM-DD`.
	- Uses `getFxSettingsForOrg` and `getOrFetchRate` but does not touch `Transaction`.
	- Returns JSON: `{ rate, source, rateDate, usedFallback }` or a 400/500 error.
- In `TransactionForm`:
	- When `currency` or `date` changes and `isForeignCurrency` and `rateMode === "AUTO"`:
		- Call the FX suggest endpoint with the current `orgSlug`, currency, and date.
		- On success:
			- Update `exchangeRate` state.
			- Store `source` and whether `usedFallback` for display.
			- Show helper text like:
				- "Rate from Exchangerate.host for 2025-11-16".
				- If `usedFallback`, append "(using 2025-11-15 rate)".
		- On failure:
			- Read `fxFailurePolicy` from financial settings (passed down or via hook).
			- If policy is MANUAL or fallback failed:
				- Switch `rateMode` to `"MANUAL"`.
				- Show inline error under rate field and a toast: "We couldn't fetch an exchange rate; please enter a manual rate.".

### 4.3 Manual override toggle and note

- Under the exchange rate input in `TransactionForm`:
	- Add a toggle UI (e.g. radio group or switch) for mode selection:
		- Option 1: "Use automatic rate" (sets `rateMode = "AUTO"`, `useManualRate = false`).
		- Option 2: "Use manual rate" (sets `rateMode = "MANUAL"`, `useManualRate = true`).
	- Behavior:
		- AUTO → MANUAL:
			- Keep the current suggested rate in the input as a starting point.
			- Enable editing.
		- MANUAL → AUTO:
			- Clear `exchangeRateNote`.
			- Trigger FX suggestion for `(currency, date)` to refresh the rate.
- Rate input:
	- For base-currency transactions:
		- Always show `1.00` as read-only; hide toggle and note.
	- For foreign-currency transactions:
		- Read-only when `rateMode === "AUTO"`.
		- Editable when `rateMode === "MANUAL"`.
- Manual note field:
	- Only visible when `rateMode === "MANUAL"` and `isForeignCurrency`.
	- Label: "Reason for manual rate (optional)".
	- Bound to `exchangeRateNote` state.

### 4.4 Client-side validation and submit

- Validation in `handleSubmit`:
	- If `isForeignCurrency` and `rateMode === "MANUAL"`, require `exchangeRate > 0`.
	- For `rateMode === "AUTO"`, allow submit even if suggestion failed, since server will enforce policy and may return an error prompting manual rate.
	- For `isBaseCurrency`, ignore manual vs auto and enforce rate = 1.0.
- Payload construction (POST and PATCH):
	- Always send:
		- `currencyOriginal` (finalCurrency).
		- `amountOriginal`.
		- `useManualRate: rateMode === "MANUAL"`.
		- `exchangeRateNote` when non-empty.
	- Only send `exchangeRateToBase` when `rateMode === "MANUAL"` or base-currency (1.0).
	- Let server compute final `amountBase`, `exchangeRateIsManual`, and `exchangeRateSource`.
- After save success:
	- Use response data to update any local state if necessary.
	- Show confirmation toast.

---

## Phase 5 – Indicators & Listing/Reports

### 5.1 Dual currency display and manual indicator in transaction list

- `app/o/[orgSlug]/transactions/page.tsx`:
	- Ensure each row has access to:
		- `amountOriginal`, `currencyOriginal`, `amountBase`, `exchangeRateIsManual`.
	- Display logic:
		- If `currencyOriginal !== settings.baseCurrency`:
			- Show: `"{currencyOriginal} {amountOriginal} • {settings.baseCurrency} {amountBase}"` (using `formatCurrency`).
		- Else:
			- Show the base amount only (current behavior).
	- Manual indicator:
		- If `exchangeRateIsManual` is true:
			- Add a small badge/icon next to the amounts (e.g. an "M" or info icon).
			- Tooltip text: "Manual FX rate".

### 5.2 Transaction detail/edit view

- `app/o/[orgSlug]/transactions/[id]/page.tsx`:
	- Ensure API includes `exchangeRateIsManual`, `exchangeRateNote`, and `exchangeRateSource`.
	- Show an "Exchange rate" section:
		- Example: `"Rate: 4.20000000 MYR per USD"`.
		- `Source: Exchangerate.host` or `"Source: Manual override"`.
		- If `exchangeRateIsManual`:
			- Highlight with a badge: "Manual FX rate".
			- Show `exchangeRateNote` below when present.

### 5.3 Reporting and balances

- Confirm that account balances and other reports continue to rely only on `amountBase` (current design).
- For any future "currency reports" (already hinted in requirements):
	- Use `currencyOriginal` and `amountOriginal` for original-currency totals.
	- Use `amountBase` for base-currency totals.
	- Optionally expose counts of manual-rate transactions per currency.

---

## Phase 6 – Testing & Configuration

### 6.1 Environment configuration

- Update `.env.example` with FX settings:
	- `FX_PROVIDER=EXCHANGERATE_HOST`
	- `FX_API_BASE_URL=https://api.exchangerate.host` (optional override)
	- `FX_MAX_LOOKBACK_DAYS=30`
- Document in a suitable notes file (e.g. `notes/implementations.md` or a new FX-specific note):
	- What the FX provider is.
	- That FX runs server-side only.
	- How to switch to MOCK provider for tests.

### 6.2 Tests

- Unit tests for `lib/fx-service.ts`:
	- Returns cached rate when present.
	- On provider failure with `FALLBACK`, uses latest prior rate within `maxLookbackDays`.
	- Returns `null` when no fallback exists or policy is `MANUAL`.
- Tests for POST `/transactions`:
	- Base currency: enforces rate = 1.0, manual flags false.
	- Foreign currency + auto mode: uses provider rate, sets `exchangeRateIsManual = false`, `exchangeRateSource` correctly.
	- Foreign currency + manual mode: uses provided rate, sets `exchangeRateIsManual = true`, persists `exchangeRateNote`.
	- Failure policy:
		- `FALLBACK` with no history → 400 requiring manual rate.
		- `MANUAL` → 400 requiring manual rate.
- Tests for PATCH `/transactions/[id]`:
	- Changing date/currency with `autoRecalculateRate` updates rate and `amountBase`.
	- Switching from auto to manual and back.
	- Base-currency transactions remain pinned to rate 1.0.

---

## Out of Scope for This Plan

- Historical recomputation of all `amountBase` values on base-currency change (current UI explicitly says no recalculation; changing this should be a separate story).
- Advanced FX reporting (e.g. currency-specific dashboards) beyond ensuring current reports continue to use `amountBase`.
- Multi-provider routing or paid-provider-specific features beyond the simple pluggable adapter.

