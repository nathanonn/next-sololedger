# Next Sololedger - Detailed Requirements Document

---

## 1. Product Overview & Scope

**Product name:** Sololedger
**Primary user:** Solopreneur (and optionally close collaborators like bookkeeper/accountant).

**Goal:**
Sololedger lets a user:

-   Track business income and expenses across one or more businesses.
-   Attach and process financial documents with AI assistance.
-   See clear, up-to-date views of profit, cash, and spending patterns.
-   Export clean data for accountants, tax filing, or external analysis.

Sololedger is **cash-basis**, not full double-entry accounting. It supports:

-   Income and expense tracking
-   Account-level views (bank, cash, etc.)
-   Multi-currency transactions with base-currency reporting
-   Simple tax visibility
-   Document storage + AI extraction

---

## 2. Users, Roles & Permissions

### 2.1 Roles

Per **business/organization**:

-   **Owner / Admin**

    -   Full access to everything within that business.
    -   Can manage business information and financial settings.
    -   Can manage members & invitations.
    -   Can manage master data: categories, vendors, accounts.
    -   Can manage AI document-processing configuration (if exposed).
    -   Can view activity log and run exports.

-   **Member**

    -   Can view and create/edit/delete transactions (within allowed periods).
    -   Can upload and manage documents.
    -   Can manage categories and vendors (per your “a + b” choice).
    -   Cannot change core business financial settings (base currency, fiscal year).

-   **Superadmin (platform-wide)**

    -   Out of scope for business behavior; treated as a platform operator.
    -   May bypass some restrictions (e.g. for debugging), but not part of normal Sololedger UX.

### 2.2 Permissions summary (business scope)

| Capability                                | Owner/Admin | Member                                  |
| ----------------------------------------- | ----------- | --------------------------------------- |
| View dashboard & reports                  | ✅          | ✅                                      |
| Add/edit/delete transactions              | ✅          | ✅                                      |
| Upload/manage documents                   | ✅          | ✅                                      |
| Manage categories (add/edit/delete)       | ✅          | ✅                                      |
| Manage vendors (add/edit/merge)           | ✅          | ✅                                      |
| Manage accounts (add/edit/archive)        | ✅          | ❌                                      |
| Change business info & financial settings | ✅          | ❌                                      |
| Change base currency / fiscal year        | ✅          | ❌                                      |
| Invite/remove members                     | ✅          | ❌                                      |
| Run data exports & imports                | ✅          | ✅ (for import), configurable if needed |
| View activity log                         | ✅          | ✅ (read-only)                          |

---

## 3. Organizations & Multi-Business Model

### 3.1 Organization = Business Ledger

-   Each **organization** in the boilerplate maps to one **business ledger** in Sololedger.
-   A user can belong to **multiple organizations** (e.g. “Nathan Freelance”, “Nathan Agency”).
-   All data (transactions, documents, categories, vendors, accounts, settings) are strictly scoped to a single organization.

### 3.2 Organization creation & switching

-   After sign-in, the user:

    -   Sees a way to **create** a new business.
    -   Sees a list of existing businesses they belong to and can **switch** between them.

-   Switching organizations:

    -   Changes the active context for dashboard, transactions, documents, reports, and settings.
    -   Does not carry over filters or selections between businesses.

### 3.3 Organization deletion (business deletion)

-   Only Owners/Admins can delete a business.
-   Deletion behavior:

    -   Business is **soft-deleted** initially (e.g. “Archived” state).
    -   All transactions, documents, and settings become inaccessible to normal users.
    -   Owner sees a clear warning explaining that deletion is irreversible after a retention period.

-   For this requirements doc, assume **hard deletion** happens after a defined retention period (e.g. 30 days) managed at platform level.

---

## 4. Onboarding Experience

Onboarding is **mandatory** before a business can be used.

### 4.1 Welcome Flow

-   After registration or creating a new business, user is guided through:

    1. Welcome / feature overview
    2. Business details
    3. Financial configuration
    4. Category setup

