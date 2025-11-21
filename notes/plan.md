## CSV Import, Export & Backup – Implementation Plan

This plan implements a two-step, server-validated CSV import flow (preview → commit) plus a per-business full-data backup/export (JSON and multi-CSV ZIP), wired into the existing transactions page and respecting your decisions: import entrypoint on the transactions list, members allowed to import but only admins can back up, dual type detection (column vs sign), auto-creating vendors/clients only, org-scoped mapping templates, duplicate detection based on secondary/original amounts where present, CSV backups as ZIPs of multiple entity files, and document references limited to metadata/links.

### 1. Data & Domain Changes

- Add a `CsvImportTemplate` model in `prisma/schema.prisma`:
  - Fields: `id`, `organizationId`, `name`, `config` (Json), `createdByUserId`, `createdAt`, `updatedAt`.
  - Relations: `organization` → `Organization`, `createdBy` → `User`.
  - Uniqueness: `@@unique([organizationId, name])` so templates are org-scoped and shared across members.
  - `config` stores:
    - Column-to-field mapping (e.g. `date`, `amount`, `currency`, `description`, `type`, `vendor`, `client`, `category`, `account`, `notes`, `tags`, `secondaryAmount`, `secondaryCurrency`).
    - Parsing options: delimiter, header row index, header presence, date format, number format, direction mode (type column vs sign-based).

### 2. CSV Import Backend – Core Helpers

- Create a server-only helper module, e.g. `lib/import/transactions-csv.ts`:
  - CSV parsing:
    - Input: CSV `Buffer` or stream, delimiter, header row index, whether file has headers.
    - Use a Node CSV parser (e.g. `csv-parse` or `fast-csv`), Node runtime only.
    - Output: `{ headers: string[]; rows: string[][] }`.
  - Mapping application:
    - Given headers, rows, and mapping config, derive `RawImportRow` objects:
      - `rowIndex`, `raw` (original cells), and a candidate DTO with:
        - `directionSource` (`type` column vs `sign` mode).
        - `amountRaw`, `currencyRaw`, optional `secondaryAmountRaw`/`secondaryCurrencyRaw`.
        - `description`, `dateRaw`, `categoryName`, `accountName`, `vendorName`, `clientName`, `notes`, `tagsRaw`.
  - Normalization & validation:
    - Implement a Zod schema mirroring the dual-currency transaction POST schema:
      - Parse dates using the selected format (default from `OrganizationSettings.dateFormat`).
      - Normalize numbers using `decimalSeparator` / `thousandsSeparator` from `OrganizationSettings`, unless overridden.
      - Enforce:
        - Amount > 0 (after taking absolute value if using sign-based direction).
        - Both secondary amount and currency together or neither.
        - Valid ISO 4217 currency codes via `isValidCurrencyCode`.
    - Direction resolution (3/c):
      - Mode “Type column”: require mapped type column; coerce to `INCOME`/`EXPENSE`.
      - Mode “Sign-based”: infer type from sign; use absolute amount for stored values.
      - If both are present, optionally validate and mark row invalid on conflict.
    - Category & account resolution:
      - Lookup `Category` and `Account` by org + name (case-insensitive).
      - If not found or wrong org, mark the row invalid with a clear error.
    - Vendor/client resolution (4/b):
      - For INCOME:
        - Use client fields; if `clientName` exists and `clientId` is absent, find-or-create `Client` by lowercased name.
      - For EXPENSE:
        - Analogous behavior for `Vendor`.
    - Tag handling (optional):
      - If a Tags column is mapped, split on `;` and pass values through `sanitizeTagNames` and `upsertTagsForOrg` if tag import is enabled.
  - Legacy fields:
    - Compute `amountBase`/`currencyBase` and optional `amountSecondary`/`currencySecondary` as in the dual-currency model.
    - Derive `amountOriginal`, `currencyOriginal`, `exchangeRateToBase` using the same rules as the existing POST handler.
  - Validation result:
    - For each row, return:
      - `rowIndex`.
      - A normalized transaction DTO ready for `db.transaction.create`.
      - Status: `valid` or `invalid`.
      - `errors: string[]` for invalid rows.

### 3. Duplicate Detection Logic

