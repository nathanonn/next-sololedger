## Document Management – UX Flow & Wireframes

This document describes the UX flow and screen-by-screen wireframes for Sololedger’s document management features (section 10), aligned with the implementation plan in `notes/plan.md`. It covers document upload, library browsing, search and grouping, linking documents with transactions, Trash behavior, and secure download/preview.

---

### 1. Flow Map

```text
User (signed in, org selected)
	|
	|---> Documents section
	|       Route: /o/[orgSlug]/documents
	|       - View all documents for org
	|       - Filter/search/group
	|       - Upload new documents
	|       - Open document detail
	|       - Move documents to Trash
	|
	|---> Upload documents (from Documents page or Transaction page)
	|       - Select files (drag/drop or file picker)
	|       - POST /api/orgs/[orgSlug]/documents
	|       - See success or per-file errors
	|       - Newly uploaded docs appear in list
	|
	|---> Document detail
	|       Route: /o/[orgSlug]/documents/[id] (or sheet/dialog)
	|       - Preview document (image/PDF/text)
	|       - Edit display name, type, document date
	|       - See linked transactions
	|       - Link/unlink transactions
	|       - Download or move to Trash
	|
	|---> Transactions section
	|       Route: /o/[orgSlug]/transactions
	|       - For each transaction, see doc indicator
	|       - Open transaction detail
	|
	|---> Transaction detail
	|       Route: /o/[orgSlug]/transactions/[id]
	|       - View/Edit transaction fields
	|       - Documents panel
	|            - See linked docs
	|            - View / Download / Unlink
	|            - Add existing doc(s) via picker
	|            - Optional Upload & link shortcut
	|
	|---> Document picker (from Transaction detail)
	|       - Lightweight list/search of documents
	|       - Default filter: unlinked docs
	|       - Select one or more docs and attach
	|
	|---> Documents Trash
	|       Route: /o/[orgSlug]/documents/trash
	|       - List soft-deleted documents
	|       - Restore
	|       - Permanently delete
	|
	|---> Download / Preview
					Route: GET /api/orgs/[orgSlug]/documents/[id]/download?mode=attachment|inline
					- Used by UI for thumbnails, previews, and downloads
```

---

### 2. Screen: Documents List (`/o/[orgSlug]/documents`)

```text
Route: /o/[orgSlug]/documents

+----------------------------------------------------------------------------------+
| [Logo] Sololedger                                             [User Avatar ▾]   |
+----------------------------------------------------------------------------------+
| Documents                                                                      |
| Manage your receipts and financial documents                                   |
|                                                                                |
| [Upload documents] [Trash]                                                     |
+----------------------------------------------------------------------------------+
| Filters                                                                        |
|                                                                                |
| Date range: [ From: 2025-11-01 ] [ To: 2025-11-30 ]                            |
|   (Document date, falling back to upload date)                                 |
|                                                                                |
| Linked: (• All) (  Linked only  ) (  Unlinked only  )                          |
|                                                                                |
| Vendor: [ Any vendor  ▾ ]   Client: [ Any client  ▾ ]                           |
|                                                                                |
| Amount: [ Min ______ ]  [ Max ______ ]  (base currency)                        |
|                                                                                |
| File type: [ All types ▾ ]  (All / Images / PDFs / Text)                       |
| Uploader: [ Anyone ▾ ]                                                         |
|                                                                                |
| Search: [ 🔍 Search by filename, vendor, text...                ]              |
|                                                                                |
| Group by: [ None ▾ ]   (None / Month / Category / Vendor)                      |
|                                                                                |
+----------------------------------------------------------------------------------+
| Content                                                                        |
|                                                                                |
| (Loading state)                                                                |
|   [Spinner] Loading documents...                                               |
|                                                                                |
| (Empty state)                                                                  |
|   No documents yet.                                                            |
|   [Upload documents] to get started.                                           |
|                                                                                |
| (Grouped by Month example)                                                     |
|                                                                                |
| ▶ November 2025 (12)                                                           |
|   ├─ [🖼]  invoice-nov-acme.pdf                                                |
|   |      Document date: 2025-11-10                                            |
|   |      Type: INVOICE · PDF · 420 KB                                         |
|   |      Linked: 2 transactions                                               |
|   |      [View] [Download] [⋯]                                                |
|   |                                                                            |
|   ├─ [🖼]  taxi-receipt-2025-11-09.jpg                                         |
|   |      Document date: 2025-11-09                                            |
|   |      Type: RECEIPT · Image · 230 KB                                       |
|   |      Linked: 1 transaction                                                |
|   |      [View] [Download] [⋯]                                                |
|   |                                                                            |
|   └─ ...                                                                       |
|                                                                                |
| ▶ October 2025 (5)                                                             |
|   ├─ ...                                                                       |
|                                                                                |
+----------------------------------------------------------------------------------+
| Pagination                                                                     |
|   [ Prev ]  Page 1 of 4  [ Next ]                                             |
+----------------------------------------------------------------------------------+
```