-   Requirements:

    -   **Personalized greeting** using the user’s name (if available).
    -   Short explanation of what Sololedger will help them do.
    -   **Progress indicator** (e.g. “Step 1 of 4”) visible on all onboarding steps.

### 4.2 Business Setup Step

**Fields:**

-   Required:

    -   Business name
    -   Business type (e.g. Freelance, Consulting, Agency, SaaS, Other)

-   Optional:

    -   Address
    -   Phone
    -   Email
    -   Tax ID / Registration number

**Behavior & validation:**

-   Business name:

    -   Must be non-empty and unique for that user (duplicate allowed globally).

-   Business type:

    -   Must be selected from predefined list; “Other” should prompt a short free-text label.

-   “Save & Continue”:

    -   Stores data even if the user leaves onboarding.

-   User cannot proceed to later steps unless required fields are completed.

### 4.3 Financial Configuration Step

Per business:

-   **Base Currency:**

    -   User selects from a comprehensive currency list (ISO codes, with symbols).
    -   Defaults to a sensible guess based on locale (e.g. MYR for Malaysia).
    -   Once set, all reports and dashboards use this base currency.

-   **Fiscal Year Start:**

    -   User selects a start **month** (1–12).
    -   Day is assumed to be the 1st of that month.
    -   Default: January 1.
    -   Fiscal years are labeled accordingly (e.g. FY2025 for period starting 1 Jan 2025).

-   **Date Format:**

    -   Predefined options, e.g.:

        -   DD/MM/YYYY
        -   MM/DD/YYYY
        -   YYYY-MM-DD

    -   Affects all date displays and input parsing in the UI for that business.

-   **Number Format:**

    -   Options for:

        -   Decimal separator: `.` vs `,`
        -   Thousands separator: `,`, `.`, space, or none

    -   Affects display only; system stores normalized numeric values.

**Validation:**

-   Base currency and fiscal year start must be set before user can finish onboarding.
-   Changing these later is allowed (with warnings, see Section 5).

### 4.4 Category Setup Step

-   Default **income** and **expense** categories are seeded.
-   Categories are **hierarchical**:

    -   Parent category (e.g. “Marketing”).
    -   Child category (e.g. “Facebook Ads”).

**Features:**

-   User can:

    -   Add new categories.
    -   Rename categories.
    -   Delete categories that are not used.
    -   Assign colors and icons to each category.
    -   Drag-and-drop to reorder categories.
    -   For each category, define:

        -   Type: Income or Expense.
        -   Whether the category is included in Profit & Loss (see Section 6).

-   Recommended default special categories (for v1, since we’re not using special transaction types):

    -   Owner Contributions (Income, flagged as non-P&L).
    -   Owner Drawings (Expense, non-P&L).
    -   Transfers In (Income, non-P&L).
    -   Transfers Out (Expense, non-P&L).
    -   Tax Paid (Expense, P&L).
    -   Tax Collected (Income or special depending on your tax situation).

User can finish onboarding only after:

-   Business name + type
-   Base currency
-   Fiscal year start
-   At least one income and one expense category exist.

---

## 5. Business Settings (Post-Onboarding)

Accessible via a **Settings → Business** area per organization.

### 5.1 Business Information

-   Same fields as onboarding.
-   Owners/Admins can update at any time.
-   Business email and logo are used in report headers and exports.

### 5.2 Financial Settings

**Base Currency:**

-   Can be changed by Owner/Admin only.
-   When changed:

    -   System shows a strong warning:

        -   Reports and balances will be recalculated.
        -   Historical comparison across base-currency changes may be less meaningful.

    -   System must recompute base-currency amounts for all transactions using:

        -   The stored original currency & rate if available.
        -   Or, fallback logic (see Section 7).

-   Requires confirmation (e.g. checkbox “I understand the impact”).

**Fiscal Year Start:**

