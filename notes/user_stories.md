## 1. Multi-Business / Organization Management

### US-ORG-001 – Create a new business

**As** a solopreneur
**I want** to create a new business ledger
**So that** I can track finances separately for each business I run

**Acceptance Criteria**

-   [ ] From the “business switcher”, user can click “Create new business”.
-   [ ] User is taken into the onboarding flow for that new business.
-   [ ] A newly created business appears in the business switcher list after onboarding starts.
-   [ ] Switching businesses clearly updates the logo/name and all views (dashboard, transactions, etc.).
-   [ ] Data from different businesses never appears mixed in any list or report.

---

## 2. Onboarding & Business Setup

### US-ONB-001 – Complete business details step

**As** a new user
**I want** to enter basic business details
**So that** Sololedger can personalise my reports and headers

**Acceptance Criteria**

-   [ ] Business name is required; if blank, user sees a clear validation message and cannot continue.
-   [ ] Business type is required; user must select one option or “Other”.
-   [ ] If “Other” is selected, a free-text field appears and is required.
-   [ ] Optional fields (address, phone, email, tax ID) can be left blank without blocking progress.
-   [ ] Progress indicator shows this step as completed once validations pass.

### US-ONB-002 – Configure financial settings during onboarding

**As** a business owner
**I want** to set base currency, fiscal year, and formats
**So that** my reports match my local accounting practices

**Acceptance Criteria**

-   [ ] User must choose a base currency before continuing; default is based on locale but still changeable.
-   [ ] User must choose a fiscal year start month; default is January.
-   [ ] User can pick a date format from a predefined list; selection immediately previews formatting.
-   [ ] User can pick number format (thousands and decimal separators) with a preview.
-   [ ] User cannot finish onboarding without base currency and fiscal year set.

### US-ONB-003 – Complete category setup

**As** a business owner
**I want** default categories with the option to customize
**So that** I can start quickly but still adapt to my business

**Acceptance Criteria**

-   [ ] On first load, default income and expense categories are visible (with at least one of each).
-   [ ] User can add new categories (name + type) and they appear in the list immediately.
-   [ ] User can delete a category that has no transactions (no reassignment needed during onboarding).
-   [ ] User can assign a color and icon to each category.
-   [ ] User cannot finish onboarding until at least one income and one expense category exist.

---

## 3. Business Settings (Post-Onboarding)

### US-SET-001 – Update business information

**As** an owner
**I want** to update my business details
**So that** my reports stay accurate if my information changes

**Acceptance Criteria**

-   [ ] Business info screen shows current name, type, address, phone, email, tax ID.
-   [ ] Owner/Admin can edit any field and save.
-   [ ] Changing business name updates it everywhere (dashboard, header, report exports).
-   [ ] Members cannot edit these fields; they see them as read-only.

### US-SET-002 – Change base currency with warning

**As** an owner
**I want** to change base currency
**So that** I can realign my reporting if my primary currency changes

**Acceptance Criteria**

-   [ ] Only Owner/Admin sees the “Change base currency” control.
-   [ ] When changing, a warning explains that historical reports will be recalculated.
-   [ ] User must confirm with an explicit action (e.g. checkbox or confirm dialog) before saving.
-   [ ] After change, all summary values and reports reflect the new base currency.
-   [ ] Existing transactions retain their original currency and rate; only reporting currency changes.

---

## 4. Categories Management

### US-CAT-001 – Manage hierarchical categories

**As** a user
**I want** to organize categories into parent and child
**So that** my reports can be grouped meaningfully

**Acceptance Criteria**

-   [ ] User can create a parent category (type: income/expense).
-   [ ] User can create a child category by choosing a parent.
-   [ ] Parent categories without transactions can be deleted; if they have children, deletion is blocked or requires reassigning children.
-   [ ] Parent category totals in reports include all their children.
-   [ ] Category sort order in the list is reflected in selection dropdowns and reports.

### US-CAT-002 – Deactivate / delete categories with reassignment

**As** a user
**I want** to deactivate or delete categories
**So that** I can keep my category list clean without breaking history

**Acceptance Criteria**

-   [ ] User can mark a category as inactive; it is hidden from new transaction forms but still visible in reports.
-   [ ] When user attempts to delete a category that has existing transactions:

    -   [ ] System requires choosing a replacement category.
    -   [ ] All affected transactions are reassigned to the chosen category.
    -   [ ] The original category is removed or marked inactive.

-   [ ] Usage analytics show transaction count and total amount for each category.

---

## 5. Vendor Management

### US-VEN-001 – Auto-create and manage vendors