Notes:
- Thumbnails: use inline download URL for images; icon for PDF/TXT.
- [⋯] opens a small menu with “View”, “Download”, “Move to Trash”.

---

### 3. Screen: Document Detail (`/o/[orgSlug]/documents/[id]`)

```text
Route: /o/[orgSlug]/documents/[id]

+----------------------------------------------------------------------------------+
| [← Back to Documents]                                   [Download ▼] [Trash]   |
+----------------------------------------------------------------------------------+
| Document: taxi-receipt-2025-11-09.jpg                                           |
|                                                                                |
+--------------------------+-----------------------------------------------------+
| Preview                  | Details                                             |
|                          |                                                     |
| +----------------------+ | Display name: [ Taxi – Airport to Client Office ]   |
| |                      | | Filename:     taxi-receipt-2025-11-09.jpg          |
| |   [ Image preview ]  | | Type:         [ RECEIPT ▾ ]                        |
| |                      | | MIME:         image/jpeg                            |
| +----------------------+ | Size:         230 KB                                |
|                          |                                                     |
| (For PDFs: inline       | Document date: [ 2025-11-09 ]                        |
|  viewer / iframe)       | Uploaded at:  2025-11-10 09:12                       |
|                          | Uploaded by:  Nathan                                |
|                          |                                                     |
|                          | [Save changes]                                      |
+--------------------------+-----------------------------------------------------+
| Linked Transactions                                                            |
|                                                                                |
| [Link to transactions]                                                         |
|                                                                                |
| 1) 2025-11-09  Taxi – Airport to Client Office                                 |
|    Amount: MYR 85.00   Type: EXPENSE                                           |
|    [View transaction]  [Unlink]                                                |
|                                                                                |
| 2) 2025-11-09  Client meeting lunch (split)                                    |
|    Amount: MYR 40.00   Type: EXPENSE                                           |
|    [View transaction]  [Unlink]                                                |
|                                                                                |
+----------------------------------------------------------------------------------+
```

Notes:
- “Download ▼” can open a small menu: “Download (attachment)”, “Open in new tab (inline)”.
- “Trash” moves the document to Trash (soft delete + unlink all transactions).

---

### 4. Screen: Transactions List with Document Indicators

```text
Route: /o/[orgSlug]/transactions

+----------------------------------------------------------------------------------+
| Transactions                                             [New Transaction]     |
+----------------------------------------------------------------------------------+
| Filters (date, type, status, vendor, amount, etc.)                             |
|                                                                                |
| [Apply] [Reset]                                                                |
+----------------------------------------------------------------------------------+
| List                                                                           |
|                                                                                |
| [ ] 2025-11-10  Invoice #123 – ACME Corp                                      |
|     INCOME · POSTED · MYR 1,000.00                                            |
|     Category: Consulting                                                      |
|     Vendor/Client: ACME Corp                                                  |
|     [📎 2] [Edit] [⋯]                                                         |
|                                                                                |
| [ ] 2025-11-09  Taxi – Airport to Client Office                               |
|     EXPENSE · POSTED · MYR 85.00                                              |
|     Category: Travel                                                          |
|     Vendor: Grab Taxi                                                         |
|     [📎 1] [Edit] [⋯]                                                         |
|                                                                                |
| [ ] 2025-11-08  Coffee with client                                            |
|     EXPENSE · DRAFT · MYR 15.00                                               |
|     Category: Meals                                                           |
|     Vendor: Starbucks                                                         |
|     [   ] [Edit] [⋯]  (no documents)                                         |
|                                                                                |
+----------------------------------------------------------------------------------+
| Bulk actions, pagination, etc.                                                |
+----------------------------------------------------------------------------------+
```

Notes:
- `[📎 N]` opens the transaction detail page or a quick overlay focused on documents.

---

### 5. Screen: Transaction Detail with Documents Panel

