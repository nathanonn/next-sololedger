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

- [ ] Advanced filters: category (multi-select), vendor, amount range, currency
- [ ] Bulk actions: change category, change status, delete, export selected CSV
- [ ] Multi-select in list with selection toolbar
- [ ] Trash view for soft-deleted transactions (restore / permanent delete)
- [ ] Soft-closed period warning/confirm on editing POSTED in closed period

## Multi‑Currency & Exchange Rates (FX)

- [ ] Automatic historical exchange rate fetch on non-base transactions
- [ ] Store rate (date, source, timestamp) and reuse for same day
- [ ] Failure policy per business setting: fallback to last available OR require manual
- [ ] Manual rate override indicator + optional note persisted and visible

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

- [ ] Date range selector (last 30 days, YTD, custom) affecting metrics
- [ ] Trends: income vs expense monthly chart with hover + click drill-down
- [ ] Dashboard customization: reorder/hide widgets; per-user per-business persistence

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