-   Can be updated by Owner/Admin.
-   Changing fiscal year:

    -   Reassigns existing transactions to new fiscal year labels.
    -   Affects YTD and fiscal year reports.
    -   Shows warning about effect on historical reports.

**Tax Settings:**

-   Business can optionally:

    -   Indicate if it is tax-registered (e.g. for SST/GST/VAT purposes).
    -   Set default tax rate(s) for use in AI extraction and manual entry.

-   No full tax return logic; used mostly for:

    -   Default splitting of tax components.
    -   Reporting “total tax component” lines.

### 5.3 Branding

-   Business can upload a logo.
-   Logo appears on:

    -   PDF exports.
    -   Report headers.

-   If no logo, use business name in a plain header.

---

## 6. Master Data: Categories, Vendors, Accounts

### 6.1 Categories

Per business:

-   Hierarchical: Parent → Child (only one level deep).
-   Each category has:

    -   Name
    -   Type: Income or Expense
    -   Parent (optional)
    -   Color
    -   Icon
    -   Sort order
    -   **P&L flag**: “Include in Profit & Loss” (YES/NO)

**Behavior:**

-   Deleting a category with transactions:

    -   Requires user to choose a **replacement category** to reassign those transactions.
    -   Once reassigned, original category is removed or marked inactive.

-   Category can be set **inactive**:

    -   Inactive categories are hidden in selection lists but remain in reports for historical data.

-   Usage Analytics:

    -   For each category, show:

        -   Number of transactions.
        -   Total amount (for the selected date range).
        -   Last usage date.

### 6.2 Vendors

Per business:

-   A **Vendor** represents:

    -   A supplier (expense side) or customer/client (income side).

-   Fields:

    -   Name (required)
    -   Contact details (phone/email/address, optional)
    -   Notes (optional)

**Behavior:**

-   Vendors are **auto-created**:

    -   When user enters a new vendor/client name in a transaction.

-   Manual creation:

    -   User can predefine vendors from the Vendor management screen.

-   Merge duplicates:

    -   User can select 2+ vendors and merge into one:

        -   All transactions are reassigned to the surviving vendor.
        -   Non-empty attributes (contact info, notes) are combined with sensible rules.

**Vendor Insights:**

-   For a given period, show:

    -   Total spent with each vendor (expenses).
    -   Total received from each client/vendor (income).

-   Used for “Vendor reports” in Section 11.

### 6.3 Accounts

Per business:

-   An **Account** represents where money is held:

    -   Bank account (e.g. “Maybank Business 1234”)
    -   Cash
    -   Payment service (e.g. “PayPal”, “Wise”)

-   Fields:

    -   Name (required)
    -   Description (optional)
    -   Default: Yes/No (one default account per business)
    -   Active: Yes/No

**Behavior:**

-   Every transaction belongs to one **account**.
-   When an account is set inactive:

    -   It can no longer be chosen for new transactions.
    -   Existing transactions remain valid and included in balances.

-   Account balances:

    -   Show **current balance in base currency**.
    -   Balance = Sum of posted income – sum of posted expenses, adjusted for P&L-excluded categories if configured:

        -   Accounts may optionally show separate subtotals for:

            -   Operating transactions (P&L categories).
            -   Owner movements/transfers (non-P&L categories).

    -   For v1, all categories affect account balance; P&L flag affects only P&L reports.

---

## 7. Currency & Exchange Rates

### 7.1 Base Currency & Transaction Currency

-   Each business has a **Base Currency** (e.g. MYR).
-   Each transaction has:

    -   Original amount (positive number only).
    -   Original currency (can be base or non-base).
    -   Exchange rate to base currency.
    -   Base currency amount.

**Dual Display:**

-   For non-base currency transactions:

    -   Show both original amount + currency and base currency amount.

-   For base currency transactions:

    -   Rate is 1.00; optionally hidden from user.

### 7.2 Exchange Rate Handling

