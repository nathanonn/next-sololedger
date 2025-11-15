# Wireframes – Transactions: Filters, Bulk, Trash

Below is the UX flow map and screen-by-screen ASCII wireframes for the Transactions filters, bulk actions, Trash, and soft-closed period behaviors.

## 1. UX Flow Map

```text
[Org Dashboard]
	|
	v
[Transactions List]
   |        |            |                |
   |        |            |                |
   |        |            |                +--> [Trash - Transactions]
   |        |            |
   |        |            +--> [Bulk Actions Dialogs]
   |        |                   - Change Category
   |        |                   - Change Status (soft-close confirm)
   |        |                   - Delete Selected (confirm)
   |        |                   - Export Selected CSV
   |        |
   |        +--> [Transaction Detail / Edit]
   |                 - Soft-closed warning & confirm
   |
   +--> [Advanced Filters]
		  - Category multi-select
		  - Vendor dropdown
		  - Client dropdown
		  - Amount range (base)
		  - Currency
		  - Date range
		  - Search
```

## 2. Transactions List – Main Screen

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header: Transactions                                                        │
│ Org: {Org Name}  |  [Back to Dashboard]                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ Filters Row 1                                                               │
│                                                                              │
│  Type: [ All v ]   Status: [ All v ]   Date: [ From ▢▢▢▢-▢▢-▢▢ ] [ To ▢▢▢▢-▢▢-▢▢ ] │
│                                                                              │
│ Filters Row 2                                                               │
│                                                                              │
│  Category: [ All categories ▾ ]   Vendor: [ All vendors ▾ ]                  │
│  Client:   [ All clients  ▾ ]    Currency: [ Any currency ▾ ]                │
│                                                                              │
│ Filters Row 3                                                               │
│                                                                              │
│  Amount (base):  Min [ ▢▢▢▢▢ ]   Max [ ▢▢▢▢▢ ]                               │
│  Search: [ Description, category, client, vendor...              ]          │
│                                                                              │
│ [ Apply Filters ]   [ Reset ]                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ Bulk Selection Toolbar (shown only when ≥1 row selected)                    │
│                                                                              │
│  ● 3 selected                                                                │
│  [ Change category ]  [ Change status ]  [ Delete selected ]  [ Export CSV ] │
├──────────────────────────────────────────────────────────────────────────────┤
│ Transactions Table/List                                                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ [☐] | Date       | Description / Party      | Category   | Amount      │  │
│  │─────┼────────────┼──────────────────────────┼────────────┼─────────────│  │
│  │ [☐] | 2025-11-02 | Website hosting (Vendor) | Software   | -120.00 USD │  │
│  │     |            | Status: POSTED  Type: EXPENSE                        │  │
│  │─────┼────────────┼──────────────────────────┼────────────┼─────────────│  │
│  │ [☐] | 2025-11-01 | Consulting (Client)      | Income     |  800.00 USD │  │
│  │     |            | Status: DRAFT   Type: INCOME                         │  │
│  │─────┼────────────┼──────────────────────────┼────────────┼─────────────│  │
│  │ [☐] | ...        | ...                      | ...        |   ...       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Footer: [ ◀ Prev ]  Page 1 of N  [ Next ▶ ]   |  [ Go to Trash ▸ ]         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Category Multi-Select Popover

```text
Category: [ 3 categories selected ▾ ]

On click:

┌──────────────────────────────┐
│ Categories                   │
│ ───────────────────────────  │
│ [☑] All categories          │
│ [ ] Advertising             │
│ [☑] Software                │
│ [ ] Travel                  │
│ [☑] Consulting Income       │
│ [ ] Other                   │
│                              │
│ [ Clear ]             [ Apply ]
└──────────────────────────────┘
```

### 2.2 Vendor / Client Dropdowns

```text
Vendor: [ All vendors ▾ ]

On click:

┌──────────────────────────────┐
│ Vendors                      │
│ ───────────────────────────  │
│ (All vendors)                │
│ ───────────────────────────  │
│ Acme Hosting                 │
│ Figma Inc                    │
│ Local Print Shop             │
│ ...                          │
└──────────────────────────────┘

Client: [ All clients ▾ ]
(similar pattern to Vendor)
```

## 3. Bulk Actions – Dialogs

### 3.1 Bulk Change Category Dialog

```text
┌─────────────────────────────────────────────┐
│ Change Category for 3 Transactions          │
├─────────────────────────────────────────────┤
│ New Category                                │
│                                             │
│ [ ▾ Select category... ]                    │
│                                             │
│ Info: This will update the category for all │
│ selected transactions.                      │
├─────────────────────────────────────────────┤
│ [ Cancel ]                         [ Update ]│
└─────────────────────────────────────────────┘
```

### 3.2 Bulk Change Status Dialog (with Soft-Close Warning)

