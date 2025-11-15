In summary, we’ll evolve the current “vendor” concept into two parallel relationship types—clients (for income) and vendors (for expenses)—by updating the data model, APIs, and UI so each transaction clearly links to the correct relationship type, while keeping existing data stable and migration‑friendly. We’ll also introduce separate screens and filters for clients and vendors, and adjust reporting to use clients for income and vendors for expenses.

---

## Phase 1 – Data Model & Migrations

- **1.1 Add `Client` model (separate from `Vendor`)**
  - In `prisma/schema.prisma`, add:
    - `Client` with fields mirroring `Vendor`:
      - `id`, `organizationId`, `name`, `nameLower`, `email`, `phone`, `notes`, `active`, `mergedIntoId`, `createdAt`, `updatedAt`.
      - Relations:
        - `organization: Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)`
        - `mergedInto: Client? @relation("ClientMerge", fields: [mergedIntoId], references: [id], onDelete: SetNull)`
        - `mergedClients: Client[] @relation("ClientMerge")`
        - `transactions: Transaction[]`
    - Add `clients: Client[]` relation on `Organization`.
    - Add `@@unique([organizationId, nameLower])` and `@@index([organizationId, active])` on `Client`.
  - Run Prisma migration later (once plan is locked) and regenerate client.

- **1.2 Extend `Transaction` for clients**
  - In `Transaction` model:
    - Add:
      - `clientId String?`
      - `clientName String? @db.VarChar(255)`
    - Add relation:
      - `client Client? @relation(fields: [clientId], references: [id], onDelete: SetNull)`
    - Add indexes:
      - `@@index([organizationId, clientId, status, date])`
      - `@@index([clientId])`
  - Keep `vendorId`/`vendorName` as is for backward compatibility.

- **1.3 Backfill existing income data to clients (7/b + 2/a)**
  - Implement a backfill script (e.g., in `scripts/` or as part of a dedicated migration) that:
    - For each organization:
      - Find distinct `INCOME` transactions with non‑null `vendorName` or `vendorId` and `deletedAt IS NULL`.
      - For each distinct vendor name used on income:
        - Compute `nameLower = vendorName.toLowerCase().trim()`.
        - Check if a `Client` with `organizationId` + `nameLower` already exists.
          - If yes: reuse that `Client`.
          - If no:
            - If a `Vendor` with that `nameLower` exists in the org, create a `Client` with:
              - `name`, `nameLower`, and copy `email`, `phone`, `notes` where available.
            - Otherwise create a minimal `Client` with `name`/`nameLower`.
      - For each affected income transaction:
        - Set `clientId` to the mapped client’s id and `clientName` to the human name.
  - Do **not** clear `vendorId`/`vendorName` for income yet; keep them populated for legacy/debugging, but they won’t be used by new logic.

- **1.4 Migration rollout order**
  1.  Add `Client` model and `clientId`/`clientName` fields + relations/indexes on `Transaction`.
  2.  Run backfill to populate `Client` records and link `INCOME` transactions to clients.
  3.  Only after this, update API and UI to start using `clientId`/`clientName` for income and stop accepting vendors for income.

---

## Phase 2 – API Layer Changes (Strict Per-Type Behavior)

- **2.1 Client endpoints**
  - Create `app/api/orgs/[orgSlug]/clients` route group with:
    - `GET /api/orgs/[orgSlug]/clients`:
      - Query params: `query` for name/email search.
      - Filters by `organizationId` and `active = true` by default.
      - Returns `clients: Client[]`.
    - `POST /api/orgs/[orgSlug]/clients`:
      - Body: `name`, optional `email`, `phone`, `notes`.
      - Enforces org uniqueness via `nameLower`.
    - Optionally `PATCH`/`DELETE` or `PATCH` to toggle `active`.
  - All endpoints:
    - `export const runtime = "nodejs"`.
    - Use `getCurrentUser`, `getOrgBySlug`, `requireMembership`, and `validateCsrf` (for mutating routes).
    - Enforce `organizationId` scoping.

- **2.2 Vendor endpoints review**
  - Ensure existing `/api/orgs/[orgSlug]/vendors` route:
    - Supports `GET` with `query` for name search using `nameLower`.
    - Filters by `organizationId` and `active`.
  - Clarify in comments: vendors are for expenses only.

- **2.3 Transaction list endpoint (`app/api/orgs/[orgSlug]/transactions/route.ts`)**
  - `GET`:
    - Update `include` to:
      - `include: { category: true, account: true, vendor: true, client: true }`.
    - Add new optional query params:
      - `clientId` → filter transactions where `clientId = clientId`.
      - `vendorId` → filter where `vendorId = vendorId`.
    - Keep existing `type`, `status`, `dateFrom`, `dateTo` filtering.
    - In future you can add a `counterparty` param for name search across client/vendor.

