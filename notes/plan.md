# AI-Powered Document Processing – Implementation Plan

This plan adds an AI-powered document extraction pipeline on top of the existing document management and AI infrastructure. It introduces a structured extraction backend (using AI SDK v5 and per-org AI configuration), a review-first UI for validating extracted fields, and save flows that always produce manually confirmed draft transactions or draft extractions. The goal is to keep the feature incremental, testable, and aligned with current Sololedger patterns (multi-tenant, Node-only AI calls, strict auth, and audit logging).

---

## 1. Data Model & Persistence

1.1 **New Prisma models**

- Add `DocumentExtraction` table (JSONB + a few indexed columns): - `id` (cuid) - `organizationId` (FK → Organization) - `documentId` (FK → Document) - `createdByUserId` (FK → User) - `status`: enum `RAW` | `REVIEWED_DRAFT` | `APPLIED` - `templateKey`: string | null (e.g. `standard_receipt`, `invoice`, `bank_statement_page`) - `customPrompt`: text | null - `provider`: enum `openai` | `gemini` | `anthropic` - `modelName`: string - `documentType`: enum `RECEIPT` | `INVOICE` | `BANK_STATEMENT` | `OTHER` - `summaryTotalAmount`: decimal | null (for quick filtering) - `summaryCurrency`: string | null (ISO 4217) - `summaryTransactionDate`: date | null - `overallConfidence`: numeric | null - `isActive`: boolean (only one active per document; DB constraint) - `payload`: JSONB (full extraction object) - `appliedTransactionIds`: string[] | JSONB of IDs (for reference only) - `createdAt`, `updatedAt`

  1.2 **Indexes & constraints**

- Indexes:
  - `(organizationId, documentId, isActive)`
  - `(organizationId, documentId, createdAt DESC)`
  - `(organizationId, documentType, summaryTransactionDate)`
  - `(organizationId, summaryCurrency)`
- Constraint to ensure at most one `isActive = true` per `(documentId)`.

  1.3 **Schema versioning**

- Include `schemaVersion` field in `payload` (e.g. `"v1"`) to support future schema evolution.
- Keep Zod schema definitions in a dedicated module (e.g. `lib/ai/document-schemas.ts`).

  1.4 **No schema changes to Transaction/Document for v1**

- Reuse existing `Transaction` and `Document` models.
- Link extractions to transactions via existing document–transaction link tables and `appliedTransactionIds` metadata on `DocumentExtraction` for traceability.

---

## 2. Extraction Schema & AI Prompt Design

2.1 **Define Zod schemas for extraction**

- Create `DocumentExtractionV1` schema in `lib/ai/document-schemas.ts` with: - `documentType`: literal union (`RECEIPT` | `INVOICE` | `BANK_STATEMENT` | `OTHER`). - `currencyCode`: `string | null` (ISO 4217). - `transactionDate`: `string | null` (ISO 8601). - `vendor`: `{ name: string | null; confidence: number | null }`. - `client`: `{ name: string | null; confidence: number | null }`. - `totals`: object with fields: - `grandTotal`, `netAmount`, `taxAmount`, `tipAmount` → `{ value: number | null; confidence: number; rawText: string | null }`. - `lineItems`: array of objects: - `description`: string | null - `quantity`: number | null - `unitPrice`: number | null - `lineTotal`: number | null - `taxAmount`: number | null - `categoryName`: string | null - `confidence`: number - `warnings`: `string[]`. - `overallConfidence`: number (0–1).

  2.2 **Confidence tier mapping**

- Map numeric confidence to UI tiers:
  - High: `≥ 0.8`
  - Medium: `0.5–0.79`
  - Low: `< 0.5`
- Keep numeric scores in `payload`; convert to tiers in the UI.

  2.3 **Prompt templates**

- Add `lib/ai/document-prompts.ts` with predefined templates:
  - `standard_receipt`
  - `invoice`
  - `bank_statement_page`
- Each template provides: - `system` message: financial extraction engine instructions (ISO dates/currencies, no hallucination, null for unknown, fill confidences). - `userIntro` text: tailored to the document type (e.g. “This is a retail receipt…”). - Optional `extraInstructions` for edge cases (discounts, multiple taxes, etc.).

  2.4 **Custom prompts & history**

