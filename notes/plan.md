Sololedger Enhancements Plan – Categories, Business Settings, Vendors, Accounts

This plan extends Sololedger’s core ledger with richer master data and settings: categories gain delete-with-reassignment, color/icon configuration, drag-and-drop ordering, and usage analytics; business settings get post-onboarding business and financial UIs (with a safe base-currency change flow and member read-only access); vendors become first-class entities with APIs, autocomplete, auto-create, and merge; and accounts gain date-range balances with click-through to filtered transaction lists. The changes build on existing Prisma models, org-scoped APIs, and settings/transactions UIs, and respect your permissions model.

PHASE 0 – Foundations & Model Updates
0.1 Confirm and align Category model in `schema.prisma`
    - Ensure fields: `id`, `organizationId`, `name`, `type` ("INCOME"/"EXPENSE"), `parentId`, `color`, `icon`, `sortOrder`, `includeInPnL`, `active`, timestamps.
    - Verify or add useful indexes, especially `(organizationId, type, parentId, sortOrder)` and `(organizationId, type)`.

0.2 Introduce Vendor model in `schema.prisma`
    - Add `Vendor`:
        - `id` (cuid), `organizationId` (FK → Organization), `name` (varchar, required).
        - Contact fields: `email?`, `phone?`, `notes?`.
        - `active` boolean (default true).
        - `mergedIntoId?` (nullable self-FK for soft-merge).
        - `createdAt`, `updatedAt`.
    - Enforce per-org, case-insensitive unique name: e.g. composite unique on `(organizationId, lower(name))` via Prisma pattern (or equivalent).
    - Add indexes on `(organizationId, active)` and `(organizationId, name)`.

0.3 Extend Transaction model for vendor linkage and category analytics
    - Add `vendorId` (nullable FK → Vendor) while keeping existing `vendorName` string.
    - Confirm fields for category analytics and balances: `organizationId`, `categoryId`, `accountId`, `status` ("DRAFT"/"POSTED"), `amountBase`, `date`.
    - Add indexes: `(organizationId, categoryId, status, date)`, `(organizationId, vendorId, status, date)`, `(organizationId, accountId, status, date)` to support analytics and balances efficiently.

0.4 Verify Account model and indexes
    - Confirm fields: `id`, `organizationId`, `name`, `description?`, `isDefault`, `active`, timestamps.
    - Add index `(organizationId, active)` for listing, and rely on transaction indexes from 0.3 for balance queries.

0.5 Migrations & seeds
    - Create Prisma migration for Vendor + Transaction updates.
    - Adjust `prisma/seed.ts` if needed:
        - Ensure default categories have sensible `sortOrder`.
        - Optionally seed a couple of vendors for dev/testing.
    - Run `npx prisma generate` and `npx prisma migrate dev` to apply.

PHASE 1 – Categories: Delete with Reassignment, Color/Icon, Reorder, Analytics

1.1 Backend: Delete category with reassignment (modal-driven flow)
    - Add endpoint, e.g. `POST /api/orgs/[orgSlug]/categories/[categoryId]/delete-with-reassignment`:
        - Input: `{ replacementCategoryId: string }`.
        - Auth: `requireMembership` (members and admins can manage categories per matrix).
        - Validation:
            - Both categories must belong to org and be active.
            - Types must match (INCOME vs EXPENSE).
            - Category cannot be reassigned to itself.
        - Implementation (transaction):
            - Reassign all `Transaction` rows where `categoryId = categoryId` to `replacementCategoryId`.
            - Delete the category (hard delete) or set `active=false` per your preference; align with `plan.md` (hard delete post-reassignment for simpler lists).
            - Return `{ reassignedCount }` for UI feedback.
        - Optional: create an `AuditLog` entry for category deletion/reassignment.

1.2 Backend: Category reorder persistence (sibling-level sort)
    - Add endpoint `POST /api/orgs/[orgSlug]/categories/reorder`:
        - Input shape (aligned with sibling-only ordering): array of objects like `{ id, sortOrder }` or per group: `{ parentId, type, orderedIds[] }`.
        - Auth: `requireMembership`.
        - Validation:
            - All categories belong to org.
            - Reordering is applied per `(type, parentId)` group.
        - Implementation:
            - For each group, reassign `sortOrder` sequentially (e.g. 1..N) according to received order.
            - Use a transaction to ensure all updates apply atomically.