**Automatic rates:**

-   When a non-base-currency transaction is created or edited:

    -   The system attempts to fetch a historical exchange rate for:

        -   The transaction date and the currency pair (transaction currency → base currency).

    -   Stores:

        -   Rate value
        -   Rate source
        -   Timestamp of retrieval

**Historical rate storage & reuse:**

-   Once a rate is fetched for a given currency and date:

    -   It is stored so subsequent transactions on that date can reuse it without refetching.

-   When editing a past transaction:

    -   The stored rate for that transaction is used, not re-fetched, unless user chooses to update it.

**Failure & fallback behavior (per business setting):**

-   Setting: “On exchange rate failure:”

    -   Option 1: **Fallback to last available rate (default)**

        -   Find the latest previous rate for that currency.
        -   Show warning: “Using rate from [date]; API unavailable.”

    -   Option 2: **Require manual rate entry**

        -   Block saving until user enters rate manually.

-   Owner/Admin can change this setting; default is fallback.

### 7.3 Manual Rate Override

-   For any transaction, user can:

    -   Enter a custom exchange rate.
    -   Optionally add a short justification note (e.g. “Used bank statement rate”).

-   Once overridden:

    -   The manual rate is used to compute and display base-currency amount.
    -   System clearly indicates that a manual rate is in use.

---

## 8. Transactions

### 8.1 Transaction Types & Structure

For v1:

-   **Transaction type:** Income or Expense.
-   Fields (required):

    -   Amount (positive)
    -   Currency
    -   Date
    -   Description
    -   Category
    -   Account

-   Fields (optional):

    -   Vendor/Client (with autocomplete)
    -   Tags (free-form or pre-defined)
    -   Notes
    -   Linked documents (0..N)
    -   Tax amount (if applicable)
    -   AI extraction metadata (if created via AI)

Business rules:

-   Amount must be > 0.
-   Date:

    -   Cannot be in the future (configurable soft rule; show warning if future).

-   Category type must match transaction type:

    -   Income transaction → must use an Income category.
    -   Expense transaction → must use an Expense category.

### 8.2 Status: Draft vs Posted

-   **Draft:**

    -   Excluded from all financial reports and dashboards.
    -   Can be freely edited or deleted.
    -   Typical origin:

        -   AI-extracted transactions saved as draft.
        -   Imported transactions pending review.

-   **Posted:**

    -   Included in all financial calculations and reports.
    -   Can be edited or deleted, but subject to soft closing rules (Section 10).

-   Status is visible in transaction list and detail screens.

-   Changing a transaction from Draft → Posted:

    -   Triggers recalculation of affected metrics (balances, P&L, etc.).

### 8.3 Transaction Operations

-   **Create:**

    -   From:

        -   Manual entry form.
        -   AI document processing.
        -   CSV import.

    -   Validations:

        -   Required fields present.
        -   Date and amount valid.
        -   Category & account exist and active.

-   **Edit:**

    -   All fields except unique ID can be modified.
    -   Editing a Posted transaction:

        -   If in a **soft-closed** period (Section 10), show warning but allow save.
        -   Changes are recorded in the activity log.

-   **Duplicate:**

    -   User can duplicate any transaction:

        -   New transaction in Draft status.
        -   Pre-filled with original values.
        -   Date defaults to current date (or optional original date).

-   **Delete:**

    -   Deletion is a **soft delete**:

        -   Moves transaction to Trash (Section 12).
        -   Removes it from all reports and lists.

    -   If transaction has linked documents:

        -   Documents remain, but links are removed (docs are not deleted).

### 8.4 Bulk Actions

-   User can multi-select transactions and perform:

    -   Bulk categorization (change category for all selected).
    -   Bulk status change (e.g. Draft → Posted).
    -   Bulk delete (soft delete, with confirmation).
    -   Bulk export to CSV (only selected items).

### 8.5 Search & Filtering

Transaction list supports:

-   Text search across:

    -   Description
    -   Vendor/Client name

-   Filters:

    -   Date range
    -   Category (multi-select, supports parent-category selection)
    -   Vendor
    -   Amount range (min/max)
    -   Currency
    -   Transaction type (income/expense)
    -   Status (Draft/Posted)

---

## 9. AI-Powered Document Processing

### 9.1 Document Upload

Per business:

-   Supported formats:

    -   Images: JPEG, PNG
    -   PDF
    -   Plain text files (.txt)

-   Upload methods:

    -   Drag-and-drop area
    -   “Browse files” button
    -   Batch upload (multiple files at once)

-   Size limits:

    -   Max 10 MB per file.
    -   Reject files over limit with clear message.

-   Preview:

    -   Thumbnails for images and PDFs.
    -   Simple icon/filename display for text files.

### 9.2 AI Extraction Flow

-   Precondition:

    -   Business has AI extraction feature enabled/configured (provider details abstracted away).

-   For each uploaded document, user can start **AI extraction**.

Extraction capabilities:

-   Detect:

    -   Vendor/client name
    -   Amount(s) with currency
    -   Transaction date
    -   Line items (where possible)
    -   Tax component vs net amount
    -   Tip or service charges (if present)

**Custom prompts:**

-   User can:

    -   Choose from predefined templates (e.g. “Standard Receipt”, “Invoice”, “Bank Statement Page”).
    -   Enter a custom prompt (free text) for special docs.
    -   View prompt history and reuse previous prompts.

**Processing feedback:**

-   Show:

    -   A progress indicator (e.g. “Reading document → Extracting fields → Preparing summary”).
    -   Rough, generic time hints (e.g. “Usually takes a few seconds”) without guaranteeing exact times.

-   If extraction fails:

    -   Show error explanation.
    -   Offer a “Retry” option.
    -   Allow switching prompt/template and retry.

### 9.3 Review & Validation (Always Manual)

-   AI extraction **never** directly posts transactions.
-   For each document, user is taken to a **review interface**:

Features:

-   Split-screen:

    -   Left: Document viewer with zoom.
    -   Right: Extracted data fields grouped logically (e.g. summary, line items).

-   Field-level:

    -   Each extracted field (vendor, amount, date, tax, etc.) is editable.
    -   Show a **confidence indicator** (e.g. high/medium/low) per field.
    -   Highlight low-confidence or missing fields.

-   User can:

    -   Correct any field.
    -   Add missing information (e.g. assign category, account).
    -   Decide whether to split a document into multiple transactions (if line items span categories).

### 9.4 Save Options

From the review screen, user chooses:

-   **Create new transaction**:

    -   Creates one or more Draft transactions using the reviewed data.

-   **Update existing transaction**:

    -   User picks an existing transaction to update with extracted data.
    -   Existing manual edits should be clearly indicated; user confirms which fields to overwrite.

-   **Save as draft (document only)**:

    -   Store extracted data as an intermediate “Draft extraction” without creating any transaction yet.

### 9.5 Reprocessing

-   For any stored document, user can:

    -   Re-run AI extraction with:

        -   A different template.
        -   A custom prompt.

    -   Compare new extraction with previous one and choose which values to keep.

---

## 10. Document Management

### 10.1 Storage & Linking

-   All uploaded documents belong to a **single business**.
-   Documents can be linked to **zero, one, or many transactions**.
-   Transactions can have **zero, one, or many documents**.

**Deletion & unlinking:**

-   Deleting a transaction:

    -   Removes links to documents.
    -   Leaves documents intact.

-   Deleting a document:

    -   Unlinks it from all transactions.
    -   Moves it to document Trash or hard-deletes (depending on retention settings).

### 10.2 Organization & Browsing

-   Default views:

    -   All documents
    -   By month/year (based on document date or upload date)
    -   By linked status (linked vs unlinked)

-   Grouping options:

    -   By date (monthly/yearly)
    -   By category (via linked transactions)
    -   By vendor