- Allow callers to pass an optional `customPrompt` string to append to template instructions.
- Derive per-organization prompt history from `DocumentExtraction` records:
  - Distinct `(templateKey, customPrompt)` pairs.
  - Expose via API for reuse in UI.

---

## 3. Provider-Agnostic Extraction Pipeline

3.1 **Core server function: `extractDocument`**

- Create `lib/ai/document-extraction.ts` with a main function:
  - `extractDocument({ orgId, userId, provider, modelName, mimeType, fileBuffer, textFallback?, templateKey?, customPrompt?, documentTypeHint?, localeHint? }): Promise<ExtractionResult>`.
- Responsibilities: - Resolve AI provider/model via existing `requireOrgAiConfigForFeature("document_extraction")` and `getOrgProviderClient`. - Build a normalized internal representation of the document: - For `text/plain`: treat as plain text. - For `application/pdf`: run PDF text extraction (e.g. `pdf-parse`) and optionally generate one or two preview images (first pages) for layout hints. - For `image/*`: use base64 data URLs and optionally pass through an OCR library later. - Construct AI SDK `messages` for `generateObject`: - System message from chosen template. - User message with: - Instruction text (template + custom prompt). - Text content (full text or per-page markers). - Image parts for receipts/PDF pages as needed. - Call `generateObject` with the `DocumentExtractionV1` Zod schema. - Capture and return structured result + provider metadata (tokens, latency).

  3.2 **Provider-specific behavior inside abstraction**

- **OpenAI** (default for small receipts/invoices):
  - Preferred models: `gpt-5-mini` for more complex docs.
  - Use image+text multimodal messages for JPEG/PNG and small PDFs.
- **Gemini** (preferred for long PDFs/bank statements):
  - Preferred models: `gemini-2.5-flash` for cost-effective, `gemini-2.5-pro` for heavy usage.
  - Use long-context text input (entire statement or chunked ranges), optionally with page image snippets.
- **Anthropic** (optional validation or text-only docs): - Preferred models: `claude-4.5-haiku/sonnet`. - Mostly use text-only mode; optionally feed images for short receipts.

  3.3 **Error handling & retries**

- Wrap `generateObject` calls to: - Retry once on recoverable AI SDK parse errors. - Surface provider-specific errors in a normalized way to API callers (message + code). - Log full context (truncated prompt, model name, usage, correlation ID) to the existing AI logs tables.

  3.4 **Rate limiting**

- Use existing AI rate-limit helpers with a distinct feature key, e.g. `"document_extraction"`.
- Enforce per-org and per-IP rate limits on extraction APIs (e.g. X extractions per minute).

---

## 4. API Surface for Document Extraction

4.1 **Base routes (Node runtime)**

- Add API routes under `app/api/orgs/[orgSlug]/documents/[documentId]/ai/`: - `POST /extract` – run extraction for a specific document. - `GET /extractions` – list historical extractions for that document. - `GET /extractions/[extractionId]` – fetch one extraction (for review/compare).

  4.2 **`POST /extract` behavior**

- Input JSON:
  - `templateKey?: string` (must match known templates or `null`).
  - `customPrompt?: string`.
  - `provider?: "openai" | "gemini" | "anthropic"` (optional override).
  - `modelName?: string` (optional override).
  - `documentTypeHint?: "RECEIPT" | "INVOICE" | "BANK_STATEMENT" | "OTHER"`.
  - `localeHint?: string` (e.g. `"en-US"`).
- Steps: - Auth: use `getCurrentUser`, `getOrgBySlug`, `requireMembership`. - Load `Document` by `documentId` and ensure it belongs to org. - Enforce AI config via `requireOrgAiConfigForFeature("document_extraction")`. - Run rate limit. - Read file via `getDocumentStorage().getStream` and buffer it. - Call `extractDocument` with computed settings. - Persist a new `DocumentExtraction` row: - Status `RAW`. - `payload` from extraction object. - Summary fields (amount, currency, date, overall confidence, templateKey, customPrompt, provider, modelName). - `isActive = true` and set other extractions for this document to `isActive = false` in a transaction. - Respond with newly created extraction payload and metadata.

  4.3 **`GET /extractions` behavior**

- Auth & org checks as above.
- Return list of extractions for this document (most recent first), each including: - `id`, `status`, `templateKey`, `customPrompt`, `provider`, `modelName`, `overallConfidence`, `createdAt`, `isActive`.

  4.4 **`GET /extractions/[extractionId]` behavior**