**As** a user
**I want** vendors to be created automatically from transactions
**So that** I don’t have to maintain a vendor list manually

**Acceptance Criteria**

-   [ ] When user enters a vendor name that doesn’t exist, a new vendor record is created automatically.
-   [ ] Existing vendors appear in an autocomplete list when typing in the vendor field.
-   [ ] Vendor management screen lists all vendors with totals for the selected date range.
-   [ ] User can edit vendor contact details and notes.

### US-VEN-002 – Merge duplicate vendors

**As** a user
**I want** to merge duplicate vendors
**So that** my vendor reports remain clean and accurate

**Acceptance Criteria**

-   [ ] User can select two or more vendors and choose “Merge”.
-   [ ] User must select which vendor will be kept as the “primary”.
-   [ ] All transactions associated with merged vendors are reassigned to the primary vendor.
-   [ ] After merging, only the primary vendor appears in lists and reports.

---

## 6. Accounts Management

### US-ACC-001 – Define accounts

**As** a user
**I want** to define accounts like bank, cash, and wallets
**So that** I can see balances by where the money actually is

**Acceptance Criteria**

-   [ ] User can create accounts with name and description.
-   [ ] User can mark one account as the default.
-   [ ] Default account is pre-selected on new transaction forms.
-   [ ] User can mark an account as inactive; inactive accounts are hidden from new transaction forms but remain in reports.

### US-ACC-002 – View account balances

**As** a user
**I want** to see balances per account
**So that** I know how much money I have in each place

**Acceptance Criteria**

-   [ ] For a selected date range, each account shows its net balance in base currency.
-   [ ] Balances are based only on Posted transactions.
-   [ ] Draft transactions do not affect balances.
-   [ ] Clicking an account shows a filtered transaction list for that account and date range.

---

## 7. Transactions (CRUD, Status, Filters, Bulk)

### US-TRX-001 – Create a transaction

**As** a user
**I want** to record an income or expense manually
**So that** my ledger stays up to date

**Acceptance Criteria**

-   [ ] User can choose transaction type: Income or Expense.
-   [ ] Required fields: Amount, Currency, Date, Description, Category, Account.
-   [ ] Amount must be > 0; if 0 or negative, user sees a validation error.
-   [ ] If the selected category’s type doesn’t match the transaction type, user gets a validation error.
-   [ ] Date cannot be in the future by default; choosing a future date shows a warning and requires confirm or is blocked according to your rule.
-   [ ] By default, new manual transactions are created as Posted (unless UI says Draft).

### US-TRX-002 – Draft vs Posted status

**As** a user
**I want** to keep drafts separate from posted transactions
**So that** I can review data before it affects reports

**Acceptance Criteria**

-   [ ] Transaction has a status: Draft or Posted.
-   [ ] Draft transactions are clearly labeled in lists and details.
-   [ ] Draft transactions are excluded from:

    -   [ ] Dashboard totals
    -   [ ] Account balances
    -   [ ] Reports

-   [ ] User can change status from Draft → Posted from the list or detail screen.
-   [ ] Changing status to Posted immediately updates dashboard and reports.

### US-TRX-003 – Edit and delete transactions

**As** a user
**I want** to edit or delete transactions
**So that** I can correct mistakes

**Acceptance Criteria**

-   [ ] User can edit all fields except transaction ID.
-   [ ] When editing a Posted transaction in a soft-closed period, a warning message appears and user must confirm to proceed.
-   [ ] Deleting a transaction moves it to Trash (not immediate hard delete).
-   [ ] Deleted transactions no longer show in normal lists, dashboard, or reports.
-   [ ] Activity log records edit and delete actions.

### US-TRX-004 – Search, filter, bulk actions

**As** a user
**I want** to quickly find and update groups of transactions
**So that** I can manage my ledger efficiently

**Acceptance Criteria**

-   [ ] Type-ahead search filters transactions by description and vendor text.
-   [ ] Filters available: date range, category (multi-select), vendor, amount range, currency, type (income/expense), status (Draft/Posted).
-   [ ] User can multi-select transactions and:

    -   [ ] Change category for all selected.
    -   [ ] Change status for all selected (e.g. Draft → Posted).
    -   [ ] Delete all selected (with confirmation).
    -   [ ] Export selected to CSV.

---

## 8. Multi-Currency & Exchange Rates

### US-FX-001 – Record foreign currency transaction

**As** a user
**I want** to record a transaction in a foreign currency
**So that** I can see it converted into my base currency

**Acceptance Criteria**