- In `lib/import/transactions-csv.ts`, add duplicate detection utilities:
  - For each valid row, prefer secondary/original values (6/b):
    - If `amountSecondary` & `currencySecondary` present:
      - Use `(amountSecondary, currencySecondary, date, vendorName/description)` as primary match keys.
    - Else fall back to base:
      - Use `(amountBase, baseCurrency, date, vendorName/description)`.
  - Duplicate rules (per org, non-deleted only):
    - Condition A:
      - Same date, same normalized amount (within epsilon), and same vendor (by resolved `vendorId` or vendorName).
    - Condition B:
      - Same normalized amount and identical description (case-insensitive, trimmed) within a ±2 day window around the import date.
  - Implementation notes:
    - Avoid one-query-per-row by:
      - Computing overall date range for the file.
      - Pre-fetching candidate transactions for that range and relevant amount buckets.
      - Doing fine-grained comparisons in memory.
  - For each row, attach:
    - `duplicateMatches: { transactionId, date, amount, currency, description, vendorName }[]` (capped to a small number).
    - `isDuplicateCandidate: boolean`.

### 4. Import APIs (Stateless Two-Step Flow)

- Preview route: `app/api/orgs/[orgSlug]/transactions/import/preview/route.ts`:
  - `export const runtime = "nodejs"`.
  - Method: `POST`.
  - Auth:
    - Use `getCurrentUser`, `getOrgBySlug`, `requireMembership`, and `validateApiKeyOrgAccess`.
    - Allow members and admins (2/b).
  - Input:
    - `multipart/form-data`:
      - `file`: CSV file.
      - `mappingConfig`: JSON string with mapping, formats, direction mode, or a template ID.
  - Flow:
    - Load `OrganizationSettings` (base currency, date/number formats).
    - Resolve mappingConfig:
      - If template ID provided, load `CsvImportTemplate.config` and merge overrides.
    - Parse CSV to headers/rows.
    - Apply mapping + normalization to produce `NormalizedImportRow[]`.
    - Run validation and duplicate detection.
    - Response:
      - `headers`.
      - `previewRows`: first N rows with raw values, normalized values, status, errors, duplicate summary.
      - `summary`: total rows, valid count, invalid count, duplicate candidate count.
      - `duplicateRowIndexes` and a compact map of duplicate match metadata.
    - No import-side DB writes yet, except reads (and optional tag/vendor/client upserts if you choose to do them in preview).

- Commit route: `app/api/orgs/[orgSlug]/transactions/import/commit/route.ts`:
  - `export const runtime = "nodejs"`.
  - Method: `POST`.
  - Auth & permissions: same as preview.
  - Input:
    - `multipart/form-data`:
      - `file`: the CSV file (wizard re-sends the same `File`).
      - `mappingConfig`: same configuration as preview.
      - `decisions`: JSON mapping `rowIndex → "import" | "skip"` for duplicate rows.
  - Flow:
    - Re-run the same parsing/mapping/validation/duplicate detection pipeline (stateless design, 9/a).
    - For each row:
      - If invalid → always skip (counted as invalid).
      - If `isDuplicateCandidate`:
        - Check `decisions[rowIndex]`:
          - `"skip"` → skip as duplicate.
          - `"import"` → treat as valid import.
          - Missing → default to `"skip"` for safety.
      - Else if valid and not duplicate → import.
    - Import execution:
      - For rows to import, create transactions via Prisma:
        - Reuse logic from POST `/transactions` for:
          - Vendor/client auto-creation.
          - Category/account org validation.
          - Dual-currency and legacy field computation.
          - Tag upsertion if tags are imported.
      - Use reasonable batch sizes to avoid long-running transactions.
    - Response:
      - `{ importedCount, skippedInvalidCount, skippedDuplicateCount, totalRows }`.
    - Audit:
      - Create an `AuditLog` entry with `action: "transaction_import_commit"`, `organizationId`, `userId`, and counts.

- Mapping templates route: `app/api/orgs/[orgSlug]/transactions/import-templates/route.ts`:
  - `GET`: list templates for org (id, name, createdAt).
  - `POST`: create a template with a unique name per org (5/a).
  - `DELETE`: delete a template by ID.
  - Permissions: members and admins of the org can manage templates.

