Sololedger Milestone 1 – Implementation Plan

1. Prisma schema & migrations

1.1 Add Sololedger enums

- Add enums to `prisma/schema.prisma`:
  - `TransactionType { INCOME, EXPENSE }`
  - `TransactionStatus { DRAFT, POSTED }`
  - `CategoryType { INCOME, EXPENSE }`
  - `DateFormat { DD_MM_YYYY, MM_DD_YYYY, YYYY_MM_DD }` (default: `YYYY_MM_DD`)
  - `DecimalSeparator { DOT, COMMA }` (default: `DOT`)
  - `ThousandsSeparator { COMMA, DOT, SPACE, NONE }` (default: `COMMA`)
- Ensure enums are later usable in TypeScript via `@prisma/client` types.

  1.2 Extend Organization model for Sololedger

- In `prisma/schema.prisma`:
  - Extend `Organization` with:
    - Optional 1:1 `OrganizationSettings` relation:
      - `settings OrganizationSettings?`
    - 1:N relations:
      - `accounts Account[]`
      - `categories Category[]`
      - `transactions Transaction[]`
- Do not change existing auth/AI/integrations relations.

  1.3 Add OrganizationSettings model

- Add `OrganizationSettings`:
  - PK: `id String @id @default(cuid())`
  - FK: `organizationId String @unique`
  - Relation: `organization Organization @relation(fields: [organizationId], references: [id])`
  - Business details fields:
    - `businessType String` (e.g. "Freelance", "Consulting", "Agency", "SaaS", "Other")
    - `businessTypeOther String?` (required in UI when type == Other)
    - `address String?`
    - `phone String?`
    - `email String?`
    - `taxId String?`
  - Financial configuration:
    - `baseCurrency String` (ISO, e.g. "MYR")
    - `fiscalYearStartMonth Int` (1–12, default 1)
    - `dateFormat DateFormat @default(YYYY_MM_DD)`
    - `decimalSeparator DecimalSeparator @default(DOT)`
    - `thousandsSeparator ThousandsSeparator @default(COMMA)`
  - Metadata:
    - `createdAt DateTime @default(now())`
    - `updatedAt DateTime @updatedAt`
  - Optional future-proof fields (prepare for requirements):
    - `isOnboardingComplete Boolean @default(false)`
    - `softDeletedAt DateTime?` (for future org-level archival if needed)
    - Optional tax-related placeholders to support Section 5 later (e.g. `isTaxRegistered Boolean?`, `defaultTaxRate Decimal? @db.Decimal(5, 2)`).

  1.4 Add Account model

- Add `Account`:
  - PK: `id String @id @default(cuid())`
  - FK: `organizationId String`
  - Relation: `organization Organization @relation(fields: [organizationId], references: [id])`
  - Fields:
    - `name String`
    - `description String?`
    - `isDefault Boolean @default(false)`
    - `active Boolean @default(true)`
    - `createdAt DateTime @default(now())`
    - `updatedAt DateTime @updatedAt`
  - Relation:
    - `transactions Transaction[]`
- Enforce single default per org in application logic (not DB constraint).

  1.5 Add Category model

- Add `Category`:
  - PK: `id String @id @default(cuid())`
  - FK: `organizationId String`
  - Relation to org:
    - `organization Organization @relation(fields: [organizationId], references: [id])`
  - Hierarchy:
    - `parentId String?`
    - Self-relation:
      - `parent Category? @relation("CategoryHierarchy", fields: [parentId], references: [id])`
      - `children Category[] @relation("CategoryHierarchy")`
  - Fields:
    - `name String`
    - `type CategoryType`
    - `color String?` (store hex or Tailwind token)
    - `icon String?` (Lucide icon name)
    - `sortOrder Int @default(0)`
    - `includeInPnL Boolean @default(true)`
    - `active Boolean @default(true)`
    - `createdAt DateTime @default(now())`
    - `updatedAt DateTime @updatedAt`
  - Relation:
    - `transactions Transaction[]`

  1.6 Add Transaction model