1.3 Backend: Category usage analytics (rolling 12 months + optional range)
    - Add endpoint `GET /api/orgs/[orgSlug]/categories/usage`:
        - Query params: `from`, `to` (optional). If omitted, default to last 12 months.
        - Auth: `requireMembership`.
        - For each category:
            - Count of POSTED transactions in range.
            - Sum of `amountBase` in range.
            - `lastUsedAt`: max transaction date in range.
        - Implementation:
            - Query `Transaction` grouped by `categoryId` with filters on `organizationId`, `status = "POSTED"`, and date range.
            - Join with `Category` to return enriched data.

1.4 Frontend: Category management UI enhancements (post-onboarding)
    - In `app/o/[orgSlug]/settings/categories/page.tsx`:
        - Color/icon editing:
            - Extend form state with `formColor`, `formIcon`.
            - In add/edit dialog, add:
                - Color selector: small fixed palette or text input; persist to `color`.
                - Icon selector: dropdown of a curated Lucide icon list, storing icon name as string.
            - Render color swatch and icon in category rows.
        - Drag-and-drop ordering:
            - Implement sortable list for categories (per active tab/type) using a DnD helper.
            - On drop:
                - Update local array order.
                - Build payload per `(type, parentId)` group and call `POST /categories/reorder`.
                - Handle optimistic update with error rollback if needed.
        - Delete with reassignment:
            - Add “Delete” action/button on each category row.
            - On click:
                - Open modal.
                - Show warning text and the category name.
                - If analytics are available (from 1.3), show transaction count and total.
                - Add a select for replacement category restricted to same type and org (exclude current).
                - On confirm, call `delete-with-reassignment` endpoint, show success toast, and refresh list + analytics.
            - For categories with zero usage:
                - Either allow direct delete via existing `DELETE` or reuse same modal with replacement optional and block only if count>0.
        - Usage analytics surface:
            - Optionally add a toggle or small date-range selector near the list.
            - Show per-category stats (e.g. “23 tx, 12,345.67 MYR, last used 2025-10-15”) in the row subtitle or a hover.

1.5 Frontend: Category dropdown ordering in forms and filters
    - Ensure category lists in:
        - `TransactionForm` (`components/features/transactions/transaction-form.tsx`),
        - onboarding categories page,
        - any reporting filters,
      are sorted by `type` and `sortOrder`, with parent/child structure respected.
    - If API already orders by `type` + `sortOrder`, just use that; otherwise, sort client-side based on returned fields.
    - Consider rendering parent labels with children indented or prefixed (e.g. “Marketing / Facebook Ads”).

PHASE 2 – Business Settings: Post-Onboarding Info + Base Currency Change

2.1 Backend: Business settings read/write
    - Adjust `GET /api/orgs/[orgSlug]/settings/business`:
        - Auth: change from admin-only to `requireMembership` for reads.
        - Return full business info (name, type, address, phone, email, taxId).
    - Keep `PATCH /settings/business` admin-only via `requireAdminOrSuperadmin`.
    - Confirm `OrganizationSettings` has fields: `businessType`, `businessTypeOther`, `address`, `phone`, `email`, `taxId`, `baseCurrency`, `fiscalYearStartMonth`.
    - Confirm financial settings endpoint (`/settings/financial`) exposes `baseCurrency`, `fiscalYearStartMonth`, `dateFormat`, `decimalSeparator`, `thousandsSeparator`; add any missing fields.

2.2 Frontend: Business Info tab (post-onboarding)
    - Under `app/o/[orgSlug]/settings/organization/(tabs)`, add `business-info` tab page:
        - Reuse onboarding `BusinessDetails` form schema (zod) and layout for fields:
            - Business name, type (with “Other” + extra field), address, phone, email, tax ID.
        - On mount:
            - Fetch `GET /settings/business` and populate form.
        - Behavior:
            - If user is admin:
                - Editable form with “Save” button using `PATCH /settings/business`.
                - Show success/error toasts and revalidate on save.
            - If user is member:
                - Render same form but all inputs disabled; hide “Save” button.
        - Ensure organization name changes flow through to any shared context (likely already via org fetches).