### 5. CSV Import UI – Transactions Page Wizard

- Entry point (1/a):
  - In `app/o/[orgSlug]/transactions/page.tsx`, add an “Import CSV” button in the header or actions bar (near bulk actions / Export CSV).
  - Clicking opens a client-side wizard.

- Wizard component: `components/features/import/transactions-import-wizard.tsx`:
  - Props:
    - `orgSlug`.
    - `onImportCompleted` (callback to refresh the list).
  - State:
    - `file: File | null`.
    - `step: "upload" | "mapping" | "review"`.
    - `mappingConfig`.
    - `selectedTemplateId`, `templates` (loaded via import-templates API).
    - `previewRows`, `summary`, `duplicateRowIndexes`.
    - `duplicateDecisions: Record<number, "import" | "skip">`.

- Step 1 – Upload & options:
  - Dialog UI modeled on `transaction-documents-panel`:
    - File picker (accept `.csv`).
    - Direction mode selector:
      - “Use Type column (INCOME/EXPENSE)” vs “Infer from sign (positive/negative)”.
    - Date format selector (default from org).
    - Optional delimiter input if needed.
    - Template dropdown:
      - Load templates and allow user to pre-fill mapping settings.
  - Actions:
    - “Continue”:
      - If mapping already known (template), call `/transactions/import/preview`.
      - Otherwise move to mapping step.

- Step 2 – Mapping:
  - Show detected CSV headers and samples.
  - For each Sololedger field:
    - Provide a dropdown bound to headers plus “Not mapped”.
    - Required: Date, Amount, Type (if in type-column mode), Currency, Description, Category, Account.
    - Optional: Vendor, Client, Notes, Tags, Secondary Amount, Secondary Currency.
  - Validation hints:
    - Inline messages when required fields are unmapped.
  - Actions:
    - “Preview import”:
      - Posts file + mappingConfig to `/transactions/import/preview`.
      - Stores `previewRows`, `summary`, `duplicateRowIndexes`, then advances to review.
    - “Save as template”:
      - Calls import-templates `POST` with the current mappingConfig and a user-provided name.

- Step 3 – Review & duplicates:
  - Summary header:
    - `totalRows`, `validRows`, `invalidRows`, `duplicateCandidates`.
  - Table (paginated):
    - Columns: Row #, Date, Description, Amount(s), Category, Account, Vendor/Client, Status, Errors.
    - Status:
      - “Valid”.
      - “Invalid” with error tooltip or inline message.
      - “Possible duplicate” for duplicate candidates.
  - Duplicate handling:
    - For each duplicate candidate row:
      - Show a small panel or tooltip summarizing the matched existing transaction (date, amount, vendor/description).
      - Present two options (2/b, 6/b semantics):
        - “Import anyway (keep both)”.
        - “Skip imported row”.
      - Persist choice in `duplicateDecisions`.
  - Actions:
    - “Import N rows” (where N is computed from current decisions):
      - Sends file + mappingConfig + `duplicateDecisions` to `/transactions/import/commit`.
      - Shows a progress indicator while in flight.
      - On success:
        - Show a toast summarizing imported/skipped counts.
        - Close wizard and trigger `onImportCompleted` to reload the transaction list.

### 6. Full Data Export & Backup – Backend

- Helper: `lib/backup-export.ts`:
  - Input:
    - `organizationId`.
    - Options: `{ format: "json" | "csv"; includeDocumentReferences: boolean; dateFrom?: Date; dateTo?: Date }`.
  - Common queries:
    - `OrganizationSettings` for org.
    - `Account`, `Category`, `Vendor`, `Client`, `Tag`.
    - `Transaction` with:
      - `account`, `category`, `vendor`, `client`, `transactionTags`, and `documents` via `TransactionDocument`.
      - Optional date range filter on `date` if provided.
    - If `includeDocumentReferences`:
      - `Document` metadata.
      - `TransactionDocument` join rows.
  - JSON export:
    - Build an object:
      - `{ settings, accounts, categories, vendors, clients, tags, transactions, transactionTags, transactionDocuments, documents? }`.
  - CSV/ZIP export (7/a, 8/a):
    - Generate per-entity CSV files:
      - `accounts.csv`, `categories.csv`, `vendors.csv`, `clients.csv`, `tags.csv`, `transactions.csv`, `transaction_tags.csv`, `transaction_documents.csv`, `documents.csv` (if requested).
    - For `transactions.csv`, reuse `generateTransactionsCsv` or replicate its logic/headers.
    - Use a Node ZIP library to bundle into a single ZIP buffer.