- Add `Transaction`:
  - PK: `id String @id @default(cuid())`
  - FKs:
    - `organizationId String`
    - `accountId String`
    - `categoryId String`
    - `userId String` (creator/last editor; link to `User` if desired)
  - Relations:
    - `organization Organization @relation(fields: [organizationId], references: [id])`
    - `account Account @relation(fields: [accountId], references: [id])`
    - `category Category @relation(fields: [categoryId], references: [id])`
    - Optionally: `user User @relation(fields: [userId], references: [id])` (if you want full relation now)
  - Core fields:
    - `type TransactionType`
    - `status TransactionStatus @default(POSTED)`
  - Amount & FX:
    - `amountOriginal Decimal @db.Decimal(18, 2)`
    - `currencyOriginal String`
    - `exchangeRateToBase Decimal @db.Decimal(18, 8)`
    - `amountBase Decimal @db.Decimal(18, 2)`
  - Other fields:
    - `date DateTime`
    - `description String`
    - Optional:
      - `vendorName String?` (pre-vendor model placeholder)
      - `tags String?` (for future tagging)
      - `notes String?`
  - Soft delete:
    - `deletedAt DateTime?`
  - Timestamps:
    - `createdAt DateTime @default(now())`
    - `updatedAt DateTime @updatedAt`

  1.7 Add optional Organization flag for onboarding

- In `Organization`:
  - Add `onboardingStatus String @default("pending")` or `onboardingComplete Boolean @default(false)`:
    - Used to gate access to business dashboard and transactional features.
    - Relates to Section 4 onboarding being mandatory.

  1.8 Run migrations

- Run:
  - `npx prisma generate`
  - `npx prisma migrate dev --name sololedger_initial`
- Verify generated client types for new models & enums.

---

2. Onboarding flow (multi-step, mandatory)

2.1 Onboarding data model decisions

- Use existing `Organization` for business-level tenant.
- Store extended business details + financial settings in `OrganizationSettings`.
- Consider `onboardingComplete` or equivalent flag on `Organization` or `OrganizationSettings`.
  - Example: `OrganizationSettings` presence + `onboardingComplete = true` indicates completed onboarding.

  2.2 Refactor/create onboarding routes structure

- Keep initial org creation (name + slug) as the first action (`/api/orgs` + `app/onboarding/create-organization`), but integrate it into a multi-step experience:
  - Step 1: create org (Workspace/Business identity).
  - Step 2: Business details.
  - Step 3: Financial configuration.
  - Step 4: Category setup.

  2.3 Update /api/orgs POST to mark onboarding state

- After creating an Organization:
  - Ensure an initial `onboardingComplete = false` flag.
  - Optionally create a minimal `OrganizationSettings` stub with `baseCurrency` and other fields null or default placeholders OR leave settings creation to next step’s API route.
  - Return both `organization.id` and `slug` to the frontend to drive subsequent steps.

  2.4 Rework CreateOrganizationPage to function as Step 1

- In `app/onboarding/create-organization/page.tsx`:
  - Keep current form (name + slug) but:
    - Update copy from "Workspace" to "Business" for user-facing text.
    - On success, redirect not to `/o/[slug]/dashboard` but to onboarding Step 2, e.g. `/onboarding/[orgId]/business` or `/onboarding/[orgSlug]/business`.
  - Use personalized text if user name is available (fetch minimal profile if needed).
  - This page serves as onboarding Step 1 of 4, with visible progress indicator.

  2.5 Implement Business Details step (Step 2)