### 10.3 Search

-   Search by:

    -   Filename
    -   Vendor
    -   Amount
    -   Text content (based on extracted text/OCR when available)

-   Results:

    -   Show thumbnail, name, date, and linked transactions (if any).

### 10.4 Download & Sharing

-   User can download original files.
-   Business-level controls to ensure:

    -   Only members of that organization can see/download its documents.

---

## 11. Dashboard & Analytics

### 11.1 Key Metrics (Home Dashboard)

Per active business:

-   **Financial summary (base currency):**

    -   Year-to-date Income
    -   Year-to-date Expenses
    -   Year-to-date Profit/Loss

-   **Account overview:**

    -   List of accounts with current balances (base currency).
    -   Optional highlight for total cash/bank combined.

-   **Trends:**

    -   Month-over-month income, expenses, and profit/loss.
    -   Percentage change vs previous month.

-   **Visual indicators:**

    -   Trend arrows (up/down/flat).
    -   Color coding:

        -   Green for positive trends (e.g. higher profit vs last period).
        -   Red for negative trends.

### 11.2 Charts

-   **Income vs Expense by month:**

    -   Line or bar chart with monthly totals.
    -   Ability to toggle each series on/off (e.g. hide income for a clearer expense view).
    -   Hover tooltips showing exact amounts.
    -   Clicking a month opens a filtered transaction list for that period.

-   **Category breakdown:**

    -   Pie or donut chart:

        -   Total income by category.
        -   Total expenses by category.

    -   Options to:

        -   Show top N categories.
        -   Group rest into “Other.”

    -   Clicking a slice opens a category-specific breakdown or list.

-   **Recent activity panel:**

    -   Show last 10–20 transactions.
    -   Indicators for:

        -   Draft vs Posted.
        -   Linked documents (e.g. paperclip icon).

    -   Quick actions:

        -   Edit
        -   View linked documents

### 11.3 Dashboard Customization

-   **Widgets:**

    -   User can:

        -   Reorder dashboard widgets.
        -   Show/hide specific widgets (e.g. hide Category chart).

    -   Settings are stored per user per business.

-   **Quick filters:**

    -   Date range selector (e.g. YTD, last 30 days, custom range).
    -   Category filter (single or multi-select).
    -   View toggle:

        -   Income only
        -   Expense only
        -   Both

    -   Currency filter:

        -   All transactions converted to base currency, but can filter to “show only transactions originally in X currency” if desired.

---

## 12. Reporting

### 12.1 Profit & Loss Statement

**Configuration:**

-   Business & fiscal year selection.
-   Date options:

    -   Full fiscal year
    -   Year-to-date
    -   Custom date range

-   Comparison:

    -   Compare with previous period (e.g. same period last year or previous month).

-   Detail level:

    -   Summary (by parent category)
    -   Detailed (by parent + child categories)

**Structure:**

-   Header:

    -   Business name and logo.
    -   Report title (e.g. “Profit & Loss Statement”).
    -   Period covered.

-   Sections:

    -   Income (by category)
    -   Expenses (by category)
    -   Net Profit/Loss

-   Only categories marked as “Include in P&L” appear in this report.

### 12.2 Other Reports (v1)

-   **Category Reports:**

    -   For a selected date range:

        -   Show totals by category and subcategory.
        -   Option to filter to Income or Expense only.

-   **Vendor Reports:**

    -   For a selected date range:

        -   Total spent per vendor.
        -   Total income per vendor (if applicable).

    -   Drill-down to see transactions per vendor.

-   **Currency Reports:**

    -   For a selected date range:

        -   Summary of totals by original currency.
        -   For each currency:

            -   Total income (original & base).
            -   Total expenses (original & base).

### 12.3 Export Capabilities

-   **PDF export:**

    -   Available for P&L and other summary reports.
    -   Professional layout with:

        -   Business logo and details.
        -   Clear headings and section separators.
        -   Page numbers and print-friendly formatting.

    -   Optional space for a digital signature or note.