- Backup export API: `app/api/orgs/[orgSlug]/backup/export/route.ts`:
  - `export const runtime = "nodejs"`.
  - Method: `POST`.
  - Auth:
    - Use `getCurrentUser`, `getOrgBySlug`, `requireMembership`, `validateApiKeyOrgAccess`.
    - Only allow org admins and superadmins to export full backups (2/b).
  - Input JSON:
    - `{ format: "json" | "csv"; includeDocumentReferences: boolean; dateFrom?: string; dateTo?: string }`.
  - Flow:
    - Parse and validate input.
    - Call `backup-export` helper.
    - For JSON:
      - Return with `Content-Type: application/json` and `Content-Disposition` `attachment; filename="sololedger-backup-<orgSlug>-<date>.json"`.
    - For CSV:
      - Return ZIP with `Content-Type: application/zip` and `Content-Disposition` `attachment; filename="sololedger-backup-<orgSlug>-<date>.zip"`.
    - Log an `AuditLog` entry: `action: "org_backup_export"` plus format/options in `metadata`.

### 7. Full Data Export & Backup – UI

- Location:
  - Add a “Data Export & Backup” section under org-level Business Settings.
  - Server component fetches `orgSlug`, org, membership, and determines `isAdmin` as in `reports/page.tsx`.

- UI component: `components/features/settings/data-backup-panel.tsx`:
  - Props: `orgSlug`, `isAdmin`.
  - Content:
    - Brief description of what’s included and intended use (accountant, off-site backup).
  - Controls:
    - Format selector: JSON vs CSV (ZIP of multiple CSVs).
    - Checkbox: “Include document references (metadata & links)”.
    - Optional: date range filter for transactions (while always exporting full master data).
  - Actions:
    - “Download backup” button:
      - Posts to `/api/orgs/${orgSlug}/backup/export`.
      - Reads response as blob and triggers download (pattern from `TransactionsExport`).
      - Shows success/error toasts.
  - Permissions:
    - If `!isAdmin`, show a notice and disable the button or hide the panel entirely.

### 8. Permissions, Auditing & Cross-Cutting Concerns

- Permissions:
  - CSV import:
    - Members and admins can preview and commit imports for their org.
  - Backup export:
    - Only admins and superadmins can run full data backups.
- Auditing:
  - Use `AuditLog` to record:
    - Import commits: `transaction_import_commit` with counts and filename.
    - Backups: `org_backup_export` with format, date range, and `includeDocumentReferences`.
- CSRF:
  - Apply `validateCsrf` to import/commit routes when using cookie sessions.
  - Exempt API-key authenticated calls, consistent with existing API behavior.
- Performance:
  - For large CSVs:
    - Limit preview to first N rows while still using the full row set for summary/duplicate analysis.
    - Process imports in batches during commit.

### 9. Testing Strategy

- Unit tests:
  - `lib/import/transactions-csv.ts`:
    - CSV parsing with different delimiters and headers.
    - Mapping and normalization for multiple date/number formats.
    - Direction mode behavior (type column vs sign-based).
    - Validation of required fields and currencies.
    - Duplicate detection for both secondary and base-only scenarios.
  - `lib/backup-export.ts`:
    - JSON structure correctness for each entity.
    - CSV headers and rows for each generated file.
- Integration tests:
  - `import/preview`:
    - Valid imports with and without duplicates.
    - Handling of missing mappings and invalid data.
  - `import/commit`:
    - Correct counts for imported vs skipped rows.
    - Respect of duplicate decisions.
    - Enforcement of category/account/type rules.
  - `backup/export`:
    - Admin can download JSON and ZIP; member is forbidden.
    - `includeDocumentReferences` toggles document-related CSV/JSON content correctly.