- Return full `payload` + metadata for the chosen extraction.
- Used by review screen and reprocessing compare UI.

  4.5 **Error cases**

- No AI config for org → 400 with clear message and guidance to configure AI providers.
- Document not found or belongs to different org → 404/403.
- Rate limit exceeded → 429 with retry-after hint.
- Provider/model misconfiguration → 400 with human-readable error.

---

## 5. UI – Entry Points & Progress Feedback

5.1 **Documents list (`/o/[orgSlug]/documents`)**

- For each document row: - Add primary action: `Run AI Extraction` (if AI available for org). - On click: - Show small modal or inline drawer to choose: - Template: dropdown (Receipt / Invoice / Bank Statement Page / Custom). - Optional custom prompt textbox. - Optional model/provider override (advanced section). - After user confirms, call `POST /extract` and navigate to AI review screen when done.

  5.2 **Document detail (`/o/[orgSlug]/documents/[id]`)**

- Add an `AI Extraction` tab/section next to existing metadata and transaction links.
- Inside the `AI Extraction` section: - Show: - Last extraction summary (template, date, overall confidence). - `Run new extraction` button (same options as from the list). - `View history` link to open a side panel listing past extractions and prompt history.

  5.3 **Processing feedback**

- While `POST /extract` is running:
  - Show progress indicator with staged labels:
    - `Reading document`.
    - `Extracting fields`.
    - `Preparing summary`.
  - Show helper text: `"Usually takes a few seconds"` (no strict SLAs).
- On failure:
  - Display error explanation from API.
  - Provide `Retry` button (reuses same template/prompt) and an option to edit template/prompt.

---

## 6. Review & Validation UI

6.1 **Dedicated review screen**

- Route: extend `DocumentDetailPage` (`/o/[orgSlug]/documents/[id]`) with an `AI Review` subview, or add a nested route (e.g. `/o/[orgSlug]/documents/[id]/ai`).
- Layout: split screen using existing UI primitives: - **Left panel:** document viewer - Image/PDF viewer with zoom controls. - Uses `/api/orgs/[orgSlug]/documents/[documentId]/download?mode=inline`. - **Right panel:** extraction review form - Group fields into sections: Summary, Parties, Amounts & Taxes, Line Items, Additional Details.

  6.2 **Field widgets & confidence indicators**

- For each extracted field:
  - Editable control (Input, Textarea, Select, etc.).
  - Confidence badge using tier colors:
    - High (green), Medium (amber), Low (red).
  - Low-confidence or missing fields get a subtle highlight (border or icon).
- For vendor/client/category/account: - Show suggested name (read-only from extraction). - Provide dropdowns wired to existing vendor/client/category/account lookup APIs.

  6.3 **Line items & splitting options**

- Render line items as editable table:
  - Columns: description, quantity, unit price, line total, tax, category (select), confidence.
  - Allow adding/removing rows.
- Offer a `Split into multiple transactions` toggle: - When off: all line items mapped to a single transaction (if user chooses that save option). - When on: user can mark which line items belong to separate transactions (e.g. via grouping or category-based splitting).

  6.4 **Prompt history & reprocessing from review**

- In the review screen sidebar or header:
  - Show dropdown or dialog: `Prompt history` with list of past `(templateKey, customPrompt)` for this org.
  - Selecting an item pre-fills template and custom prompt; user can re-run extraction.

---

## 7. Save Options & Transaction Integration

7.1 **Save option controls**

- In the review screen, provide three mutually exclusive actions: - `Create new transaction(s)`. - `Update existing transaction`. - `Save as draft (document only)`.

  7.2 **Create new transaction(s)**

- Map reviewed extraction form → `Transaction` payload(s):
  - Always set `status: "DRAFT"` for AI-created transactions.
  - Determine currency, amount, date from reviewed values.
  - Resolve vendor/client/category/account via user selections.
- Support user choice between:
  - Single transaction: sum of all relevant line items and/or totals.
  - Multiple transactions: one per group of line items (e.g. by category or user grouping).
- Implementation: - Build one or more request bodies for `POST /api/orgs/[orgSlug]/transactions`. - After creating transactions, link them to document using existing APIs: - Either `POST /api/orgs/[orgSlug]/transactions/[transactionId]/documents` or `POST /api/orgs/[orgSlug]/documents/[documentId]/transactions`. - Update relevant `DocumentExtraction` record: - `status = "APPLIED"`. - `appliedTransactionIds` set to IDs of created transactions.

  7.3 **Update existing transaction**

