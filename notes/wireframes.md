## CSV Import & Backup – UX Flow and Wireframes

### 1. High-Level Flow Map

```text
User on Transactions List
        |
        v
[Click "Import CSV" button]
        |
        v
Step 1 – Upload & Options (Dialog)
        |  - Select CSV file
        |  - Choose direction mode (Type vs Sign)
        |  - Pick date/number format
        |  - (Optional) Select saved mapping template
        |
        +--> If template has full mapping → call Preview API directly
        |
        v
Step 2 – Mapping (Dialog)
        |  - Map CSV columns to Sololedger fields
        |  - Save mapping as template (optional)
        |
        v
[Preview Import API]
        |
        v
Step 3 – Review & Duplicates (Dialog)
        |  - Show summary counts
        |  - Show sample table with row status
        |  - For duplicates: choose Import vs Skip
        |
        v
[Commit Import API]
        |
        v
Toast: "Imported X, skipped Y"
Transactions list refreshes
```

### 2. Screen – Transactions List with Import Entry

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Transactions – [Org Name]                                           │
├──────────────────────────────────────────────────────────────────────┤
│ Filters: [Date range] [Type] [Status] [Account] [Search .........]  │
│                                                                      │
│ Actions: [ + New Transaction ]  [ Import CSV ]  [ Bulk Actions ▾ ]  │
│          [ Export CSV ]                                             │
├──────────────────────────────────────────────────────────────────────┤
│ Transactions Table                                                   │
│ ┌───────┬────────────┬─────────────┬───────────────┬──────────────┐ │
│ │ Sel   │ Date       │ Description │ Category      │ Amount (Base)│ │
│ ├───────┼────────────┼─────────────┼───────────────┼──────────────┤ │
│ │ [ ]   │ 2025-02-01 │ Hosting     │ Software      │ MYR 120.00   │ │
│ │ [ ]   │ 2025-02-01 │ Invoice #34 │ Client A      │ MYR 3,500.00 │ │
│ │ ...                                                             │ │
│ └───────┴────────────┴─────────────┴───────────────┴──────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 3. Screen – Import Wizard Step 1: Upload & Options

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Dialog: Import Transactions from CSV                                │
├──────────────────────────────────────────────────────────────────────┤
│ Title: Import Transactions from CSV                                 │
│ Subtitle: Upload a CSV export from your bank or accounting tool.   │
├──────────────────────────────────────────────────────────────────────┤
│ [1] File                                                            │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │  Drag & drop CSV here, or                                       ││
│ │  [ Choose File ]                                                ││
│ │                                                                  ││
│ │  • Accepted formats: .csv                                       ││
│ │  • Max size: 10 MB                                              ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│ [2] Mapping Template (optional)                                      │
│  Template: [ None ▾ ]                                                │
│    - "Maybank Business CSV"                                          │
│    - "Xero Export"                                                   │
│                                                                      │
│ [3] Direction Mode                                                   │
│  ( ) Use Type column (Income / Expense)                              │
│  ( ) Infer from Amount sign (positive = income, negative = expense)  │
│                                                                      │
│ [4] Formats                                                          │
│  Date format:     [ DD/MM/YYYY ▾ ]                                   │
│  Number format:   [ . as decimal, , as thousands ▾ ]                 │
│  CSV delimiter:   [ , ]                                              │
├──────────────────────────────────────────────────────────────────────┤
│ [Cancel]                                      [Continue ▸]           │
└──────────────────────────────────────────────────────────────────────┘
```

### 4. Screen – Import Wizard Step 2: Mapping

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Dialog: Map CSV Columns                                             │
├──────────────────────────────────────────────────────────────────────┤
│ Title: Map CSV Columns                                              │
│ Subtitle: Tell Sololedger how your CSV columns map to fields.       │
├──────────────────────────────────────────────────────────────────────┤
│ Left: Field Mapping                                                 │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ Sololedger Field       | CSV Column [ ▾ ]                       ││
│ │--------------------------------------------------------------- ││
│ │ Date *                 | [ transaction_date          ▾ ]       ││
│ │ Amount *               | [ amount                     ▾ ]       ││
│ │ Currency *             | [ currency                   ▾ ]       ││
│ │ Type (if used) *       | [ type                       ▾ ]       ││
│ │ Description *          | [ description                ▾ ]       ││
│ │ Category *             | [ category_name              ▾ ]       ││
│ │ Account *              | [ account_name               ▾ ]       ││
│ │ Vendor (Expenses)      | [ vendor                     ▾ ]       ││
│ │ Client (Income)        | [ client                     ▾ ]       ││
│ │ Notes                  | [ notes                      ▾ ]       ││
│ │ Tags                   | [ tags (semicolon separated) ▾ ]       ││
│ │ Secondary Amount       | [ foreign_amount             ▾ ]       ││
│ │ Secondary Currency     | [ foreign_currency           ▾ ]       ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│ Required fields must be mapped before continuing.                    │
│                                                                      │
│ Right: Sample Data                                                   │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ transaction_date | amount | currency | description      | ...   ││
│ │--------------------------------------------------------------- ││
│ │ 01/02/2025       | -120   | MYR      | Hosting invoice   | ...  ││
│ │ 01/02/2025       | 3500   | MYR      | Invoice #34       | ...  ││
│ │ ...                                                           ││
│ └──────────────────────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────────────────┤
│ [Back]      [ Save Mapping as Template ]         [Preview Import ▸]  │
└──────────────────────────────────────────────────────────────────────┘
```