-   **CSV export:**

    -   Raw transaction data for a chosen date range.
    -   Options:

        -   All fields (including base currency amounts and exchange rates).
        -   Custom column selection (fields user wants to include).
        -   Option to include links or references to documents.

---

## 13. Import, Export & Backup

### 13.1 CSV Import

-   User can upload a CSV of transactions.

**Mapping:**

-   Guided mapping step:

    -   User maps CSV columns to Sololedger fields:

        -   Date, Amount, Currency, Description, Category, Vendor, Account, etc.

    -   Can save mapping as a template for future imports.

**Validation:**

-   Each row is validated:

    -   Required fields present.
    -   Date parsable according to chosen format.
    -   Amount positive.
    -   Currency recognized.

-   Invalid rows:

    -   Flagged with reasons; user can fix and re-import or skip.

**Duplicate detection (simple heuristic):**

-   System flags potential duplicates when:

    -   Same business, and
    -   Same date + amount + vendor OR
    -   Same amount + description within a small date window (e.g. ±2 days).

-   For each flagged row:

    -   User chooses:

        -   Keep both
        -   Skip imported row

### 13.2 Data Export & Backup

Per business, user can:

-   Export:

    -   Full data (JSON or CSV):

        -   Transactions
        -   Categories
        -   Vendors
        -   Accounts

    -   Option to include/exclude:

        -   Document references

-   Schedule:

    -   Optional recurring export (e.g. monthly) that the system prepares and makes available for download.

---

## 14. Period Closing & Editing Rules

### 14.1 Soft Closing

-   Owner/Admin can **mark a fiscal year or date range as “soft-closed”**.
-   Effects:

    -   Reports may highlight that period as closed.
    -   Editing or deleting transactions in a closed period:

        -   Still allowed.
        -   Prompts a strong warning:

            -   “You are editing a closed period; this may affect previously finalized reports.”

        -   Action is logged in the activity log.

### 14.2 Locking

-   Hard locking is **not enforced** in v1, but:

    -   Design should keep the door open to support hard-closed periods later without breaking existing logic.

---

## 15. Trash & Deletion Behavior

### 15.1 Soft Delete (Trash)

-   Deleting a transaction or document:

    -   Marks it as deleted and hides it from normal views and reports.

-   Trash view:

    -   Separate area per business showing:

        -   Deleted transactions
        -   Deleted documents

    -   User can:

        -   Restore items from Trash.
        -   Permanently delete items (if needed).

-   Permanently deleted items:

    -   Are no longer visible anywhere.
    -   Related links (e.g. transaction-document) are removed.

---

## 16. Activity Log

### 16.1 Activity Types

Per business, log key activities such as:

-   Transaction created/edited/deleted.
-   Document uploaded/deleted/reprocessed.
-   Import and export operations.
-   Category/vendor/account changes.
-   Changes to business financial settings (base currency, fiscal year).
-   Period closing operations.

### 16.2 Activity Log UI

-   Activity feed showing:

    -   Timestamp
    -   Actor (user)
    -   Action type
    -   Short description (e.g. “Edited transaction #123: amount 200 → 250”)

-   Filters:

    -   Date range
    -   Activity type
    -   User

Activity log is read-only for Members and Owners.

---

## 17. Future Extensibility (Design Notes)

These are _guiding constraints_ for the business logic (no implementation details):

-   The current model uses **only Income and Expense transaction types**, but:

    -   Category structure and P&L flag must allow future introduction of additional transaction types (e.g. Transfers, Owner contributions/draws) without breaking current reports.

-   Period closing is soft in v1, but:

    -   Logic around status and audit trail should be robust enough to support hard closures later.

-   Multi-currency:

    -   Rate storage and per-transaction base amounts must make it safe to add more advanced FX features later (gains/losses, revaluation) if desired.

---