- **2.4 Transaction create endpoint (`POST /transactions`)**
  - Update Zod schema:

    ```ts
    const transactionSchema = z.object({
      type: z.enum(["INCOME", "EXPENSE"]),
      status: z.enum(["DRAFT", "POSTED"]),
      amountOriginal: z.number().positive(),
      currencyOriginal: z
        .string()
        .length(3)
        .transform((v) => v.toUpperCase()),
      exchangeRateToBase: z.number().positive(),
      date: z
        .string()
        .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid date" }),
      description: z.string().min(1),
      categoryId: z.string().min(1),
      accountId: z.string().min(1),

      vendorId: z.string().nullable().optional(),
      vendorName: z.string().nullable().optional(),
      clientId: z.string().nullable().optional(),
      clientName: z.string().nullable().optional(),

      notes: z.string().nullable().optional(),
    });
    ```

  - Enforce strict rules (3/a) after parsing:
    - If `type === "INCOME"`:
      - Reject if `vendorId` or `vendorName` is non‑null/non‑undefined.
      - Allow `clientId`/`clientName`.
    - If `type === "EXPENSE"`:
      - Reject if `clientId` or `clientName` is non‑null/non‑undefined.
      - Allow `vendorId`/`vendorName`.
  - Relationship handling:
    - For `INCOME`:
      - If `clientId` present:
        - Verify `Client` exists with `id` and `organizationId = org.id`.
        - If not, 400 "Client not found".
      - Else if `clientName` present (non‑empty after trim):
        - Compute `nameLower`.
        - Look up existing `Client` by `organizationId` + `nameLower`.
        - If not found, create a new `Client` (active = true).
      - Set `clientId`/`clientName` on `Transaction`, and `vendorId`/`vendorName` to `null`.
    - For `EXPENSE` (existing logic, but explicitly scoped as expense):
      - Same flow with `Vendor` and `vendorId`/`vendorName`.
      - Ensure `clientId`/`clientName` are `null`.
  - Keep existing validations:
    - Category existence + type matches transaction type.
    - Account existence.
    - Date rules for POSTED vs future date.
  - Compute `amountBase = amountOriginal * exchangeRateToBase` as before.

- **2.5 Transaction update endpoint (`PATCH /transactions/[transactionId]`)**
  - Extend Zod schema to optional `clientId` / `clientName` alongside vendor fields.
  - Apply type edit rule (9/b):
    - Either:
      - Disallow changing `type` in PATCH entirely, or
      - If `data.type` differs from `existing.type` and there is any of:
        - `existing.vendorId`, `existing.vendorName`, `existing.clientId`, or `existing.clientName`,
      - Then reject with 400: "Cannot change transaction type once a client/vendor is set; delete and recreate the transaction."
  - Enforce strict per-type relationship rules (3/a):
    - Determine `finalType = data.type ?? existing.type`.
    - If `finalType === "INCOME"`:
      - Reject if `vendorId` or `vendorName` is present in payload (even if nulling).
      - Allow `clientId`/`clientName`:
        - If `clientId` is explicitly provided:
          - Null → clear client.
          - Non‑null → verify `Client` in org.
        - Else if `clientName` provided:
          - Non‑empty → lookup or create `Client` by `nameLower` (like POST).
          - Empty → clear client.
    - If `finalType === "EXPENSE"`:
      - Mirror logic for vendor, rejecting `clientId`/`clientName`.
  - Keep amount/base recalculation as now when `amountOriginal` or `exchangeRateToBase` changes.

- **2.6 Single transaction GET (`GET /transactions/[transactionId]`)**
  - Update `include` to `{ category: true, account: true, vendor: true, client: true }`.
  - Ensure returned JSON includes `clientId`, `clientName` for income transactions.

---

## Phase 3 – UI & Form Behavior

- **3.1 Update `TransactionForm` (`components/features/transactions/transaction-form.tsx`)**
  - Types:
    - Extend `TransactionData` interface with:
      - `clientName?: string;`
      - (Optionally) `clientId?: string;` if you want to pass it down.
  - Component state:
    - Add:
      - `const [clientName, setClientName] = React.useState<string>(initialData?.clientName || "");`
      - `const [clientId, setClientId] = React.useState<string | null>(null);`
    - Keep separate `vendorName` / `vendorId`.
  - Type change behavior:
    - In `onValueChange` of `RadioGroup`:
      - When switching from `INCOME` → `EXPENSE`:
        - Optionally clear `clientName` and `clientId`.
      - When switching from `EXPENSE` → `INCOME`:
        - Optionally clear `vendorName` and `vendorId`.
    - If you enforce 9/b strictly on the backend, consider:
      - Disabling the type toggle for existing transactions (edit mode) if a client/vendor is set.
      - Or warn the user they must delete & recreate to change type.
  - Relationship input (dynamic, per type):
    - When `type === "INCOME"`:
      - Render a combobox labelled "Client (optional)" or required depending on your preference.
      - Behavior:
        - `CommandInput` bound to `clientName` and calling `searchClients(query)` that hits `/api/orgs/${orgSlug}/clients?query=...`.
        - Selecting a result sets `clientName` + `clientId`.
        - If pressing Enter with no suggestions:
          - Treat as "create" new client implicitly; `clientName` goes to backend for lookup/create.
    - When `type === "EXPENSE"`:
      - Keep the existing vendor combobox behavior with `/vendors` endpoint and `vendorName`/`vendorId`.
  - Submit payload:
    - In `handleSubmit`, build the body as:
      - For `INCOME`:
        - `clientName: clientName || null`, `clientId: clientId || null`.
        - `vendorName: null`, `vendorId: null` (or omit).
      - For `EXPENSE`:
        - `vendorName: vendorName || null`, `vendorId: vendorId || null`.
        - `clientName: null`, `clientId: null`.
    - Everything else stays as is.