2.3 Frontend: Financial Settings tab + base currency change
    - Add `financial-settings` tab page:
        - Show current:
            - Base currency (code + label).
            - Fiscal year start month.
            - Date format, number format.
        - For admins:
            - Controls to edit fiscal year and formats via `PATCH /settings/financial`.
            - “Change base currency” section:
                - Display current base currency.
                - “Change base currency” button opens dialog:
                    - Warning text explaining that:
                        - Base currency for reporting will change.
                        - Stored `amountBase` is not recalculated; historical comparisons may be less meaningful.
                    - Required confirmation (checkbox or text input “CHANGE”).
                    - Base currency selector (ISO list) with the current value preselected.
                    - Confirm button that calls `PATCH /settings/financial` with new base currency only.
                - On success: toast and revalidation of settings; optionally refresh key dashboards.
        - For members:
            - Display-only view; hide change controls.

2.4 Shared settings hooks
    - Implement `useBusinessSettings(orgSlug)` and `useFinancialSettings(orgSlug)`:
        - Use SWR (or similar) to fetch and cache `GET /settings/business` and `GET /settings/financial`.
        - Expose `data`, `isLoading`, `error`, and a `mutate` function for refresh.
    - Use these hooks in:
        - Onboarding steps (business, financial).
        - Organization settings tabs (business info, financial).

PHASE 3 – Vendors: Model, APIs, Autocomplete, Auto-Create, Management, Merge

3.1 Backend: Vendor CRUD API
    - Create `app/api/orgs/[orgSlug]/vendors/route.ts`:
        - `GET`:
            - Auth: `requireMembership`.
            - Query params: `query?` (for autocomplete), `from?`, `to?` (for totals).
            - Behavior:
                - If `query` present: filter vendors by case-insensitive match on `name`, limit to e.g. 20 results.
                - If `from`/`to` present: include aggregated totals per vendor (posted transactions in date range using `amountBase`).
                - Return `vendors` with fields: id, name, email, phone, notes, active, optional `totals`.
        - `POST`:
            - Auth: `requireMembership` (members can manage vendors).
            - Validate payload: `name` required; email/phone/notes optional.
            - Enforce per-org, case-insensitive uniqueness (handle conflict gracefully with clear error).
    - Create `app/api/orgs/[orgSlug]/vendors/[vendorId]/route.ts`:
        - `PATCH`:
            - Auth: `requireMembership`.
            - Allow edits to name, contact fields, `active`.
            - Validate uniqueness when renaming.
    - Create `app/api/orgs/[orgSlug]/vendors/merge/route.ts`:
        - `POST`:
            - Auth: `requireMembership` (or admin-only if you prefer stricter control).
            - Input: `{ primaryId: string, ids: string[] }`.
            - Validation:
                - `primaryId` belongs to org, is active.
                - All `ids` belong to same org, are distinct from `primaryId`.
            - Implementation (transaction):
                - Update `Transaction` where `vendorId` in `ids` to `primaryId`.
                - For each secondary vendor:
                    - Set `active=false`.
                    - Set `mergedIntoId = primaryId`.
                - Optionally log merge into `AuditLog`.

3.2 Backend: Auto-create vendor on transaction save
    - In `POST /api/orgs/[orgSlug]/transactions` and `PATCH /api/orgs/[orgSlug]/transactions/[transactionId]`:
        - Before creating/updating transaction:
            - If `vendorId` supplied: use as-is after verifying it belongs to org.
            - Else if `vendorName` is non-empty:
                - Look up existing vendor for org by name (case-insensitive).
                - If found: use its `id` as `vendorId`.
                - If not found: create new `Vendor` with given name (and possibly no contact info) and set `vendorId`.
            - Persist `vendorName` along with `vendorId`.
        - Ensure all operations are scoped by `organizationId`.

3.3 Frontend: Vendor autocomplete on transaction form
    - In `TransactionForm` component:
        - Replace plain `Input` for `vendorName` with an autocomplete input:
            - On typing, debounce and call `GET /vendors?query=...`.
            - Show dropdown (using e.g. shadcn `Command` or `Popover`) of vendor suggestions.
            - Selecting a suggestion sets both `vendorName` (for display) and `vendorId` in form state.
            - If the user types a new name and does not select a suggestion:
                - Keep `vendorName` string only; on submit, backend auto-creates vendor as per 3.2.
        - Handle loading/empty states and display basic errors with toasts.

