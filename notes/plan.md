# Plan – Transactions: Filters, Bulk, Trash

We’ll upgrade the transactions list and its APIs to support rich server-side filtering (including multi-category, vendor/client, amount range in base currency, and currency), add multi-select with a bulk action toolbar for category/status changes, soft delete, and CSV export, introduce a dedicated Trash view for soft-deleted transactions with restore and permanent delete, and enforce soft-closed period warnings/confirmations (and override flags) when editing Posted transactions—both for single-edit and bulk flows—while preserving the existing Prisma, API, and UI patterns.

## 1. Understand and Align with Existing Stack

- Review `prisma/schema.prisma`:
	- Confirm `Transaction` fields: `status`, `type`, `amountOriginal`, `currencyOriginal`, `exchangeRateToBase` / `amountBase`, `deletedAt`, `vendorId`/`clientId`, `vendorName`/`clientName`.
	- Identify any existing soft-close-related fields on organization or financial settings.
- Inspect existing APIs:
	- `app/api/orgs/[orgSlug]/transactions/route.ts` – current GET filters (`dateFrom`, `dateTo`, `type`, `status`), pagination, and default `deletedAt` handling.
	- `app/api/orgs/[orgSlug]/transactions/[transactionId]/route.ts` – existing GET, PATCH, DELETE; confirm soft delete via `deletedAt`, and check update semantics.
- Inspect UI:
	- `app/o/[orgSlug]/transactions/page.tsx` – list rendering, current filters, search behavior, delete flow, and any use of custom hooks.
	- `app/o/[orgSlug]/transactions/[id]/page.tsx` – edit form, how it loads categories/vendor/client, how it posts updates.
- Check related notes:
	- `notes/requirements.md` sections 7–8, 12, 15 for expectations on filters, bulk, soft delete, Trash.
	- `notes/user_stories.md` for `US-TRX-004` and `US-TRASH-001` to ensure acceptance criteria coverage.

## 2. Server-Side Filter Enhancements

Goal: Support advanced filters on the GET `/api/orgs/[orgSlug]/transactions` endpoint while keeping deleted items excluded.

- Extend query parameters:
	- `categoryIds`: string (comma-separated IDs or repeatable params), mapped to `categoryId IN [...]`.
	- `vendorId`: vendor primary key; filter `transaction.vendorId` or related vendor entity.
	- `clientId`: client primary key; filter `transaction.clientId` or related client entity.
	- `amountMin`, `amountMax`: numbers representing base-currency amount; filter on `amountBase` (or computed `amountOriginal * exchangeRateToBase` if no stored base field).
	- `currency`: single currency code; filter `currencyOriginal` (or appropriate field).
- Update Prisma query builder for `/transactions`:
	- Start from existing filters: `type`, `status`, `dateFrom`, `dateTo`, and `deletedAt: null`.
	- Add optional filters:
		- `categoryId: { in: categoryIds[] }` when provided.
		- `vendorId: vendorId` and/or `clientId: clientId` when provided.
		- `amountBase: { gte: amountMin, lte: amountMax }` (or equivalent computed clauses).
		- `currencyOriginal: currency` when provided.
	- Ensure filters combine with logical AND and don’t break pagination or sorting.
- Search behavior:
	- For now, keep the existing client-side search in `transactions/page.tsx` to satisfy description/vendor/client text search.
	- Optionally, log a follow-up task to move search server-side later for large datasets.

## 3. Advanced Filters UI in Transactions List

Goal: Add multi-category, vendor/client dropdowns, amount range in base currency, and currency filter on the main transactions page.

- Categories:
	- Load categories via existing `GET /api/orgs/[orgSlug]/categories` endpoint.
	- Add a multi-select Category filter in `app/o/[orgSlug]/transactions/page.tsx`:
		- Use a popover/command-style menu with checkable items for categories.
		- Show a summary label such as “All categories” / “3 selected”.
	- Store selected category IDs in component state and serialize into `categoryIds` query params for `loadTransactions()`.