```text
Route: /o/[orgSlug]/transactions/[id]

+----------------------------------------------------------------------------------+
| [← Back to Transactions]                               [Save] [Delete]        |
+----------------------------------------------------------------------------------+
| Edit Transaction                                                              |
|                                                                                |
| Date:        [ 2025-11-09 ]                                                    |
| Type:        (• EXPENSE) (  INCOME )                                          |
| Status:      (• POSTED)  (  DRAFT )                                           |
| Amount:      [ 85.00 ]  Currency: [ MYR ]                                     |
| Category:    [ Travel ▾ ]                                                     |
| Account:     [ Maybank Business 1234 ▾ ]                                      |
| Vendor:      [ Grab Taxi ▾ ]                                                  |
| Description: [ Taxi – Airport to Client Office              ]                 |
| Notes:       [____________________________________________________]           |
|                                                                                |
+------------------------------+-------------------------------------------------+
| Documents                    | (optional: other side panel content)            |
|                              |                                                 |
| [Add existing document] [Upload & link]                                       |
|                                                                                |
| (If none)                                                                     |
|   No documents linked yet.                                                    |
|                                                                                |
| (If some linked)                                                              |
|   1) [🖼] taxi-receipt-2025-11-09.jpg                                         |
|      Date: 2025-11-09  Type: RECEIPT                                          |
|      [View] [Download] [Unlink]                                               |
|                                                                                |
|   2) [📄] bank-statement-2025-11.pdf                                          |
|      Date: 2025-11-30  Type: BANK_STATEMENT                                   |
|      [View] [Download] [Unlink]                                               |
|                                                                                |
+------------------------------+-------------------------------------------------+
```

Notes:
- “Upload & link” uses the same upload API, then auto-links returned document IDs to this transaction.

---

### 6. Screen: Document Picker (from Transaction Detail)

```text
Component: Document Picker Modal / Dialog

+--------------------------------------------------------------+
| [x] Attach existing documents                                |
+--------------------------------------------------------------+
| Search: [ 🔍 invoice, vendor, text...              ]         |
|                                                              |
| Linked filter: (• All) (  Unlinked only  )                    |
| Date range: [ From: ____ ] [ To: ____ ]                       |
| File type:  [ All types ▾ ]                                  |
|                                                              |
| [ ] [🖼] taxi-receipt-2025-11-09.jpg                          |
|     Date: 2025-11-09   Type: RECEIPT   Linked: 0             |
|                                                              |
| [ ] [📄] invoice-123-acme.pdf                                |
|     Date: 2025-11-10   Type: INVOICE   Linked: 1             |
|                                                              |
| [ ] [🖼] parking-receipt.png                                 |
|     Date: 2025-11-08   Type: RECEIPT   Linked: 0             |
|                                                              |
|  ...                                                         |
|                                                              |
+--------------------------------------------------------------+
| [Cancel]                                [Attach selected (3)] |
+--------------------------------------------------------------+
```

Notes:
- On confirm, call transaction-side link API with selected `documentIds`.

---

### 7. Screen: Documents Trash (`/o/[orgSlug]/documents/trash`)

```text
Route: /o/[orgSlug]/documents/trash

+----------------------------------------------------------------------------------+
| Documents Trash                                          [Back to Documents]    |
+----------------------------------------------------------------------------------+
| Deleted documents remain here until you restore or delete them permanently.     |
| Your organization’s retention policy may permanently delete old items.         |
|                                                                                |
| [Search: _____________________________ ]                                       |
|                                                                                |
+----------------------------------------------------------------------------------+
| List                                                                           |
|                                                                                |
| [ ] taxi-receipt-2025-11-09.jpg                                               |
|     Display name: Taxi – Airport to Client Office                             |
|     Deleted at: 2025-11-16 09:30                                              |
|     Type: RECEIPT · Image · 230 KB                                            |
|     [Restore] [Delete permanently]                                            |
|                                                                                |
| [ ] invoice-123-acme.pdf                                                      |
|     Display name: Invoice #123 – ACME Corp                                    |
|     Deleted at: 2025-11-15 14:02                                              |
|     Type: INVOICE · PDF · 420 KB                                              |
|     [Restore] [Delete permanently]                                            |
|                                                                                |
+----------------------------------------------------------------------------------+
| Bulk actions: [Restore selected] [Delete selected permanently]                |
|                                                                                |
+----------------------------------------------------------------------------------+
```

---

### 8. Download & Preview Usage

```text
Flow: Download / Preview

Documents List / Detail / Transaction Detail
	├─ User clicks [Download]
	│     → Browser navigates to
	│       /api/orgs/[orgSlug]/documents/[id]/download?mode=attachment
	│     → Server streams file with Content-Disposition: attachment
	│     → Browser shows save dialog
	│
	└─ User clicks [Open in new tab] or inline preview
				→ New tab or <iframe> src:
					/api/orgs/[orgSlug]/documents/[id]/download?mode=inline
				→ Server streams file with Content-Disposition: inline
				→ Browser renders PDF/image/text directly
```
