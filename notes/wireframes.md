## Advanced ZIP Transaction Import – UX Flow and Wireframes

### 1. High-Level Flow Map (CSV vs ZIP)

```text
User on Transactions List
        |
        v
[Click "Import CSV/ZIP" button]
        |
        v
Step 1 – Upload & Mode (Dialog)
        |  - Choose import mode: CSV vs ZIP
        |  - CSV mode:
        |      • Select CSV file
        |      • Direction mode (Type vs Sign)
        |      • Date / delimiter / separators
        |      • (Optional) Saved mapping template
        |
        |  - ZIP mode:
        |      • Select ZIP file
        |      • ZIP must contain `transactions.csv`
        |      • Optional document files (e.g. `OpenAI/*.pdf`)
        |      • Same parsing options as CSV
        |      • (Optional) Saved mapping template
        |
        +--> If template has full mapping → call Preview API directly
        |
        v
Step 2 – Mapping (Dialog)
        |  - Map CSV columns to Sololedger fields
        |  - Includes optional "Document (path in ZIP)" field
        |  - Save mapping as template (optional)
        |
        v
[Preview Import API]
        |
        v
Step 3 – Review & Duplicates (Dialog)
        |  - Show summary counts
        |  - Show rows with status (valid / invalid / duplicate)
        |  - For duplicates: choose Import vs Skip
        |  - For ZIP mode:
        |      • Invalid rows if document path missing in ZIP
        |      • Invalid rows if doc too large or unsupported
        |
        v
[Commit Import API]
        |
        v
CSV mode: create transactions only
ZIP mode: create transactions + upload/link documents
        |
        v
Toast: "Imported X, skipped Y invalid, Z duplicates"
Transactions list refreshes
```

### 2. Screen – Transactions List with Import CSV/ZIP Entry

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Transactions – [Org Name]                                           │
├──────────────────────────────────────────────────────────────────────┤
│ Filters: [Date range] [Type] [Status] [Account] [Search .........]  │
│                                                                      │
│ Actions: [ + New Transaction ]  [ Import CSV/ZIP ]  [ Bulk Actions ▾]│
│          [ Export CSV ]                                             │
├──────────────────────────────────────────────────────────────────────┤
│ Transactions Table                                                   │
│ ┌───────┬────────────┬─────────────┬───────────────┬──────────────┐ │
│ │ Sel   │ Date       │ Description │ Category      │ Amount (Base)│ │
│ ├───────┼────────────┼─────────────┼───────────────┼──────────────┤ │
│ │ [ ]   │ 2025-10-30 │ OpenAI API  │ Software & Sub│ MYR 150.00   │ │
│ │ [ ]   │ 2025-10-25 │ ChatGPT Plus│ Software & Sub│ MYR 96.00    │ │
│ │ ...                                                             │ │
│ └───────┴────────────┴─────────────┴───────────────┴──────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 3. Screen – Import Wizard Step 1: Upload & Mode

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Dialog: Import Transactions                                         │
├──────────────────────────────────────────────────────────────────────┤
│ Title: Import Transactions                                          │
│ Subtitle: Import from a CSV file or a ZIP bundle with documents.    │
├──────────────────────────────────────────────────────────────────────┤
│ [1] Import Mode                                                     │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ Import mode:                                                     ││
│ │   (●) Standard CSV                                               ││
│ │   ( ) Advanced ZIP (CSV + documents)                             ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│ [2] File                                                             │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │  Drag & drop file here, or                                       ││
│ │  [ Choose File ]                                                 ││
│ │                                                                  ││
│ │  When in Standard CSV mode:                                      ││
│ │    • Accepted formats: .csv                                      ││
│ │    • Max size: 10 MB                                             ││
│ │                                                                  ││
│ │  When in Advanced ZIP mode:                                      ││
│ │    • Accepted formats: .zip                                      ││
│ │    • ZIP must contain:                                           ││
│ │        - transactions.csv                                        ││
│ │        - Optional folders (e.g. OpenAI/, Google/) with docs      ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│ [3] Mapping Template (optional)                                     │
│  Template: [ None ▾ ]                                               │
│    - "Maybank CSV"                                                  │
│    - "OpenAI API Export"                                            │
│                                                                      │
│ [4] Parsing Options                                                 │
│  Direction mode:                                                    │
│    ( ) Use Type column (INCOME/EXPENSE)                             │
│    ( ) Infer from Amount sign (positive = income, negative = exp.)  │
│                                                                      │
│  Date format:         [ YYYY-MM-DD ▾ ]                              │
│  Decimal separator:   [ . ▾ ]                                       │
│  Thousands separator: [ , ▾ ]                                       │
│  CSV delimiter:       [ , ]                                         │
├──────────────────────────────────────────────────────────────────────┤
│ [Cancel]                                      [Continue ▸]           │
└──────────────────────────────────────────────────────────────────────┘
```

### 4. Screen – Import Wizard Step 2: Mapping (with Document Column)

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Dialog: Map CSV Columns                                             │
├──────────────────────────────────────────────────────────────────────┤
│ Title: Map CSV Columns                                              │
│ Subtitle: Tell Sololedger how your CSV columns map to fields.       │
├──────────────────────────────────────────────────────────────────────┤
│ Left: Field Mapping                                                 │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ Sololedger Field         | CSV Column [ ▾ ]                     ││
│ │--------------------------------------------------------------- ││
│ │ Date *                   | [ date                    ▾ ]       ││
│ │ Amount *                 | [ amount                  ▾ ]       ││
│ │ Currency *               | [ currency                ▾ ]       ││
│ │ Type (if used) *         | [ type                    ▾ ]       ││
│ │ Description *            | [ description             ▾ ]       ││
│ │ Category *               | [ category                ▾ ]       ││
│ │ Account *                | [ account                 ▾ ]       ││
│ │ Vendor (Expenses)        | [ vendor                  ▾ ]       ││
│ │ Client (Income)          | [ client                  ▾ ]       ││
│ │ Notes                    | [ notes                   ▾ ]       ││
│ │ Tags                     | [ tags                    ▾ ]       ││
│ │ Secondary Amount         | [ secondaryAmount         ▾ ]       ││
│ │ Secondary Currency       | [ secondaryCurrency       ▾ ]       ││
│ │ Document (path in ZIP)   | [ document                ▾ ]       ││
│ │   (optional; e.g. "OpenAI/DHUENf-0011.pdf")                    ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│ Right: Sample CSV Rows                                               │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │   date       | amount | currency | description   | document     ││
│ │--------------------------------------------------------------- ││
│ │ 2025-10-30   | 150.00 | MYR      | OpenAI API... | OpenAI/...  ││
│ │ 2025-10-25   |  96.00 | MYR      | ChatGPT Plus  | OpenAI/...  ││
│ │ 2025-10-22   |  75.00 | MYR      | Google Ads... | Google/...  ││
│ └──────────────────────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────────────────┤
│ [◂ Back]             [Save Mapping as Template]     [Preview Import ▸]│
└──────────────────────────────────────────────────────────────────────┘
```

### 5. Screen – Import Wizard Step 3: Review & Duplicates (ZIP-Aware)

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Dialog: Review Import                                               │
├──────────────────────────────────────────────────────────────────────┤
│ Title: Review Import                                                │
│ Subtitle: Check for issues and duplicates before importing.         │
├──────────────────────────────────────────────────────────────────────┤
│ Summary                                                              │
│  • Total rows parsed: 4                                             │
│  • Valid rows: 4                                                    │
│  • Invalid rows: 0                                                  │
│  • Duplicate candidates: 1                                          │
│  • Mode: Advanced ZIP (CSV + documents)                             │
├──────────────────────────────────────────────────────────────────────┤
│ Rows (paginated)                                                    │
│ ┌────┬────────────┬───────────────┬───────────────┬───────────────┬───────┐│
│ │ #  │ Date       │ Description   │ Amount (Base) │ Document Path │Status ││
│ ├────┼────────────┼───────────────┼───────────────┼───────────────┼───────┤│
│ │  1 │ 2025-10-30 │ OpenAI API... │ MYR 150.00    │ OpenAI/DHUE.. │Valid  ││
│ │  2 │ 2025-10-25 │ ChatGPT Plus  │ MYR 96.00     │ OpenAI/DHUE.. │Dup?  ││
│ │  3 │ 2025-10-22 │ Google Ads... │ MYR 75.00     │ Google/239413 │Valid  ││
│ │  4 │ 2025-10-02 │ Google Worksp │ MYR 200.00    │ Google/239414 │Valid  ││
│ └────┴────────────┴───────────────┴───────────────┴───────────────┴───────┘│
│                                                                      │
│ For duplicate rows:                                                  │
│  Row 2 potential duplicate of existing transaction:                  │
│    • Existing: 2025-10-25, MYR 96.00, "ChatGPT Plus subscription"    │
│                                                                      │
│  Decision: [ Skip (default) ▾ ]                                      │
│             ( Import anyway )                                        │
├──────────────────────────────────────────────────────────────────────┤
│ [◂ Back]                                [Import 3 Rows ▸]            │
│   (3 rows = 3 non-duplicates + any duplicates set to "Import")       │
└──────────────────────────────────────────────────────────────────────┘
```

### 6. Screen – Result Toast & Linked Documents (Conceptual)

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Toast (top-right):                                                  │
│  "Imported 3 transactions. Skipped 0 invalid and 1 duplicate."      │
│   Details:                                                          │
│    - Documents uploaded: 4                                          │
│    - Document links created: 4                                      │
└──────────────────────────────────────────────────────────────────────┘

In the Transaction Details view for an imported row:

┌──────────────────────────────────────────────────────────────────────┐
│ Documents Panel                                                     │
├──────────────────────────────────────────────────────────────────────┤
│ Documents                                                           │
│ [ Upload & Link ]   [ Add Existing ]                                │
│                                                                      │
│ • OpenAI/DHUENf-0011.pdf   [View] [Download] [Unlink]               │
│ • Google/239413.pdf        [View] [Download] [Unlink]               │
└──────────────────────────────────────────────────────────────────────┘
```