- Vendor & Client filters:
	- Add a `Vendor` dropdown filter backed by a vendor list endpoint (or implement one if missing).
	- Add a `Client` dropdown filter for income transactions, reusing the same pattern.
	- Store selected IDs in state and append `vendorId` / `clientId` to API params.
- Amount range & currency:
	- Add `amountMin` / `amountMax` numeric inputs representing base-currency amounts:
		- Validate locally (non-negative, `min <= max` where both are present).
	- Add a single-select `Currency` dropdown:
		- Initialize from org settings (`baseCurrency`) plus any additional enabled currencies.
		- Bind selected value to `currency` query param.
- Wiring & UX:
	- Extend `loadTransactions()` to include new filter params from state.
	- Ensure Reset/“Clear filters” button also resets the new filters to defaults.
	- Keep the current client-side text search for description/vendor/client and ensure it operates on the already-filtered result set.

## 4. Multi-Select & Selection Toolbar in List

Goal: Add per-row checkboxes, header select-all, and a conditional bulk actions toolbar for selected transactions.

- Selection state:
	- Add `selectedTransactionIds: string[]` state in `transactions/page.tsx`.
	- Derive `allSelectedOnPage` and `someSelected` from the currently rendered transaction list.
- Checkbox column:
	- Add a leading checkbox column to the table/list.
	- Header checkbox toggles selection of all transactions currently visible on the page.
	- Row checkboxes toggle each transaction ID in `selectedTransactionIds`.
- Selection toolbar:
	- Show a sticky or top-aligned toolbar when `selectedTransactionIds.length > 0`.
	- Display selection count (e.g. “3 selected”).
	- Include actions: “Change category”, “Change status”, “Delete selected”, “Export selected CSV”.
- Interaction details:
	- Ensure row click continues to navigate to transaction detail without interfering with checkbox clicks.
	- Make checkboxes keyboard-accessible and maintain focus styles for accessibility.

## 5. Bulk Actions API and Backend Logic

Goal: Provide a single bulk endpoint for category/status changes and soft delete, respecting soft-closed period rules.

- New bulk endpoint:
	- Implement `POST /api/orgs/[orgSlug]/transactions/bulk`.
	- Request body structure:
		- `transactionIds: string[]` (required)
		- `action: "changeCategory" | "changeStatus" | "delete"` (required)
		- `categoryId?: string` (for `changeCategory`)
		- `status?: "DRAFT" | "POSTED"` (for `changeStatus`)
		- `allowSoftClosedOverride?: boolean` (for status changes affecting soft-closed periods).
- Common validation:
	- Reuse auth helpers to load current user and org.
	- Ensure all `transactionIds` belong to the org; ignore or mark as failure otherwise.
	- Exclude transactions with `deletedAt != null` from updates.
- Action-specific logic:
	- `changeCategory`:
		- Validate `categoryId` exists and belongs to org.
		- Update `categoryId` for each eligible transaction.
	- `changeStatus`:
		- Allow status changes both directions (Draft ↔ Posted) by default.
		- For any transaction that is `POSTED` and in a soft-closed period, require `allowSoftClosedOverride === true`; otherwise mark as failure.
	- `delete`:
		- Perform soft delete via `deletedAt = new Date()` for each eligible transaction.
- Partial success response (error strategy):
	- Execute updates per transaction and collect:
		- `successCount`
		- `failureCount`
		- `failures: { transactionId: string; reason: string }[]`
	- Return this structure so the UI can display a summary toast and optionally log details.

## 6. Bulk Actions UI Wiring

Goal: Connect selection toolbar actions to the bulk API and CSV export endpoint.

- Change category bulk action:
	- When user clicks “Change category” in toolbar, open a dialog to pick a category.
	- On confirm, call bulk endpoint with `action: "changeCategory"`, `transactionIds`, and `categoryId`.
	- On success, show toast summarizing updates; refresh transactions list and clear selection.