- New route, e.g. `app/onboarding/[orgSlug]/business/page.tsx`:
  - Fields:
    - `businessName` (must sync with `Organization.name`)
    - `businessType` (dropdown: Freelance, Consulting, Agency, SaaS, Other)
    - Conditional free-text `businessTypeOther` when type == Other.
    - Optional: address, phone, email, tax ID.
  - Behavior:
    - Pre-fill `businessName` with existing `Organization.name` but allow edits (updates Organization).
    - Validate: name non-empty; type selected; if type == Other, require `businessTypeOther`.
    - Use "Save & Continue" which:
      - Upserts `OrganizationSettings` with these fields.
      - Updates `Organization.name` if changed.
      - Persists even if user navigates away.
    - Block navigation to next step until required fields valid.
  - Backend:
    - Add API route (e.g. `app/api/orgs/[orgId]/settings/business/route.ts`) to handle upsert of `OrganizationSettings` and update of `Organization.name`.
  - UI:
    - Show progress indicator: "Step 2 of 4 – Business details".
    - Use existing form UI components and Sonner toasts.

  2.6 Implement Financial Configuration step (Step 3)

- New route, e.g. `app/onboarding/[orgSlug]/financial/page.tsx`:
  - Fields:
    - `baseCurrency`:
      - Use curated searchable select with at least MYR & USD; place MYR at top.
      - Provide a small curated list (MYR, USD, EUR, GBP, SGD, etc.) plus an "Other" option that reveals a text input.
    - `fiscalYearStartMonth` (1–12):
      - Dropdown of month names with corresponding numeric value.
      - Default to January (1).
    - `dateFormat`:
      - Options: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD.
      - Default selection: YYYY-MM-DD.
      - Show preview (e.g. "Preview: 2025-01-31").
    - `decimalSeparator` and `thousandsSeparator`:
      - Dropdowns with allowed options.
      - Default: DOT for decimals, COMMA for thousands (with preview like "1,234.56").
  - Validation:
    - Require base currency and fiscal year start month before allowing "Save & Continue".
  - Behavior:
    - Save/Update fields on `OrganizationSettings` via API route (e.g. `app/api/orgs/[orgId]/settings/financial/route.ts`).
    - "Save & Continue" moves to Category Setup step.
  - Additional: store user’s choices for future formatting usage (date & number).
  - Progress indicator: "Step 3 of 4 – Financial configuration".

  2.7 Implement Category Setup step (Step 4)

- New route, e.g. `app/onboarding/[orgSlug]/categories/page.tsx`:
  - On first visit:
    - Seed default categories for the organization via backend if not already seeded:
      - Income:
        - "General Income" (includeInPnL = true)
        - "Tax Collected" (includeInPnL = true or configurable)
        - "Owner Contributions" (includeInPnL = false)
        - "Transfers In" (includeInPnL = false)
      - Expense:
        - "General Expense" (includeInPnL = true)
        - "Tax Paid" (includeInPnL = true)
        - "Owner Drawings" (includeInPnL = false)
        - "Transfers Out" (includeInPnL = false)
    - Ensure at least one income and one expense category exist.
  - UI capabilities (scope-limited for milestone 1):
    - List categories (flat or simple parent/child without drag-and-drop).
    - Create/Edit form:
      - Fields: name, type (Income/Expense), optional parent, includeInPnL, optional color/icon.
    - For this milestone, skip drag-and-drop reordering and usage analytics; only allow simple CRUD where possible.
  - Validation:
    - Before finishing onboarding:
      - Check that at least one active income and one active expense category exist.
  - Backend:
    - API routes under `app/api/orgs/[orgId]/categories` for list/create/update.
    - Enforce org scoping and membership checks.

  2.8 Completing onboarding

- When user clicks "Finish" on Category step:
  - Mark organization as fully onboarded:
    - Set `Organization.onboardingComplete = true` (or similar).
  - Redirect to business dashboard: `/o/[orgSlug]/dashboard`.
- Ensure onboarding flows are mandatory:
  - For any request into `/o/[orgSlug]/...` for an org where onboarding not complete:
    - Redirect to the next incomplete onboarding step (business, financial, or categories).

  2.9 Routing guard for onboarding vs dashboard

