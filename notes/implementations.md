## Phase 1 – Core Solo Ledger MVP (Manual, base-currency-first)

**Goal:** You can fully run your business ledger manually: create businesses, onboard, track income/expenses, see balances and a basic P&L, and export raw data. No AI, no imports yet.

**Included stories**

**Organization & Onboarding**

-   **US-ORG-001** – Create a new business
-   **US-ONB-001** – Complete business details step
-   **US-ONB-002** – Configure financial settings during onboarding
-   **US-ONB-003** – Complete category setup

**Business Settings**

-   **US-SET-001** – Update business information

    > (Base currency is set in onboarding; no changing logic yet.)

**Categories / Vendors / Accounts**

-   **US-CAT-001** – Manage hierarchical categories
-   **US-VEN-001** – Auto-create and manage vendors
-   **US-ACC-001** – Define accounts
-   **US-ACC-002** – View account balances

**Transactions (core ledger)**

-   **US-TRX-001** – Create a transaction
-   **US-TRX-002** – Draft vs Posted status
-   **US-TRX-003** – Edit and delete transactions
-   **US-TRX-004** – Search, filter, bulk actions

_(In Phase 1 you can treat everything as base-currency-only behind the scenes, even if the UI already lets you pick currency but only really supports “base = transaction currency.”)_

**Dashboard**

-   **US-DASH-001** – View key financial summary
-   **US-DASH-002** – See trends and drill down

**Reporting & export (MVP)**

-   **US-REP-001** – Generate Profit & Loss report
-   **US-REP-003** – Export transactions to CSV

**Safety / Hygiene**

-   **US-TRASH-001** – Recover deleted items

> After Phase 1, you can ditch spreadsheets and run your whole solo business in Sololedger manually.

---

## Phase 2 – Multi-Currency, Reporting Polish, Governance

**Goal:** Make the ledger robust for real-world use: multi-currency, base-currency changes, better reporting, plus governance (soft closing + activity log).

**Included stories**

**Business Settings (advanced)**

-   **US-SET-002** – Change base currency with warning

**Categories / Vendors refinement**

-   **US-CAT-002** – Deactivate / delete categories with reassignment
-   **US-VEN-002** – Merge duplicate vendors

**Multi-Currency & FX**

-   **US-FX-001** – Record foreign currency transaction
-   **US-FX-002** – Override exchange rate

**Dashboard polish**

-   **US-DASH-003** – Customize dashboard layout

**Reporting & exports polish**

-   **US-REP-002** – Export report to PDF

**Governance / Auditability**

-   **US-CLOSE-001** – Soft-close a period
-   **US-LOG-001** – View activity log

> After Phase 2, Sololedger feels “accountant friendly”: clean vendors/categories, proper FX, PDF P&L, and an audit trail of changes.

---

## Phase 3 – AI, Documents & Data Automation

**Goal:** Turn Sololedger into your “smart inbox” for financial data: ingest receipts, bank PDFs, and CSVs with AI and imports.

**Included stories**

**AI Document Processing**

-   **US-AI-001** – Upload document for processing
-   **US-AI-002** – Run AI extraction with template/prompt
-   **US-AI-003** – Review and correct extracted data
-   **US-AI-004** – Save extracted data as transactions or drafts

**Document Library**

-   **US-DOC-001** – Browse and search document library
-   **US-DOC-002** – Manage document links

**CSV Import & Duplicate Detection**

-   **US-IMP-001** – Import transactions from CSV
-   **US-IMP-002** – Detect potential duplicates on import

> After Phase 3, most of your data entry comes from uploads/imports + quick review, and manual entry becomes the exception.

---

## Optional “Phase 0.5” (if you want ultra-lean first release)

If you want something even lighter before full Phase 1, you could:

-   Drop **US-ACC-002** (account balances) and **US-DASH-002** (trends) temporarily.
-   Ship only:

    -   Single business
    -   Onboarding
    -   Categories
    -   Manual transactions
    -   Basic P&L
    -   CSV export

But the slicing above should work nicely as a “real” roadmap:

-   **Phase 1:** Replace spreadsheets for one solo business.
-   **Phase 2:** Handle serious, multi-currency, multi-year bookkeeping.
-   **Phase 3:** Add AI and automation to reduce manual work.