- Change status bulk action:
	- When user clicks “Change status”, open a dialog to choose new status (Draft/Posted).
	- Before calling API, check for any selected transactions that are `POSTED` in a soft-closed period:
		- If found, show a confirmation dialog explaining the override.
		- If user confirms, send bulk request with `allowSoftClosedOverride: true`.
	- Handle partial success by showing a toast that includes success and failure counts.
- Bulk delete action:
	- On “Delete selected”, show a confirmation dialog.
	- If confirmed, call bulk endpoint with `action: "delete"`.
	- On success, toast and refresh list; on partial success, surface failures.
- Bulk CSV export action:
	- On “Export selected”, generate a URL for the CSV export endpoint (see next section) with selected IDs.
	- Trigger browser download via navigation or a programmatic link.

## 7. CSV Export Endpoint and Behavior

Goal: Provide CSV export for selected transactions via a dedicated GET endpoint.

- New export endpoint:
	- Implement `GET /api/orgs/[orgSlug]/transactions/export?ids=id1,id2,...`.
	- Validate org membership and that all requested transactions belong to the org and are not soft-deleted.
- CSV generation:
	- Create or reuse a CSV utility (e.g. in `lib/transactions-export.ts`).
	- Include columns such as: `id`, `date`, `type`, `status`, `amountBase`, `amountOriginal`, `currencyOriginal`, `categoryName`, `accountName`, `vendorName`, `clientName`, `notes`.
	- Set headers: `Content-Type: text/csv` and `Content-Disposition` with a timestamped filename.
- UI integration:
	- Use the bulk toolbar’s “Export selected” to hit this endpoint.
	- Optionally show a brief toast (“Export started”) if using programmatic download.

## 8. Trash View for Soft-Deleted Transactions

Goal: Add a dedicated transactions Trash page under the org that lists soft-deleted transactions and supports restore and permanent delete.

- Trash list API:
	- Implement `GET /api/orgs/[orgSlug]/transactions/trash`.
	- Filter by `deletedAt != null` and org.
	- Support minimal filters (date deleted, type, text search):
		- Query params: `deletedFrom`, `deletedTo`, `type`, `search`.
- Trash page UI:
	- Add `app/o/[orgSlug]/transactions/trash/page.tsx`.
	- Layout similar to main transactions table but focused on:
		- Columns: type, description, transaction date, deletedAt, status, key identifiers.
		- Filters: deleted date range, type selector, search box.
	- Actions per row: “Restore” and “Delete permanently”.
- Restore endpoint:
	- Implement `POST /api/orgs/[orgSlug]/transactions/[transactionId]/restore`.
	- Validate org and membership, ensure `deletedAt != null`, then set `deletedAt = null`.
- Permanent delete endpoint:
	- Implement `DELETE /api/orgs/[orgSlug]/transactions/[transactionId]/hard-delete`.
	- Validate org and membership.
	- Remove transaction record and any dependent join records (e.g. transaction-document links), consistent with Trash requirements.
- Trash UX behavior:
	- On restore: stay in Trash view, show “Transaction restored” toast, and remove item from the Trash list.
	- On permanent delete: show confirmation dialog, then remove item from list on success and show a toast.

## 9. Soft-Closed Period Model and Helper

Goal: Model soft-closed periods with a simple cutoff date field and provide a reusable helper.

- Data model:
	- Add a field to the organization’s financial settings model (if not present), for example `softClosedBefore: Date | null`.
	- Ensure any settings API or management UI that edits financial settings can read/write this field.
- Helper function:
	- Implement `isInSoftClosedPeriod(transactionDate: Date, softClosedBefore: Date | null): boolean` in a shared utility (e.g. `lib/periods.ts`).
	- Return true when `softClosedBefore` is set and `transactionDate < softClosedBefore`.