```text
┌───────────────────────────────────────────────────────────┐
│ Change Status for 5 Transactions                          │
├───────────────────────────────────────────────────────────┤
│ New Status                                                │
│                                                           │
│ ( ) Draft                                                 │
│ (•) Posted                                                │
│                                                           │
│ ⚠ 2 of the selected transactions are POSTED in           │
│   soft-closed periods. Changing their status may affect   │
│   previously reported figures.                            │
│                                                           │
│ Please confirm you want to override soft-closed periods.  │
├───────────────────────────────────────────────────────────┤
│ [ Cancel ]                             [ Confirm & Update ]│
└───────────────────────────────────────────────────────────┘
```

### 3.3 Bulk Delete Confirmation Dialog

```text
┌─────────────────────────────────────────────┐
│ Delete 4 Transactions                       │
├─────────────────────────────────────────────┤
│ These transactions will be moved to Trash.  │
│ You can restore them later from the Trash.  │
│                                             │
│ Are you sure you want to continue?          │
├─────────────────────────────────────────────┤
│ [ Cancel ]                         [ Delete ]│
└─────────────────────────────────────────────┘
```

## 4. Transaction Detail / Edit Screen

```text
┌────────────────────────────────────────────────────────────┐
│ Header: Edit Transaction                                  │
│ [◀ Back to Transactions]                                 │
├────────────────────────────────────────────────────────────┤
│ Soft-Closed Warning (only when applicable)                │
│                                                            │
│ ⚠ This transaction is POSTED in a soft-closed period.      │
│   Editing it may affect previously reported figures.       │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ Form                                                      │
│                                                            │
│ Type:   [ INCOME v ]  Status: [ POSTED v ]                 │
│ Date:   [ 2025-10-15      ]                                │
│ Amount: [ 800.00     ]  Currency: [ USD v ]                │
│ Category: [ Consulting Income v ]                          │
│ Account:  [ Main Bank v ]                                  │
│ Client:   [ Acme Corp v ]                                  │
│ Vendor:   [ —           ]                                  │
│ Description: [ Consulting for October ...           ]      │
│ Notes:       [ Optional notes ...                   ]      │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ Actions                                                    │
│                                                            │
│ [ Cancel ]                                 [ Save Changes ]│
└────────────────────────────────────────────────────────────┘
```

### 4.1 Soft-Closed Edit Confirmation Dialog

```text
┌───────────────────────────────────────────────────────────┐
│ Edit Posted Transaction in Soft-Closed Period             │
├───────────────────────────────────────────────────────────┤
│ This transaction is POSTED in a soft-closed period.       │
│ Changing it may alter previously reported figures.        │
│                                                           │
│ Are you sure you want to proceed?                         │
├───────────────────────────────────────────────────────────┤
│ [ Cancel ]                             [ Confirm & Save ]  │
└───────────────────────────────────────────────────────────┘
```

## 5. Trash – Transactions Screen

```text
┌────────────────────────────────────────────────────────────┐
│ Header: Trash – Transactions                              │
│ Org: {Org Name}                                           │
│ [◀ Back to Transactions]                                 │
├────────────────────────────────────────────────────────────┤
│ Filters                                                   │
│                                                            │
│ Deleted Date: [ From ▢▢▢▢-▢▢-▢▢ ] [ To ▢▢▢▢-▢▢-▢▢ ]          │
│ Type: [ All v ]   Search: [ Description, vendor, client ] │
│                                                            │
│ [ Apply Filters ]   [ Reset ]                             │
├────────────────────────────────────────────────────────────┤
│ Trash List                                                │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Date       | Description           | Deleted At      │   │
│  │────────────┼───────────────────────┼─────────────────│   │
│  │ 2025-10-10 | Website hosting       | 2025-11-01 09:21│   │
│  │            | Vendor: Acme Hosting  |                 │   │
│  │            | Type: EXPENSE        | Status: POSTED  │   │
│  │            | [ Restore ] [ Delete permanently ]      │   │
│  │────────────┼───────────────────────┼─────────────────│   │
│  │ 2025-09-30 | Consulting September  | 2025-10-15 14:03│   │
│  │            | Client: Acme Corp     |                 │   │
│  │            | Type: INCOME         | Status: DRAFT   │   │
│  │            | [ Restore ] [ Delete permanently ]      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                            │
│ Footer: [ ◀ Prev ]  Page 1 of N  [ Next ▶ ]                │
└────────────────────────────────────────────────────────────┘
```

### 5.1 Permanent Delete Confirmation Dialog

```text
┌───────────────────────────────────────────────────────────┐
│ Permanently Delete Transaction                            │
├───────────────────────────────────────────────────────────┤
│ This will permanently delete the transaction and any      │
│ related links. This action cannot be undone.              │
│                                                           │
│ Are you sure you want to continue?                        │
├───────────────────────────────────────────────────────────┤
│ [ Cancel ]                             [ Delete forever ] │
└───────────────────────────────────────────────────────────┘
```