3.4 Frontend: Vendor management screen with totals and merge
    - Add a route, e.g. `app/o/[orgSlug]/settings/vendors/page.tsx`:
        - Layout:
            - Date range selector (default rolling 12 months or fiscal YTD).
            - Table/list of vendors with:
                - Name.
                - Contact details (email, phone).
                - Active status badge.
                - Totals for selected period: count of transactions, total base amount (spent/received).
            - Actions:
                - Inline edit button for each row to open a dialog for editing vendor metadata.
                - Toggle active/inactive.
        - Merge duplicates:
            - Allow multi-select (checkbox per row).
            - “Merge vendors” button:
                - When clicked:
                    - Ensure at least two vendors selected.
                    - Open dialog showing selected vendors.
                    - Require choosing primary vendor (radio/select).
                    - Show explanation that all transactions will be reassigned and secondaries deactivated but preserved.
                - On confirm:
                    - Call `POST /vendors/merge` with primary + secondary IDs.
                    - On success, refresh vendors list and show toast.
        - Respect permissions:
            - Members and admins can view and manage vendors per current rules; adjust if you want merge to be admin-only.

PHASE 4 – Accounts: Date-Range Balances & Click-Through

4.1 Backend: Account balances by date range
    - Create endpoint `GET /api/orgs/[orgSlug]/accounts/balances`:
        - Query params: `from`, `to` (required or default).
        - Auth: `requireMembership`.
        - Behavior:
            - For each active account in org:
                - Compute base currency balance = sum of `amountBase` for POSTED transactions within date range.
                - Include account meta: id, name, isDefault, active.
            - Return `accounts` with `balanceBase` and maybe `transactionCount`.
        - Implementation:
            - Query `Transaction` grouped by `accountId` with filters on `organizationId`, `status`, and date.
            - Join or map with `Account` table results.

4.2 Frontend: Accounts balances UI in settings
    - In `app/o/[orgSlug]/settings/accounts/page.tsx`:
        - Add date range controls:
            - Default to fiscal year-to-date (based on `OrganizationSettings.fiscalYearStartMonth`) or last 30 days, per your preference.
            - Allow user to adjust range.
        - On change:
            - Fetch `GET /accounts/balances?from=...&to=...`.
        - Display:
            - Extend account rows to show base currency balance for selected range.
            - Show currency symbol/code from org base currency.
        - Click-through:
            - Make each account row clickable (or add “View transactions” link).
            - On click, navigate to `/o/[orgSlug]/transactions` with query params `accountId`, `from`, `to`.
            - Update transactions list page to read these query params and initialize filters accordingly (if not already supported).

4.3 Optional: Dashboard accounts widget
    - Optionally, add an “Accounts overview” widget to the main org dashboard page:
        - Use the same `accounts/balances` endpoint with a default date range (e.g., “All time” or YTD).
        - Show top N accounts and total balance.
        - Rows clickable to the filtered transactions page.

PHASE 5 – Testing, Permissions, and Polish

5.1 Tests and validation
    - Backend:
        - Add tests for:
            - Category delete/reassign.
            - Category reorder endpoint.
            - Category usage analytics.
            - Vendor CRUD, search, merge, and transaction auto-create behavior.
            - Accounts balances endpoint.
            - Business and financial settings GET/PATCH with correct role behavior.
    - Frontend:
        - Spot-check:
            - Category drag-and-drop and delete flows.
            - Business/financial settings screens (admin vs member).
            - Vendor autocomplete in transaction form (existing vs new vendor).
            - Vendor merge effect on transactions.
            - Account balances recalculating correctly when changing date range and click-through to transaction list.
        - Verify org scoping and that no cross-org leakage occurs.

5.2 Permissions and UX polish
    - Confirm that:
        - `requireMembership` and `requireAdminOrSuperadmin` are used consistently according to requirements.
        - Admin-only UI actions are not visible or are disabled for members.
    - Polish UX:
        - Add loading states, empty states (“No vendors found for this period”), and clear error toasts.
        - Debounce vendor autocomplete and avoid excessive reorder API calls (e.g., save only on drop, not on every drag).
        - Ensure color/icon choices do not break existing layouts.