- Usage in APIs:
	- In single transaction PATCH and bulk endpoints, load org settings to get `softClosedBefore`.
	- Use the helper to determine whether a transaction is in a soft-closed period when applying edits or status changes.

## 10. Soft-Closed Warning & Confirmation in Single Transaction Edit

Goal: Warn users and require confirmation when editing a Posted transaction in a soft-closed period, with server-side enforcement.

- Client-side detection:
	- In `app/o/[orgSlug]/transactions/[id]/page.tsx`, load org financial settings alongside transaction data.
	- Use the same logic as `isInSoftClosedPeriod` to flag if a `POSTED` transaction lies before `softClosedBefore`.
	- If true, show a warning banner explaining that edits will override a soft-closed period.
- Submit flow:
	- When user submits changes to such a transaction:
		- Show a confirmation dialog: explain the risk of editing Posted items in soft-closed periods.
		- If user confirms, include `allowSoftClosedOverride: true` in the PATCH payload.
		- If user cancels, abort the submit.
- API enforcement:
	- In PATCH `/api/orgs/[orgSlug]/transactions/[transactionId]`:
		- Load org settings and the existing transaction.
		- If transaction is `POSTED` and `isInSoftClosedPeriod` returns true:
			- If `allowSoftClosedOverride` is not true, reject with a 400 error and a clear message.
			- Otherwise, proceed with the update.
	- For v1, allow all fields to change after override, while documenting that this may affect reported figures.

## 11. Soft-Closed Logic for Bulk Status Changes

Goal: Apply soft-closed period rules to bulk status changes with a single confirmation step.

- Client-side behavior:
	- When user triggers bulk “Change status”, determine (from available data and org settings) whether any selected transactions are `POSTED` and in a soft-closed period.
	- If at least one is:
		- Show a bulk confirmation dialog summarizing how many such transactions are affected.
		- If user agrees, call the bulk API with `allowSoftClosedOverride: true`.
		- If user cancels, abort the request.
- Server enforcement:
	- In the bulk API, for each transaction:
		- Use `isInSoftClosedPeriod` to determine if the transaction is in a soft-closed period and `status === "POSTED"`.
		- If so, require `allowSoftClosedOverride` to be true or mark that transaction as a failure.
	- Return partial success details so the UI can report exactly how many updates succeeded vs. failed.

## 12. Consistent Soft Delete & Trash Behavior

Goal: Ensure all deletion flows use soft delete by default and that Trash is the only place where hard delete occurs.

- Delete semantics:
	- Confirm existing `DELETE /transactions/[transactionId]` sets `deletedAt = new Date()`.
	- Ensure bulk delete uses the same soft-delete logic.
	- Ensure permanent delete endpoints are used only from Trash and remove the record entirely.
- List and reporting filters:
	- Verify all normal transaction lists and reporting queries exclude `deletedAt != null` transactions.
	- Update any queries that still include soft-deleted rows inadvertently.
- Activity log integration (if present):
	- For single delete, bulk delete, restore, and permanent delete, add or extend activity log entries with type, user, and timestamp.

## 13. Testing and Validation

Goal: Validate filters, bulk actions, Trash flows, and soft-closed behavior across API and UI.

- API tests (or manual verification if tests are not yet in place):
	- Verify combinations of filters (category multi-select, vendor/client, amount range, currency) return expected transactions.
	- Test bulk category and status changes with normal and soft-closed scenarios, including override flag handling.
	- Test soft delete, Trash listing, restore, and permanent delete end-to-end.
- UI testing scenarios:
	- Verify advanced filters correctly update the list and Reset clears them.
	- Confirm selection toolbar appears and disappears as expected; header checkbox selects all visible rows.
	- Validate bulk actions (category, status, delete, export) perform correct API calls and show appropriate toasts.
	- Confirm soft-closed warning banners and confirmation dialogs appear only when required and block edits when overridden is not confirmed.
	- Confirm Trash view behavior for restore and permanent delete and that restored items reappear in the normal transactions list.