- **3.2 `NewTransactionPage` (`app/o/[orgSlug]/transactions/new/page.tsx`)**
  - No structural changes needed beyond:
    - Passing through unchanged props; `TransactionForm` will handle client vs vendor field.
    - Updating copy text if desired: "Create a new income or expense transaction with a client or vendor."

- **3.3 `EditTransactionPage` (`app/o/[orgSlug]/transactions/[id]/page.tsx`)**
  - When loading a transaction:
    - Include `clientName` in the shape passed to `TransactionForm`:
      - For income: `clientName: transactionData.transaction.clientName`.
      - For expenses: `vendorName` as currently.
    - Optionally pass `clientId` if you include it in the GET response.
  - If implementing strict rule 9/b:
    - Disable the type radio group when editing an existing transaction.
    - Show a helper text: "To change type, delete and recreate the transaction."

- **3.4 `TransactionsPage` (`app/o/[orgSlug]/transactions/page.tsx`)**
  - Extend `Transaction` interface:
    - Add optional `client?: { id: string; name: string } | null;`
    - Keep `vendor` as is.
  - Display:
    - In the secondary text (where you show date • category • account):
      - Optionally append:
        - For `INCOME`: `• clientName or client?.name`.
        - For `EXPENSE`: `• vendorName or vendor?.name`.
  - Filters (option 6/b):
    - Add two new filter controls:
      - "Client" select/combobox (for income):
        - Fetch clients via `/clients` or from a small cached list.
        - Store selected `clientId` in state.
      - "Vendor" select/combobox (for expenses).
    - Query string:
      - Append `clientId` and/or `vendorId` to `URLSearchParams` when loading.
    - Backend:
      - Use new `clientId`/`vendorId` filters in transactions GET.

---

## Phase 4 – Client & Vendor Management Screens (Option 5/b)

- **4.1 Clients screen**
  - Add new page, e.g. `app/o/[orgSlug]/clients/page.tsx` (or under settings if you prefer).
  - Features:
    - List all clients for org, with pagination if needed.
    - Columns: name, email, phone, status (active/inactive), created date.
    - Search box hitting `/clients?query=...`.
    - Toggle `active` via PATCH.
    - Optional merge UI if/when you implement `mergedInto` logic.
  - Navigation:
    - Add a `Clients` item in your sidebar/menu at roughly the same level as `Vendors` (or wherever vendors live).

- **4.2 Review/align Vendors screen**
  - Ensure vendor management page (if exists):
    - Mirrors the clients UI in layout and capabilities.
    - Clarifies that vendors are for expenses.

---

## Phase 5 – Reporting & Index Preparation (Option 8/a)

- **5.1 DB indexes for reporting**
  - Confirm indexes on:
    - `Transaction(organizationId, clientId, status, date)`
    - `Transaction(organizationId, vendorId, status, date)`
  - These support:
    - "Income by Client" reports.
    - "Expenses by Vendor" reports.

- **5.2 Reporting routes (future)**
  - In a future iteration, add APIs like:
    - `GET /api/orgs/[orgSlug]/reports/income-by-client`
    - `GET /api/orgs/[orgSlug]/reports/expenses-by-vendor`
  - Each groups by `clientId` or `vendorId` and sums `amountBase` over a date range.

---

## Phase 6 – Validation, Testing & Rollout

- **6.1 Validation rules summary**
  - Server (strict, per 3/a & 9/b):
    - `INCOME`:
      - Accept and handle `clientId`/`clientName`.
      - Reject `vendorId`/`vendorName`.
      - Optionally disallow changing `type` once client/vendor set.
    - `EXPENSE`:
      - Accept and handle `vendorId`/`vendorName`.
      - Reject `clientId`/`clientName`.
    - Category type must match transaction type; account must belong to org.
  - UI:
    - Only show the appropriate field (client or vendor) based on `type`.
    - Disable type changes on edit if backend disallows.

- **6.2 Testing scenarios**
  - Unit/integration tests:
    - Create income with new `clientName`:
      - Client auto‑created; transaction links to client.
    - Create expense with new `vendorName`: existing behavior unchanged.
    - Update income to change client:
      - New client auto‑created or existing reused.
    - Attempt to send vendor on income or client on expense:
      - Expect 400 error.
    - Backfilled income transactions:
      - Confirm they have `clientId`/`clientName` correctly set and still have legacy vendor fields populated.
  - Manual QA:
    - Create & edit income/expense transactions, verifying:
      - Correct field appears (client vs vendor).
      - Lists and filters reflect chosen contact.
      - Clients/Vendors screens show created records.
