# Sololedger Gaps – Checklist Board

Generated: 2025-11-14

## Categories

- [x] Delete category with reassignment flow (if has transactions)
- [x] Color and icon assignment in UI (post-onboarding)
- [x] Drag-and-drop reorder; persist and reflect in dropdowns/reports
- [x] Usage analytics per category (count, totals, last used)

## Business Settings

- [x] Post-onboarding Business Info UI (address, phone, email, tax ID)
- [x] Member read-only view for business info
- [x] Base currency change UI with strong warning + explicit confirm

## Vendors

- [x] Introduce `Vendor` model (org-scoped) and CRUD APIs
- [x] Autocomplete vendor on transaction forms
- [x] Auto-create vendor when saving unknown vendorName
- [x] Vendor management screen with totals (by date range)
- [x] Merge duplicate vendors (choose primary, reassign transactions)

## Accounts

- [x] Account balances by selectable date range (base currency)
- [x] Click account → open filtered transaction list (account + date range)

## Vendors/Clients

At the moment, vendors are used for income and expense transactions. I want to separate vendors and clients to better track business relationships. Clients will be used for income transactions, while vendors will be used for expense transactions.

## Transactions – Filters, Bulk, Trash

- [x] Advanced filters: category (multi-select), vendor, amount range, currency
- [x] Bulk actions: change category, change status, delete, export selected CSV
- [x] Multi-select in list with selection toolbar
- [x] Trash view for soft-deleted transactions (restore / permanent delete)
- [x] Soft-closed period warning/confirm on editing POSTED in closed period

## Multi‑Currency & Exchange Rates (FX)

For the currency requirements, help me update it based on the following:

- Remove the exchange rate entirely
- Beside the base currency, I want to add support of secondary currency for each transaction, where the secondary currency will have its own amount and currency code. This will allow me to track transactions in two different currencies without needing to deal with exchange rates.
  - Here's the use-case: My base currency is MYR, but I often deal with USD transactions. But, since my accounting is in MYR, I need to track the MYR amount as well. So, for a USD transaction, I will have the USD amount and currency code, and also the MYR amount and currency code. The base currency amount will be used for reporting and accounting purposes.
  - Here's the user story:
    - As a user, I want to be able to enter transactions with two currencies: the base currency and a secondary currency.
    - As a user, I want to see both currency amounts and codes in the transaction list and details.
    - As a user, I want to filter transactions using the base currency amount only.
    - As a user, I want to generate reports that use the base currency amount for calculations.
    - As a user, I want to be able to edit both currency amounts and codes in the transaction edit form.
    - As a user, I want to be able to create transactions with only the base currency, without needing to provide a secondary currency.
    - As a user, I can't add transactions with only the secondary currency; the base currency is mandatory.
    - As a user, I want to be able to search transactions by base currency amount only.
    - As a user, I want to be able to sort transactions by base currency amount only.
  - Here's the acceptance criteria:
    - The transaction model will have two currency fields: base currency and secondary currency.
    - The transaction model will have two amount fields: base currency amount and secondary currency amount.
    - The transaction list and detail views will display both currency amounts and codes. However, filtering, searching, and sorting will only be based on the base currency amount. If the secondary currency is not provided, it will be shown as "N/A" or similar.
    - The transaction creation and edit forms will have fields for both currency amounts and codes. The base currency amount and code are mandatory.
  - The secondary currency amount and code will be optional. If not provided, the transaction will only have the base currency amount and code.

## Documents & AI Extraction

- [ ] Document upload (JPEG, PNG, PDF, TXT), max 10MB, previews/icons
- [ ] Document storage model; many-to-many links to transactions
- [ ] Document library: browse, filter (date, linked/unlinked, vendor, type), search (filename/text/OCR)
- [ ] Link/unlink documents from transaction and document views (many↔many)
- [ ] AI extraction: templates (Receipt/Invoice), custom prompt, progress, retry
- [ ] Review UI: split-screen, editable fields, confidence indicators, highlight low confidence
- [ ] Save options: create Draft transactions, update existing, save draft extraction only
- [ ] Reprocess document with alternate template/prompt; compare/choose values

## Dashboard & Analytics

- [x] Date range selector (last 30 days, YTD, custom) affecting metrics
- [x] Trends: income vs expense monthly chart with hover + click drill-down
- [x] Dashboard customization: reorder/hide widgets; per-user per-business persistence

## Reporting & Exports

- [ ] Profit & Loss report (date range, detail level, includeInPnL only)
- [ ] PDF export with branding (logo/name), page numbers
- [ ] Transactions CSV export (date range, selectable columns, include docs refs)

## Import & Backup

- [ ] CSV import: column mapping UI with samples; save mapping templates
- [ ] Row validation (required fields, dates/formats); skip/fix workflow
- [ ] Duplicate detection heuristics and per-row keep/skip choices
- [ ] Data export/backup (JSON/CSV) and optional scheduled export

## Period Closing & Activity Log

- [ ] Soft-close period (fiscal year or custom range), UI + state
- [ ] Edit in closed period: strong warning, proceed allowed, activity logged
- [ ] Activity log UI (timestamp, user, type, description) with filters
- [ ] Log domain activities: trx create/edit/delete, imports/exports, docs, settings changes, period close/reopen

## Trash & Recovery

- [ ] Business-level Trash for transactions and documents (with type and deleted-at)
- [ ] Restore items from Trash; reappear in original lists
- [ ] Permanent delete with confirmation

## Nice-to-Have / Enablers

- [ ] Use existing `components/ui/chart.tsx` for dashboard charts
- [ ] Accessibility pass for forms, dialogs, and toasts
- [ ] E2E happy-path flows: onboarding → first transaction → dashboard → settings
