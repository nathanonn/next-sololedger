# AI Document Processing – UX Flow & Wireframes

This document describes the UX flow and screen-by-screen ASCII wireframes for AI-powered document upload, extraction, review, and saving into transactions. It builds on the existing documents and transactions UI patterns and assumes AI is configured for the organization.

---

## 1. High-Level UX Flow

```text
[Documents List]
	↓ (Upload receipts/invoices/statements)
	↓ (Run AI Extraction on a document)

[Run Extraction Dialog]
	- Choose template (Receipt / Invoice / Bank Statement Page / Custom)
	- Optional custom prompt
	- Optional provider/model override (advanced)
	↓
	↓
[Extraction In Progress]
	- Progress: Reading document → Extracting fields → Preparing summary
	- Message: "Usually takes a few seconds"
	↓
	↓
[AI Review Screen]
	- Split-view: Document preview (left), Extracted fields (right)
	- Confidence indicators per field
	- Ability to correct fields and line items
	- Choose Save Option:
		• Create new transaction(s)
		• Update existing transaction
		• Save as draft (document only)
	↓
	↓
[Post-Save]
	- Confirmation
	- Links to created/updated transactions
	- Option to stay in review or navigate

Reprocessing:
	- From Document detail/AI section → View history → Re-run extraction with different template/prompt → Choose active extraction and (optionally) re-save.
```

---

## 2. Screen: Documents List (with AI Entry Points)

Route: `/o/[orgSlug]/documents`

```text
┌───────────────────────────────────────────────────────────────────────┐
│  Documents                                                            │
│  Manage your receipts and financial documents                         │
├───────────────────────────────────────────────────────────────────────┤
│  [ Drag & drop files here to upload ]  [ Browse files ]  [ Trash ]    │
│   (JPEG, PNG, PDF, TXT · Max 10 MB per file)                          │
├───────────────────────────────────────────────────────────────────────┤
│  Filters                                                              │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┬─────────┐ │
│  │ Date range  │ Linked      │ File type   │ Vendor      │ Search  │ │
│  └─────────────┴─────────────┴─────────────┴─────────────┴─────────┘ │
├───────────────────────────────────────────────────────────────────────┤
│  Documents                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ Thumbnail │ Name                    │ Type  │ Date   │ Actions │ │
│  ├───────────┼─────────────────────────┼───────┼────────┼────────┤ │
│  │ [img]     │ receipt-2025-11-01.jpg │ RECEIP│ 01 Nov │ [View ]│ │
│  │           │                         │ T     │ 2025   │ [AI ▶]│ │
│  ├───────────┼─────────────────────────┼───────┼────────┼────────┤ │
│  │ [pdf]     │ invoice-ACME-1001.pdf  │ INVOICE│ 05 Nov│ [View ]│ │
│  │           │                         │       │ 2025  │ [AI ▶]│ │
│  ├───────────┼─────────────────────────┼───────┼────────┼────────┤ │
│  │ [txt]     │ bank-statement.txt     │ BANK_S│ 10 Nov │ [View ]│ │
│  │           │                         │ TMT   │ 2025  │ [AI ▶]│ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Legend: [AI ▶] = "Run AI Extraction" action                         │
└───────────────────────────────────────────────────────────────────────┘
```

Interaction notes:

- Drag-and-drop or `Browse files` triggers the existing upload flow; after upload, new rows appear.
- `AI ▶` opens the Run Extraction dialog for the selected document.
- `View` navigates to Document Detail.

---

## 3. Screen: Run Extraction Dialog

Triggered from: Documents List row action or Document Detail AI section.

```text
┌───────────────────────────────────── Run AI Extraction ───────────────┐
│ Document: invoice-ACME-1001.pdf                                      │
├───────────────────────────────────────────────────────────────────────┤
│ Template                                                              │
│  ( ) Standard Receipt                                                 │
│  (•) Invoice                                                          │
│  ( ) Bank Statement Page                                              │
│  ( ) Custom                                                           │
│                                                                       │
│ Custom prompt (optional)                                              │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │ e.g. "This invoice includes discounts and multiple tax rates…"│    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│ Prompt history                                                        │
│  [▼ Last used prompts]                                                │
│  - Invoice: Standard B2B template                                     │
│  - Bank statement (US checking)                                       │
│                                                                       │
│ Advanced (optional)                                                   │
│  Provider: [ OpenAI ▼ ]   Model: [ gpt-5-mini ▼ ]                   │
│                                                                       │
│ [ Cancel ]                                        [ Run Extraction ]  │
└───────────────────────────────────────────────────────────────────────┘
```

Interaction notes:

- Choosing a template pre-fills internal prompt instructions; custom prompt text is appended.
- Prompt history opens a dropdown/list of previous prompt+template combinations for quick reuse.

---

## 4. Screen: Extraction In Progress

Shown after submitting Run Extraction; can be a full-screen overlay or inline in the AI Review route while waiting.