- Add a server-side guard in:
  - `app/o/[orgSlug]/layout.tsx` or middleware logic that:
    - Fetches org + settings.
    - If `onboardingComplete` is false:
      - Redirect to appropriate onboarding route.
- Ensure superadmins can bypass for debugging if needed (optional).

---

3. Accounts & Categories management (post-onboarding, basic admin views)

3.1 Navigation: Business section

- Extend existing org dashboard shell:
  - Add "Business" or "Sololedger" section in org-scoped navigation with items:
    - "Dashboard" → `/o/[orgSlug]/dashboard`
    - "Transactions" → `/o/[orgSlug]/transactions`
    - "Accounts" → `/o/[orgSlug]/settings/accounts`
    - "Categories" → `/o/[orgSlug]/settings/categories`
- Ensure nav highlights based on current route.

  3.2 Accounts management UI

- Route: `app/o/[orgSlug]/settings/accounts/page.tsx`
- Server-side component fetching:
  - Use helper like `getCurrentUserAndOrg` to validate membership and role.
  - Only allow access for admins (Owners/Admins).
- Features:
  - List all accounts with columns: name, description, isDefault, active, createdAt.
  - Provide "New Account" button:
    - Open dialog or dedicated subpage for form (name, description, isDefault, active).
  - Edit account:
    - Use dialog or `/o/[orgSlug]/settings/accounts/[accountId]` page.
  - Enforce single default per business in application logic:
    - When setting an account’s `isDefault` to true, ensure all others get `isDefault = false` in the same transaction.
- Backend:
  - API routes under `app/api/orgs/[orgId]/accounts`:
    - `GET`: list accounts (admin only).
    - `POST`: create account (admin only).
    - `PATCH`: update account by id (admin only).
  - Use `scopeTenant` helper to ensure isolation.

  3.3 Categories management UI

- Route: `app/o/[orgSlug]/settings/categories/page.tsx`
- Access:
  - Owners/Admins and Members can manage categories per requirements:
    - Admins & Members: can add/edit/delete categories.
    - Enforce via `membership.role` check.
- Features (v1 scope):
  - List categories grouped by type (Income / Expense).
  - For now, simple list with parent category name in a column (no drag-and-drop).
  - Create/Edit forms:
    - Fields: name, type, parent (optional), includeInPnL, active, color, icon.
  - Soft behavior for delete (if implementing immediately):
    - If category has transactions, show a non-functional note for now OR implement minimal "set inactive" behavior.
    - Full replacement flow can be deferred but prepare API shape to support it later.
- Backend:
  - API routes: `app/api/orgs/[orgId]/categories`:
    - `GET`: list categories (all members).
    - `POST`: create category (members+admins).
    - `PATCH`: update category (members+admins).
  - Enforce type invariants and org scoping.

  3.4 Ensure “at least one income + one expense category”

- On:
  - Completing onboarding, and
  - Access to `/o/[orgSlug]/transactions`
- Add guard:
  - Check existence of at least one active income and one active expense category.
  - If missing:
    - Show a UI prompt on dashboard / transactions page to go to Categories settings.

---

4. Transactions page: manual entry & listing

4.1 Route and access

- Route: `app/o/[orgSlug]/transactions/page.tsx`
- Access control:
  - Owners/Admins and Members both allowed (per permissions).
  - Use `getCurrentUserAndOrg` and membership role.
- Load necessary data:
  - Organization `OrganizationSettings` (for baseCurrency and formats).
  - Active accounts and categories for selects.
- Decide UI pattern:
  - List view + inline creation form or top-of-page form.
  - Editing pattern per choice:
    - Use dedicated edit page: `/o/[orgSlug]/transactions/[id]/page.tsx`.

  4.2 Transaction creation form