- UI flow:
  - Provide a transaction picker (similar to link dialog) that lets user search and select an existing transaction.
  - Show diff view for selected transaction vs reviewed extraction:
    - Per field (date, description, amount, vendor, client, category, account) show `current value` vs `suggested value` and a `checkbox` to overwrite.
  - Clearly indicate that only checked fields will be updated.
- Backend: - Call existing transaction update API (or add a `PATCH` endpoint if necessary) with only selected fields. - Ensure transaction status remains unchanged (Draft/Posted). - Link document and transaction via existing linking APIs if not already linked. - Mark `DocumentExtraction.status` as `APPLIED` and store the updated transaction ID in `appliedTransactionIds`.

  7.4 **Save as draft (document only)**

- Behavior:
  - Persist current reviewed extraction form back into `DocumentExtraction.payload`.
  - Set `status = "REVIEWED_DRAFT"` and `appliedTransactionIds = []`.
  - Keep it `isActive = true` for the document.
- UX: - Show confirmation toast and keep user on review screen. - Next visits to this document’s AI section load this reviewed draft extraction by default.

  7.5 **Post-save navigation**

- After successful creation/update:
  - Option A: stay on review screen with a banner summarizing created/updated drafts and links to open them.
  - Option B: navigate to the transaction detail page(s) with anchors to the documents panel.
- Keep Option A as default to avoid disruptive navigation; provide quick links as secondary actions.

---

## 8. Reprocessing & Comparison

8.1 **Re-run extraction**

- From review or document AI section: - `Re-run AI extraction` button opens a dialog: - Choose template. - Optional custom prompt (pre-filled from history). - Optional model/provider override. - On confirm, call `POST /extract` again.

  8.2 **Active extraction selection**

- When a new extraction completes:
  - Set it as `isActive = true` for the document.
  - Keep previous extractions as history.
- UI defaults to active extraction in review view; user can switch to older ones via history list.

  8.3 **Comparison UX (full replace vs advanced merge)**

- Default behavior (v1):
  - When user chooses a different extraction from history, show a banner: `"You are viewing an older extraction"` with `Set as active` and `Use for save options` buttons.
  - Advanced per-field merge is a future enhancement.
- Design schemas and payloads such that per-field comparison is simple:
  - Same field names and shapes across all extractions.
  - Confidence scores available in all versions.

---

## 9. Permissions, Security, and Audit Logging

9.1 **Permissions**

- Extraction routes use the same auth level as document upload and linking: - `requireMembership` for running extractions and viewing results. - Respect organization boundaries on `Document` and `DocumentExtraction` queries.

  9.2 **Security & secrets**

- All AI calls remain server-side in Node runtime.
- Provider keys never sent to client; re-use existing AI provider abstraction.
- Ensure no raw file paths or storage keys are exposed in responses; only document IDs.

  9.3 **Audit logs**

- Add new audit actions:
  - `document.extraction.run` – when a user runs AI extraction.
  - `document.extraction.review.save` – when a reviewed draft is saved.
  - `document.extraction.apply.createTransaction` – when new transactions are created from extraction.
  - `document.extraction.apply.updateTransaction` – when an existing transaction is updated.
- Include metadata: `documentId`, `extractionId`, `transactionIds`, provider, model, and templateKey.

---

## 10. Testing & Rollout

10.1 **Backend tests**

- Add unit/integration tests for: - `extractDocument` (mock AI SDK responses). - `POST /documents/[documentId]/ai/extract` – happy path and error conditions. - `GET /extractions` and `GET /extractions/[id]`. - Save flows: create/update transactions from extraction, and save-as-draft behavior.

  10.2 **Frontend tests**

- Add focused tests (where existing patterns allow) for: - Running extraction from documents list and document detail. - Review form field binding and confidence highlighting. - Save options branching (create new, update existing, save draft).

  10.3 **Feature rollout**

- Initially enable for all orgs with AI providers configured.
- If needed, later introduce a per-org toggle in AI settings to enable/disable document extraction.

  10.4 **Monitoring**

- Track extraction volume, token usage, and error rates via existing AI logs and metrics.
- Collect user feedback on accuracy and UX to refine prompts, schemas, and defaults.