### 5. Screen – Import Wizard Step 3: Review & Duplicates

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Dialog: Review Import                                               │
├──────────────────────────────────────────────────────────────────────┤
│ Title: Review Import                                                │
│ Subtitle: Check for issues and duplicates before importing.         │
├──────────────────────────────────────────────────────────────────────┤
│ Summary                                                             │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ Total rows:            120                                      ││
│ │ Valid rows:            110                                      ││
│ │ Invalid rows:          5                                        ││
│ │ Possible duplicates:   5                                        ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│ Rows Preview                                                         │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ # | Date       | Description     | Amount   | Category | Status  ││
│ │---+----------- +----------------+----------+----------+--------- ││
│ │  1| 2025-02-01 | Hosting         | -120.00  | Software | OK      ││
│ │  2| 2025-02-01 | Invoice #34     | 3500.00  | Sales    | OK      ││
│ │  3| 2025-02-02 | Lunch           | -35.00   | Meals    | Invalid ││
│ │   |            |                 |          |          | (Missing││
│ │   |            |                 |          |          | category)││
│ │  4| 2025-02-02 | Subscription    | -50.00   | Software | Duplicate││
│ │   |            |                 |          |          | candidate││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│ For invalid rows                                                     │
│  - Show inline error message (“Missing category”, “Invalid currency”).│
│  - Note: “To import these rows, fix them in your CSV and re-import.” │
│                                                                      │
│ Duplicate handling panel (for selected duplicate row)                │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ Possible duplicate found                                         ││
│ │ Existing transaction:                                           ││
│ │  - Date:      2025-02-02                                        ││
│ │  - Amount:    MYR 50.00                                         ││
│ │  - Vendor:    Acme SaaS                                         ││
│ │  - Description: Subscription                                    ││
│ │                                                                  ││
│ │ How do you want to handle this imported row?                     ││
│ │  ( ) Import anyway (keep both)                                  ││
│ │  ( ) Skip imported row                                          ││
│ └──────────────────────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────────────────┤
│ [Back]                     [Import 110 rows ▸]                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 6. Screen – Data Export & Backup Panel (Settings)

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Settings – Business                                                 │
├──────────────────────────────────────────────────────────────────────┤
│ Section: Data Export & Backup                                       │
├──────────────────────────────────────────────────────────────────────┤
│ Title: Data Export & Backup                                         │
│ Subtitle: Download a complete snapshot of your Sololedger data for │
│           this business.                                            │
├──────────────────────────────────────────────────────────────────────┤
│ Export Format                                                       │
│  ( ) JSON (single file)                                             │
│  ( ) CSV (ZIP with multiple CSV files)                              │
│                                                                      │
│ Include                                                             │
│  [x] Transactions (all posted & draft, within date range)           │
│  [x] Categories                                                     │
│  [x] Vendors & Clients                                              │
│  [x] Accounts                                                       │
│  [x] Tags                                                           │
│  [ ] Document references (metadata & links)                         │
│                                                                      │
│ Date Range (for transactions)                                       │
│  From: [ 2024-01-01 ]    To: [ 2024-12-31 ]                          │
│  Hint: Leave blank to export all years.                             │
├──────────────────────────────────────────────────────────────────────┤
│ Info                                                                │
│  • Only admins can run full data exports.                           │
│  • Exports are read-only snapshots – importing back is not yet      │
│    supported.                                                       │
├──────────────────────────────────────────────────────────────────────┤
│ [Cancel]                                   [Download Backup ▸]      │
└──────────────────────────────────────────────────────────────────────┘
```