- Fields:
  - Type: income/expense (`TransactionType`).
  - Amount (positive number).
  - Currency:
    - Default to base currency from `OrganizationSettings`.
    - Allow selecting another currency (small curated list + text input).
  - Date:
    - Use date picker, formatted according to `dateFormat`.
  - Description (text).
  - Category (dropdown filtered by type).
  - Account (dropdown).
  - Status: Draft / Posted (`TransactionStatus`).
  - Optional: vendorName, notes.
- Validation:
  - Amount > 0.
  - Date:
    - For Draft: allow future dates with a warning.
    - For Posted: block future dates (per choice).
  - Category type matches transaction type.
- FX behavior:
  - When currency == baseCurrency:
    - Set `exchangeRateToBase = 1.0`.
  - When currency != baseCurrency:
    - Require a numeric rate field:
      - Prefill 1.0 as a placeholder.
      - Allow override by user.
    - Calculate `amountBase = amountOriginal * exchangeRateToBase`.
  - For this milestone:
    - Do not call external FX APIs yet.
    - Keep design future-friendly to integrate automatic rates later.

  4.3 Backend: transaction CRUD API

- Routes: `app/api/orgs/[orgId]/transactions` + subroutes:
  - `GET`: list transactions with support for:
    - Date range filter.
    - Type filter.
    - Status filter.
    - Exclude `deletedAt` entries.
  - `POST`: create new transaction:
    - Validate all business rules.
    - Set `amountBase` based on `amountOriginal * exchangeRateToBase`.
    - Use `user.id` from session as `userId`.
  - `PATCH`/`PUT`: update existing transaction by id:
    - Allow editing all mutable fields.
    - Recalculate `amountBase` if amount, currency, or rate changed.
    - Enforce future date + categoryType/type rules.
  - `DELETE`: soft delete:
    - Set `deletedAt` instead of deleting row.
- All operations:
  - Scope by `organizationId`.
  - Enforce membership and role.

  4.4 List view UI

- Table showing non-deleted transactions for current filters:
  - Columns:
    - Date (formatted per `dateFormat`).
    - Description.
    - Type (Income/Expense).
    - Category.
    - Account.
    - `amountBase` with number formatting (currency, decimals, thousands).
    - Status badge (Draft / Posted).
  - Basic filters:
    - Date range (from–to).
    - Type (income/expense).
    - Status (draft/posted).
- Actions:
  - "Add Transaction" button opens create form (inline or separate).
  - Each row:
    - "Edit" → link to `/o/[orgSlug]/transactions/[id]`.
    - "Delete" → soft delete (set `deletedAt`).

  4.5 Edit transaction page

- Route: `app/o/[orgSlug]/transactions/[id]/page.tsx`
- Behavior:
  - Load transaction and related lists (accounts, categories).
  - Use same form component as create, pre-populated with values.
  - Enforce same validations:
    - Future date rule: allowed for Draft, blocked for Posted.
    - Category type matches transaction type.
  - Allow toggling Draft/Posted and adjusting amounts.

---

5. Business dashboard (per organization)

5.1 Route and access

- Route: `app/o/[orgSlug]/dashboard/page.tsx`
- Access:
  - Owners/Admins and Members.
  - Guard by `onboardingComplete` flag; redirect to onboarding if false.
- Data needed:
  - Organization and `OrganizationSettings` (baseCurrency, fiscalYearStartMonth).
  - YTD (Year-To-Date) range:
    - Compute based on fiscalYearStartMonth and current date.
  - Transactions:
    - Posted only (`status = POSTED`, `deletedAt IS NULL`) within YTD range.

  5.2 Metrics calculations

- YTD Income:
  - Sum of `amountBase` for Posted Income transactions where category.includeInPnL = true.
- YTD Expenses:
  - Sum of `amountBase` for Posted Expense transactions where category.includeInPnL = true.
- YTD Profit/Loss:
  - Income - Expenses.