```text
┌──────────────────────────────── AI Extraction in Progress ────────────┐
│ Document: invoice-ACME-1001.pdf                                      │
├───────────────────────────────────────────────────────────────────────┤
│  [●] Reading document                                                │
│  [○] Extracting fields                                               │
│  [○] Preparing summary                                               │
│                                                                       │
│  Usually takes a few seconds. You can keep this tab open.            │
│                                                                       │
│  If this takes unusually long, you can cancel and retry.             │
│                                                                       │
│  [ Cancel ]                                                           │
└───────────────────────────────────────────────────────────────────────┘
```

Interaction notes:

- Frontend stages progress locally (no strict server phases), updating as the API call completes.
- On error, content is replaced with an error panel (see below).

---

## 5. Screen: Extraction Failed (Retry & Prompt Adjust)

```text
┌───────────────────────────── AI Extraction Failed ────────────────────┐
│ Document: invoice-ACME-1001.pdf                                      │
├───────────────────────────────────────────────────────────────────────┤
│  We couldn't extract data from this document.                         │
│                                                                       │
│  Error: [Human-readable error message from API]                       │
│                                                                       │
│  Suggestions:                                                         │
│  - Try a different template (e.g. Bank Statement vs Invoice).         │
│  - Adjust your custom prompt to clarify the document type.            │
│                                                                       │
│  [ Edit template/prompt ]   [ Retry with same settings ]   [ Close ]  │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 6. Screen: Document Detail with AI Section

Route: `/o/[orgSlug]/documents/[id]`

```text
┌──────────────────────────────── Document Detail ──────────────────────┐
│  ← Back to Documents                                                  │
├───────────────────────────────────────────────────────────────────────┤
│  Document header                                                      │
│  Name: invoice-ACME-1001.pdf                                         │
│  Type: INVOICE  ·  Uploaded: 05 Nov 2025  ·  Size: 325 KB             │
├───────────────────────────────────────────────────────────────────────┤
│  Tabs: [ Details ]  [ Linked Transactions ]  [ AI Extraction ]        │
├───────────────────────────────────────────────────────────────────────┤
│  [ AI Extraction ]                                                    │
│                                                                       │
│  Latest extraction                                                    │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │ Template: Invoice  ·  Run at: 05 Nov 2025, 10:32              │    │
│  │ Overall confidence: HIGH                                      │    │
│  │ Summary: 1 transaction · Total 1,250.00 USD                   │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  [ Review & Save ]  [ Run new extraction ]  [ View history ▾ ]       │
│                                                                       │
│  History (dropdown / side panel)                                     │
│  - 05 Nov 10:32 · Invoice · High confidence                          │
│  - 05 Nov 10:20 · Invoice · Medium confidence (older)                │
│  - 04 Nov 18:05 · Custom prompt                                      │
└───────────────────────────────────────────────────────────────────────┘
```

Interaction notes:

- `Review & Save` navigates to the AI Review screen.
- `Run new extraction` opens the Run Extraction dialog pre-filled with last settings.
- `View history` allows choosing a previous extraction as active.

---

## 7. Screen: AI Review (Split Screen)

Route: `/o/[orgSlug]/documents/[id]/ai` (or equivalent subview).

```text
┌────────────────────────────── AI Review – invoice-ACME-1001.pdf ─────┐
│  ← Back to Document                                                   │
├───────────────────────────────────────────────────────────────────────┤
│  Layout:                                                              │
│  ┌───────────────────────────────┬─────────────────────────────────┐ │
│  │  Left: Document viewer        │ Right: Extracted data           │ │
│  ├───────────────────────────────┼─────────────────────────────────┤ │
│  │  ┌─────────────────────────┐  │ Summary                        │ │
│  │  │ [Zoom -] [100%] [Zoom+]│  │ ┌───────────────────────────┐  │ │
│  │  │ ┌───────────────────┐  │  │ │ Vendor: [ ACME Corp    ]  │  │ │
│  │  │ │  PDF/Image view   │  │  │ │    [HIGH]                │  │ │
│  │  │ │  (scrollable)     │  │  │ ├───────────────────────────┤  │ │
│  │  │ └───────────────────┘  │  │ │ Client: [ Sololedger Ltd ]│  │ │
│  │  └─────────────────────────┘  │ │    [MEDIUM]              │  │ │
│  │                               │ ├───────────────────────────┤  │ │
│  │                               │ │ Date:   [ 2025-11-05   ] │  │ │
│  │                               │ │    [HIGH]                │  │ │
│  │                               │ ├───────────────────────────┤  │ │
│  │                               │ │ Currency: [ USD ▼      ] │  │ │
│  │                               │ │    [HIGH]                │  │ │
│  │                               │ └───────────────────────────┘  │ │
│  │                               │                                 │ │
│  │                               │ Amounts & Taxes                 │ │
│  │                               │ ┌───────────────────────────┐  │ │
│  │                               │ │ Total:  [ 1,250.00 ] [H] │  │ │
│  │                               │ │ Net:    [ 1,000.00 ] [M] │  │ │
│  │                               │ │ Tax:    [   250.00 ] [M] │  │ │
│  │                               │ │ Tip:    [     0.00 ] [L] │  │ │
│  │                               │ └───────────────────────────┘  │ │
│  │                               │                                 │ │
│  │                               │ Line items                     │ │
│  │                               │ ┌───────────────────────────┐  │ │
│  │                               │ │ Desc     Qty   Unit  Total│  │ │
│  │                               │ │ [Text]  [1]  [500] [500] │  │ │
│  │                               │ │ [Text]  [1]  [750] [750] │  │ │
│  │                               │ │ Category: [ Services ▼ ] │  │ │
│  │                               │ └───────────────────────────┘  │ │
│  │                               │                                 │ │
│  │                               │ Split options                  │ │
│  │                               │ [ ] Split into multiple transactions    │ │
│  │                               │    (tooltip explaining behavior)        │ │
│  └───────────────────────────────┴─────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────────────┤
│ Save options                                                          │
│  ( ) Create new transaction(s)                                        │
│  ( ) Update existing transaction                                      │
│  (•) Save as draft (document only)                                    │
│                                                                       │
│  When "Create new transaction(s)" is selected:                        │
│   - [ ] Use single transaction (sum all items)                        │
│   - [ ] Use multiple transactions (per line item/category)            │
│                                                                       │
│  When "Update existing transaction" is selected:                      │
│   - [ Select transaction ▾ ]                                          │
│   - Show diff panel (current vs extracted) with checkboxes per field. │
│                                                                       │
│ [ Cancel ]                                             [ Save ]       │
└───────────────────────────────────────────────────────────────────────┘
```

Interaction notes:

- Confidence indicators `[H]`, `[M]`, `[L]` map to high/medium/low; visually rendered as colored badges.
- Every field is editable; low-confidence fields may start highlighted for attention.
- Save button triggers appropriate backend flow based on selected option.

---

## 8. Screen: Update Existing Transaction (Diff Panel)

Shown when user selects "Update existing transaction" in the AI Review screen.

```text
┌───────────────────── Update Existing Transaction from Extraction ─────┐
│ Transaction: EXP-2025-1105-001 (Draft)                                │
├───────────────────────────────────────────────────────────────────────┤
│ Choose fields to overwrite with AI-extracted values:                  │
│                                                                       │
│ [ ] Date                                                              │
│     Current: 2025-11-05                                               │
│     Extracted: 2025-11-06 (M)                                         │
│                                                                       │
│ [x] Description                                                       │
│     Current: "Office supplies"                                       │
│     Extracted: "Office supplies – ACME Corp invoice 1001" (H)        │
│                                                                       │
│ [x] Amount                                                             │
│     Current: 1,000.00 USD                                             │
│     Extracted: 1,250.00 USD (H)                                       │
│                                                                       │
│ [ ] Vendor                                                             │
│     Current: None                                                     │
│     Extracted: ACME Corp (M)                                         │
│                                                                       │
│ [ ] Category                                                           │
│     Current: "General Expenses"                                      │
│     Extracted suggestion: "Office Supplies" (M)                      │
│                                                                       │
│ [ Cancel ]                                          [ Apply changes ] │
└───────────────────────────────────────────────────────────────────────┘
```

Interaction notes:

- Users explicitly select which fields to update to avoid overwriting intentional manual edits.

---

## 9. Screen: Save Confirmation

```text
┌────────────────────────────── Extraction Saved ───────────────────────┐
│ AI extraction saved successfully.                                     │
├───────────────────────────────────────────────────────────────────────┤
│ Summary                                                               │
│  - Created 2 draft transactions:                                      │
│      • EXP-2025-1105-001 (Office supplies)                            │
│      • EXP-2025-1105-002 (Software subscription)                      │
│  - Linked to document: invoice-ACME-1001.pdf                          │
│                                                                       │
│ [ View transactions ]   [ Stay on review ]   [ Back to document ]     │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 10. Reprocessing & History

Reprocessing is surfaced via the AI section on the Document Detail page and from the AI Review screen.

```text
┌──────────────────────────── AI Extraction History ────────────────────┐
│ Document: invoice-ACME-1001.pdf                                      │
├───────────────────────────────────────────────────────────────────────┤
│ Active extraction                                                     │
│  • 05 Nov 10:32 · Invoice · High confidence  · [Active]              │
│                                                                       │
│ Previous extractions                                                 │
│  • 05 Nov 10:20 · Invoice · Medium confidence  · [ Set active ]      │
│  • 04 Nov 18:05 · Custom prompt                                      │
│                                                                       │
│ [ Run new extraction ]                                                │
└───────────────────────────────────────────────────────────────────────┘
```

Interaction notes:

- Setting a previous extraction as active makes it the default in the AI Review screen and for subsequent save operations.
- Per-field diff/merge can be added in a later iteration; v1 uses full extraction selection and manual review.