-   [ ] User can choose any supported currency for the transaction.
-   [ ] When currency ≠ base currency, system automatically suggests an exchange rate based on the transaction date.
-   [ ] Base currency amount is calculated and displayed.
-   [ ] If rate fetch fails:

    -   [ ] System follows the business setting:

        -   Fallback to latest available rate (with warning), or
        -   Require manual input (block save until provided).

### US-FX-002 – Override exchange rate

**As** a user
**I want** to override the suggested rate
**So that** I can match the rate shown on my bank statement

**Acceptance Criteria**

-   [ ] User can switch to manual rate and enter a custom value.
-   [ ] User can optionally add a note (e.g. “used bank rate from statement”).
-   [ ] When manual rate is used, base currency amount is recalculated immediately.
-   [ ] Transaction clearly indicates that the rate is manual (e.g. icon or label in detail view).
-   [ ] Reports use the stored base amount; they do not re-fetch or recalculate rates automatically.

---

## 9. AI Document Upload & Extraction

### US-AI-001 – Upload document for processing

**As** a user
**I want** to upload receipts and invoices
**So that** AI can help me extract transaction data

**Acceptance Criteria**

-   [ ] User can drag-and-drop files or use a “Browse” button.
-   [ ] Files larger than 10MB are rejected with a clear error.
-   [ ] Supported formats (JPEG, PNG, PDF, TXT) show a preview or icon.
-   [ ] User can upload multiple files in a single batch.

### US-AI-002 – Run AI extraction with template/prompt

**As** a user
**I want** to choose how AI interprets my document
**So that** extraction is tailored to the document type

**Acceptance Criteria**

-   [ ] User can select a template (e.g. “Receipt”, “Invoice”) before running extraction.
-   [ ] User can optionally enter a custom prompt.
-   [ ] System shows a progress indicator during extraction.
-   [ ] If extraction fails, user sees a clear error with an option to retry.
-   [ ] User can view and reuse previously used prompts/templates.

### US-AI-003 – Review and correct extracted data

**As** a user
**I want** to review and correct AI-extracted fields
**So that** my final transactions are accurate

**Acceptance Criteria**

-   [ ] Review screen shows document on one side and extracted fields on the other.
-   [ ] Extracted fields include: vendor, date, amount, currency, tax, and optional line items.
-   [ ] Each field is editable; user can override any value.
-   [ ] Fields show confidence level (e.g. icon or label) so user knows where to focus.
-   [ ] Low-confidence or missing fields are visually highlighted.

### US-AI-004 – Save extracted data as transactions or drafts

**As** a user
**I want** to save AI results as draft transactions
**So that** they don’t affect my reports until I’m ready

**Acceptance Criteria**

-   [ ] From review screen, user can:

    -   [ ] Create one or more Draft transactions.
    -   [ ] Update an existing transaction (chosen from a list or search).
    -   [ ] Save extraction data as a draft without creating transactions yet.

-   [ ] All AI-created transactions are set to Draft by default.
-   [ ] Linked document is automatically associated with any transaction created.
-   [ ] User is returned to a confirmation view (e.g. list of created drafts).

---

## 10. Document Library & Linking

### US-DOC-001 – Browse and search document library

**As** a user
**I want** to manage all my financial documents in one place
**So that** I can quickly find supporting evidence for transactions

**Acceptance Criteria**

-   [ ] Document library lists all documents belonging to the active business.
-   [ ] User can filter documents by date range, linked/unlinked status, vendor, and file type.
-   [ ] Search finds documents by filename, vendor, and text content (where OCR/extraction exists).
-   [ ] Each document shows whether it is linked to any transactions, and how many.

### US-DOC-002 – Manage document links

**As** a user
**I want** to link and unlink documents to transactions
**So that** I can keep my records organized

**Acceptance Criteria**

-   [ ] From a transaction detail view, user can attach existing documents.
-   [ ] From a document view, user can link it to one or more transactions.
-   [ ] A document can be linked to multiple transactions.
-   [ ] A transaction can have multiple documents.
-   [ ] Deleting a transaction leaves documents intact but removes the link.

---

## 11. Dashboard & Analytics

### US-DASH-001 – View key financial summary

**As** a user
**I want** to see my key financial numbers at a glance
**So that** I understand how my business is doing

**Acceptance Criteria**

-   [ ] Dashboard shows:

    -   YTD income
    -   YTD expenses
    -   YTD profit/loss

-   [ ] Values are in base currency.
-   [ ] Draft transactions are not included.
-   [ ] User can change date range (e.g. last 30 days, YTD, custom), and metrics update.

### US-DASH-002 – See trends and drill down

**As** a user
**I want** to see monthly trends and drill down
**So that** I can investigate unusual months

**Acceptance Criteria**