- Account balances:
  - For each active account:
    - Income sum (Posted, not deleted) minus Expense sum in base currency.
    - For milestone 1:
      - All categories affect balances (ignore special owner/transfer P&L semantics for now).
- Recent activity:
  - Last 10–20 transactions (including both Draft and Posted).
  - Show type, category, account, amountBase, status.

  5.3 Dashboard UI

- Layout:
  - Top row cards:
    - "YTD Income"
    - "YTD Expenses"
    - "YTD Profit/Loss"
  - Section: "Accounts"
    - Table of accounts with current balances.
  - Section: "Recent activity"
    - Table of last 10–20 transactions, with status badges and quick "Edit" link.
- Scope:
  - For this milestone, omit charts (Income vs Expense by month, category breakdown) or include minimal placeholder summary; full charting can be phase 2.

---

6. Permissions & UX polish

6.1 Role-based behavior (per org)

- Reuse existing `Membership` roles:
  - Treat `role = "admin"` as Owner/Admin equivalent for that business.
  - `role = "member"` as Member.
- Enforce:
  - Owners/Admins:
    - Full access to everything within that business (settings, accounts, categories, transactions).
  - Members:
    - Can view dashboard & reports.
    - Can create/edit/delete transactions.
    - Can manage categories (per requirements).
    - Cannot manage accounts.
    - Cannot change core business financial settings (base currency, fiscal year, tax settings).
- Implementation:
  - For each API route and page:
    - Use `getCurrentUserAndOrg` to get user, org, membership.
    - Add helpers:
      - `requireOrgAdmin` (admin only).
      - `requireOrgMember` (member or admin).
    - Apply correct helper depending on endpoint.

  6.2 Onboarding gating UX

- Ensure that users:
  - After creating a new business:
    - Are redirected into onboarding steps 2–4 and cannot access `/o/[orgSlug]/dashboard`, `/transactions`, etc. until `onboardingComplete` is true.
  - After completing onboarding:
    - Land on `/o/[orgSlug]/dashboard`.
  - When switching businesses:
    - If another business is not yet fully onboarded, redirect them into its incomplete step.

  6.3 Wording and UI copy

- Replace "Workspace" with "Business" in user-facing copy wherever relevant:
  - Onboarding pages.
  - Dashboard headings.
  - Navigation labels.
- Keep internal code using "organization" naming for models, types, and paths.

  6.4 Hiding unrelated boilerplate sections

- In the main org navigation:
  - De-emphasize or hide admin/AI/integrations sections for standard Sololedger flows.
  - Keep them available for superadmin/system-level operations if needed.
- Optionally:
  - Show a "Sololedger" or "Business" primary section first in the sidebar for clarity.

---

7. Cross-cutting concerns & future readiness

7.1 Formatting utilities

- Implement reusable formatting helpers (server-side / shared):
  - Date formatting based on `OrganizationSettings.dateFormat`.
  - Number formatting with decimal & thousands separators from settings.
- Apply these in:
  - Transactions list.
  - Dashboard cards and tables.

  7.2 Audit logging (future)

- For this milestone:
  - Optionally log key events related to Sololedger to existing `AuditLog` or plan a dedicated activity log model later.
- Keep code structured such that adding a detailed activity log (Section 16) is straightforward:
  - Wrap critical operations (create/update/delete transaction, change business settings) into helper functions where logging can be added later.

  7.3 Vendors, documents, AI, imports, reporting

- Keep model and UI designs open for:
  - Vendors:
    - For now, store `vendorName` string on `Transaction`, but design in a way that a `Vendor` model can be introduced later without breaking.
  - Documents & AI processing:
    - Ensure `Transaction` has clear identifier and relations so linking documents is easy later.
  - Imports and exports:
    - Design transaction API to support bulk operations in future.
  - Reporting:
    - P&L and other reports can be built on top of `Transaction.amountBase`, category type, `includeInPnL`, and `OrganizationSettings` fiscal year configuration.

---