-   [ ] Income vs Expense chart displays monthly totals for the selected period.
-   [ ] User can toggle visibility of income and expense lines.
-   [ ] Hovering a data point shows exact amounts for that month.
-   [ ] Clicking a month opens a filtered transaction list for that month.

### US-DASH-003 – Customize dashboard layout

**As** a user
**I want** to reposition and hide dashboard widgets
**So that** I see what matters most to me

**Acceptance Criteria**

-   [ ] User can drag-and-drop widgets to change their order.
-   [ ] User can hide individual widgets (e.g. category chart).
-   [ ] Layout preferences are remembered per user per business.
-   [ ] Reset option restores default layout.

---

## 12. Reporting & Exports

### US-REP-001 – Generate Profit & Loss report

**As** a user
**I want** a P&L report
**So that** I can see my income, expenses, and profit for a period

**Acceptance Criteria**

-   [ ] User can choose a date range (full year, YTD, custom).
-   [ ] User can choose detail level (summary vs detailed by child category).
-   [ ] Report header includes business name, logo (if available), and period.
-   [ ] Only categories marked “Include in P&L” are shown.
-   [ ] Net profit/loss is calculated and displayed clearly.

### US-REP-002 – Export report to PDF

**As** a user
**I want** to export P&L to PDF
**So that** I can share it with my accountant

**Acceptance Criteria**

-   [ ] From the P&L view, user can click “Export to PDF”.
-   [ ] Generated PDF matches the on-screen report (layout, totals).
-   [ ] PDF includes business branding and page numbers.
-   [ ] User can download and save the PDF.

### US-REP-003 – Export transactions to CSV

**As** a user
**I want** to export raw transaction data
**So that** I can analyze it in a spreadsheet

**Acceptance Criteria**

-   [ ] User can export all transactions for a selected date range to CSV.
-   [ ] User can choose which columns to include (e.g. currency, base amount, vendor).
-   [ ] CSV includes document reference fields (e.g. document IDs or names) when present.
-   [ ] Export respects current filters (e.g. only expenses, only specific category) if user chooses that option.

---

## 13. CSV Import & Backup

### US-IMP-001 – Import transactions from CSV

**As** a user
**I want** to import transactions from a CSV file
**So that** I can migrate data from other tools

**Acceptance Criteria**

-   [ ] User can upload a CSV file and map columns to Sololedger fields.
-   [ ] Mapping shows sample data rows for each column.
-   [ ] User can save the mapping as a template for reuse.
-   [ ] Rows with missing required fields are flagged and not imported unless fixed/skipped.

### US-IMP-002 – Detect potential duplicates on import

**As** a user
**I want** to be warned about possible duplicates
**So that** I don’t accidentally double count transactions

**Acceptance Criteria**

-   [ ] During import, system compares each row to existing transactions for the same business.
-   [ ] Rows are flagged as potential duplicates if:

    -   Same date, amount, and vendor, OR
    -   Same amount and description within a small date window.

-   [ ] For each flagged row, user can choose:

    -   Import anyway
    -   Skip row

-   [ ] Summary screen shows how many rows were imported, skipped, and flagged.

---

## 14. Period Closing (Soft) & Activity Log

### US-CLOSE-001 – Soft-close a period

**As** an owner
**I want** to mark a fiscal year or period as closed
**So that** I know which numbers are considered final

**Acceptance Criteria**

-   [ ] Owner/Admin can mark a fiscal year or custom date range as “Closed”.
-   [ ] Closed periods are clearly indicated in the UI (e.g. badge on reports).
-   [ ] Users can still edit transactions in closed periods, but see a clear warning.
-   [ ] Activity log records when a period is closed or reopened and by whom.

### US-LOG-001 – View activity log

**As** a user
**I want** to see a history of important changes
**So that** I can understand why numbers changed

**Acceptance Criteria**

-   [ ] Activity log lists entries with timestamp, user, and description.
-   [ ] Activities include: transaction create/edit/delete, imports, exports, document uploads, settings changes, period closures.
-   [ ] User can filter log by date range, user, and activity type.
-   [ ] Activity log is read-only for all users.

---

## 15. Trash & Recovery

### US-TRASH-001 – Recover deleted items

**As** a user
**I want** a trash area
**So that** I can recover accidentally deleted transactions or documents

**Acceptance Criteria**

-   [ ] Deleted transactions and documents appear in a Trash view per business.
-   [ ] Each item shows what type it is (transaction/document) and when it was deleted.
-   [ ] User can restore items from Trash; restored items reappear in their original lists.
-   [ ] User can permanently delete items from Trash (with confirmation).
-   [ ] Permanently deleted items are no longer accessible anywhere.

---
