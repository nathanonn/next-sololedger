## Advanced ZIP Transaction Import – Implementation Plan

This plan upgrades the transaction import flow to support an advanced mode where users upload a ZIP file containing `transactions.csv` plus related document files. The existing CSV-only flow remains intact. In ZIP mode, the backend unzips the archive on the server, validates per-row document paths and file constraints during preview, and on commit uploads any referenced documents via the existing document storage abstraction and links them to the newly created transactions. Behavior follows your choices: single wizard with a mode toggle, optional `document` column mapping, row-level invalidation for missing/invalid documents, heuristic document typing, per-ZIP deduplication of documents, no global ZIP size cap (but strict per-file limits), full validation at preview, and an entrypoint labeled “Import CSV/ZIP”.

### 1. CSV Import Types – Add Document Path Support

- Extend `lib/import/transactions-csv.ts`:
  - In `CsvColumnMapping`, add an optional `document?: string` field for the CSV column that holds a document path relative to the ZIP root.
  - In `RawImportRow.candidate`, add `documentPath?: string`.
  - In `applyColumnMapping`:
    - Read the mapped `document` column using the existing `getValue` helper.
    - Store that as `candidate.documentPath` (trimmed, empty treated as `undefined`).
  - In `NormalizedImportRow`, add a top-level `documentPath?: string`:
    - When constructing a normalized row, copy `candidate.documentPath` into `normalizedRow.documentPath` (for valid rows) without changing any existing validation rules.
    - Invalid rows can leave `documentPath` undefined; it’s only needed for import-time document linking.

### 2. Import Wizard UI – CSV vs ZIP Modes & Document Mapping

- In `app/o/[orgSlug]/transactions/page.tsx`:
  - Update the header button that opens the import wizard:
    - Change its label from “Import CSV” to “Import CSV/ZIP”.
    - Keep the wiring the same (`setImportWizardOpen(true)`).

- In `components/features/import/transactions-import-wizard.tsx`:
  - Add an `importMode` state and type:
    - `type ImportMode = "csv" | "zip_with_documents";`.
    - `const [importMode, setImportMode] = React.useState<ImportMode>("csv");`.
  - Surface the mode selector in the upload step:
    - Add a small radio group or segmented control labeled “Import Mode” with:
      - “Standard CSV” (`"csv"`).
      - “Advanced ZIP (CSV + documents)” (`"zip_with_documents"`).
    - Default to `"csv"`.
  - Make the file input conditional:
    - If `importMode === "csv"`:
      - `accept=".csv"`.
      - Help text: “Upload a CSV export from your bank or accounting tool”.
    - If `importMode === "zip_with_documents"`:
      - `accept=".zip"`.
      - Help text describing:
        - Expected structure:
          - `/OpenAI/...pdf`, `/Google/...pdf`, `/transactions.csv`.
        - `transactions.csv` must contain a `document` column with relative paths like `OpenAI/DHUENf-0011.pdf`.
        - Empty `document` cells simply mean “no document for this transaction”.
  - Extend the mapping UI:
    - In the Field Mapping list, add an optional “Document (path in ZIP)” field.
    - Wire it to `columnMapping.document`.
    - Default to the CSV header named `document` if present.
  - Ensure `mappingConfig` includes `importMode`:
    - When building `mappingConfig` for preview and commit:
      - Add `importMode` at the top level alongside `columnMapping` and `parsingOptions`, e.g.:
        - `{ importMode, columnMapping, parsingOptions: { ... } }`.
      - When using a template, allow `importMode` from the current wizard state to override or augment any stored value.

### 3. ZIP Parsing Helper & Document Path Normalization

- Add `lib/import/zip-transactions.ts` (Node runtime only):
  - Export a function:
    - `async function parseTransactionsZip(buffer: Buffer): Promise<{ transactionsCsv: Buffer; documentsByPath: Map<string, { buffer: Buffer; originalName: string }> }>`
  - Behavior:
    - Use a Node ZIP library to read entries from the `buffer` without writing to disk.
    - Identify `transactions.csv`:
      - Accept paths like `transactions.csv`, `./transactions.csv`, or any `*/transactions.csv` (first match wins).
      - If not found, throw a specific error (caller will map it to a 400).
      - Return its contents as `transactionsCsv`.
    - Build `documentsByPath`:
      - For every other regular file entry:
        - Compute `normalizedPath` using a helper (see below).
        - Read the file contents into a `Buffer`.
        - Store in `documentsByPath.set(normalizedPath, { buffer, originalName: entryFileName });`.
      - Ignore directory entries.
  - Add `normalizeDocumentPath(raw: string): string`:
    - Trim whitespace.
    - Replace backslashes with slashes.
    - Strip leading `./` or `/`.
    - Collapse duplicate slashes.
    - Return the cleaned path used as a map key.
  - Add `guessMimeType(originalName: string): string | null`:
    - Based on extension:
      - `.pdf` → `application/pdf`.
      - `.png` → `image/png`.
      - `.jpg` / `.jpeg` → `image/jpeg`.
      - `.txt` → `text/plain`.
    - Return `null` for unsupported extensions so validation can treat them as invalid.
  - Do not enforce any explicit ZIP size limit in this helper; only operate on the given buffer (ZIP size policy is handled at the route level).

### 4. Shared Document Validation for Imports

- Extract document constraints to a shared module:
  - Create `lib/documents/validation.ts`:
    - Export:
      - `export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf", "text/plain"];` (copied from the existing documents upload API).
      - `export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024;`.
      - `export function validateDocumentFile(params: { mimeType: string; sizeBytes: number }): string | null`:
        - Return `null` if valid.
        - Return an error message if the MIME is not in `ALLOWED_MIME_TYPES` or `sizeBytes` > `MAX_DOCUMENT_FILE_SIZE_BYTES`.
  - Update `app/api/orgs/[orgSlug]/documents/route.ts` to import and use these constants/helpers instead of local copies, preserving current behavior.

- Add `lib/import/transactions-documents.ts`:
  - Export:
    - `function validateImportDocumentsForZip(rows: NormalizedImportRow[], documentsByPath: Map<string, { buffer: Buffer; originalName: string }>): NormalizedImportRow[]`
  - Behavior:
    - For each `row`:
      - If `row.status !== "valid"`, leave it unchanged.
      - If `row.normalized?.documentPath` or `row.documentPath` is not set, leave it unchanged (no document requested).
      - Otherwise:
        - Normalize the path via `normalizeDocumentPath`.
        - Look up `documentsByPath.get(normalizedPath)`:
          - If not found:
            - Add an error `Missing document "<path>" in ZIP`.
            - Set `row.status = "invalid"` and clear `row.normalized` to avoid partial imports (row-level invalidation).
            - Continue to next row.
        - Derive `mimeType` via `guessMimeType(originalName)`:
          - If `mimeType` is `null`, add an error `Unsupported document type for "<originalName>"` and mark row invalid.
        - Call `validateDocumentFile({ mimeType, sizeBytes: buffer.length })`:
          - If it returns an error message, push that error and mark row invalid.
        - If all checks pass:
          - Attach the normalized path in `row.documentPath` (or keep it unchanged) for use during commit.
    - Return the mutated `rows` array (for chaining).
  - This helper performs *validation only*; it does not call Prisma or the document storage.

### 5. Preview Endpoint – CSV & ZIP Modes with Document Validation

- In `app/api/orgs/[orgSlug]/transactions/import/preview/route.ts`:
  - Parse `mappingConfig` as today, but add `importMode` handling:
    - If `mappingConfig.importMode` is missing, default to `"csv"` for backward compatibility.
    - If present, assert it is either `"csv"` or `"zip_with_documents"`.
  - If `importMode === "csv"`:
    - Keep the existing behavior exactly:
      - Enforce 10MB file limit against the CSV file.
      - Require a `.csv` extension.
      - Parse CSV via `parseCsvBuffer`, apply mapping, normalize & validate rows, detect duplicates, generate summary.
  - If `importMode === "zip_with_documents"`:
    - Change file validation:
      - Require `.zip` extension; error if not.
      - Do **not** apply the 10MB limit to the uploaded ZIP (no explicit ZIP size cap).
    - Convert the uploaded `File` to a `Buffer` and call `parseTransactionsZip`.
      - If `transactions.csv` is missing, return 400 with `error: "transactions.csv not found in ZIP"`.
    - Feed `transactionsCsv` into `parseCsvBuffer` with the same `parsingOptions`.
    - Run `applyColumnMapping` and `normalizeAndValidateRows` as usual.
    - Call `validateImportDocumentsForZip(normalizedRows, documentsByPath)` to:
      - Mark rows invalid when `document` is non-empty but missing in the ZIP.
      - Mark rows invalid when document size or type violates constraints.
    - Run `detectDuplicates` on the document-validated rows.
    - Generate summary via `generateImportSummary`.
  - Response shape:
    - Keep `headers`, `previewRows`, `duplicateCandidates`, `summary`, and `totalRowsParsed` as today.
    - Optionally include `documentPath` in `previewRows` (e.g. inside `normalized` or as a sibling property) for transparency; ensure the UI treats it as optional so older previews still render.

### 6. Commit Endpoint – ZIP Mode with Document Upload & Linking

- In `app/api/orgs/[orgSlug]/transactions/import/commit/route.ts`:
  - Parse `mappingConfig` with `importMode`:
    - Same rules as preview: default to `"csv"` when missing; otherwise accept `"csv"` or `"zip_with_documents"`.
  - For `importMode === "csv"`:
    - Keep the current behavior exactly: CSV validation, duplicate handling, transaction creation, tag linking, and audit logging.
  - For `importMode === "zip_with_documents"`:
    - File handling:
      - Require `.zip` extension; no explicit ZIP size cap.
      - Convert `File` to `Buffer` and call `parseTransactionsZip`; error if `transactions.csv` is missing.
    - CSV pipeline:
      - Run `parseCsvBuffer`, `applyColumnMapping`, `normalizeAndValidateRows`, `validateImportDocumentsForZip`, and `detectDuplicates` in the same order as preview.
      - This ensures rows invalid due to document issues are consistently treated as `status: "invalid"`.
    - Row selection:
      - Build `rowsToImport` exactly as today:
        - Skip rows with `status === "invalid"`.
        - For duplicate candidates, import only those with `decisions[rowIndex] === "import"`, others are counted as skipped duplicates.
    - Document and link creation:
      - Before looping:
        - Create `const docPathToDocumentId = new Map<string, string>();`.
      - In the inner loop, after each `transaction` is created:
        - If `row.documentPath` (or `row.normalized?.documentPath`) is not set, continue (no document for this row).
        - Normalize the path again via `normalizeDocumentPath` to avoid mismatch.
        - Look up `documentsByPath.get(normalizedPath)`:
          - If missing, this should have been caught in preview; choose the safer behavior:
            - Do not import the document or create a link; optionally record a warning in the audit metadata. The transaction remains imported because the row passed prior validation.
        - If present:
          - If `docPathToDocumentId` already has the path, reuse that document id.
          - Else:
            - Call `guessMimeType(originalName)` and `validateDocumentFile` again as a safety check (should pass if preview was run, but commit may be called directly via API).
            - Use `getDocumentStorage()` to `save` the buffer:
              - Receive `storageKey`, `mimeType`, `fileSizeBytes`.
            - Create a `Document` record via `db.document.create`:
              - `organizationId`: org id.
              - `uploadedByUserId`: current user id.
              - `storageKey`, `filenameOriginal`: from storage/entry.
              - `displayName`: filename without extension.
              - `mimeType`, `fileSizeBytes` from storage metadata.
              - `type`:
                - If `normalized.type === "INCOME"`: `DocumentType.INVOICE`.
                - If `normalized.type === "EXPENSE"`: `DocumentType.RECEIPT`.
                - Else: `DocumentType.OTHER`.
              - `documentDate`: set to `normalized.date`.
              - `textContent`: `null`.
            - Cache `docPathToDocumentId.set(normalizedPath, document.id)`.
          - Create a link via `db.transactionDocument.create` (or `createMany` batched later) associating the `transaction.id` with this `documentId`.
      - Maintain counters:
        - `documentsCreated`: number of `Document` rows created.
        - `documentLinksCreated`: number of `TransactionDocument` links created.
    - Audit log:
      - Extend the existing `transaction_import_commit` audit entry metadata with:
        - `importMode: "zip_with_documents"`.
        - `documentsCreated`.
        - `documentLinksCreated`.
        - Possibly a list of any document-path anomalies encountered at commit.

### 7. Sample CSV & Docs – Document Column Visibility

- In `app/api/orgs/[orgSlug]/transactions/import/sample-csv/route.ts`:
  - Extend the headers array to include a trailing `"document"` column.
  - For most sample rows, leave the `document` cell empty.
  - For one or two example rows, set a value like:
    - `"OpenAI/invoice-123.pdf"` or `"Google/statement-2025-10.pdf"`.
  - This column remains optional:
    - In pure CSV mode, it is mapped only if the user chooses to map it; otherwise it is ignored.
    - In ZIP mode, users are expected to map it when they plan to include documents in the ZIP; rows with non-empty `document` values must have matching files or they become invalid.

- Update `notes/todos.md` usage notes:
  - Ensure the advanced ZIP behavior is documented:
    - ZIP structure.
    - `document` column semantics.
    - Row-level invalidation rules.
    - Heuristic `Document.type` mapping and `documentDate` usage.

### 8. Testing Strategy for ZIP Import

- Integration tests (`tests/integration/api/transactions-import-zip.test.ts`):
  - Set up mocks for Prisma (`prismaMock`), JWT, and auth helpers just like existing API tests.
  - Use `archiver` in tests or a small pre-built ZIP fixture to:
    - Create a ZIP containing:
      - `transactions.csv` with a `document` column.
      - A couple of small PDF buffers under `OpenAI/` and `Google/`.
  - Build a `FormData` with:
    - A `File`/`Blob` for the ZIP.
    - A JSON `mappingConfig` including:
      - `importMode: "zip_with_documents"`.
      - `columnMapping` with `document` mapped to the correct header.
      - Valid `parsingOptions`.
  - Test preview:
    - Valid rows with correct `document` paths are `status: "valid"` and appear in `summary.validRows`.
    - Rows with non-empty `document` referencing a missing file are `status: "invalid"` with a “Missing document” error.
    - Rows with oversized or unsupported document files are `status: "invalid"` with appropriate errors.
  - Test commit:
    - Successful import:
      - `db.transaction.create` is called for valid rows.
      - `db.document.create` is called exactly once per unique document path.
      - `db.transactionDocument.create` links each transaction to the appropriate document.
    - Duplicate paths:
      - Multiple rows sharing the same `document` path reuse the same `Document` (one create, many links).
    - Missing/invalid docs:
      - Rows invalid due to documents are not imported; `skippedInvalidCount` reflects this.
  - If necessary, extend `tests/helpers/mockRequest.ts` or add a helper to build multipart `Request` objects from `FormData`.

### 9. Implementation Order

1. Extend `lib/import/transactions-csv.ts` with `document` mapping, `candidate.documentPath`, and `NormalizedImportRow.documentPath`.
2. Implement `lib/import/zip-transactions.ts` with `parseTransactionsZip`, `normalizeDocumentPath`, and `guessMimeType`.
3. Extract document validation constants into `lib/documents/validation.ts` and update the documents upload API to use them.
4. Implement `lib/import/transactions-documents.ts` with `validateImportDocumentsForZip`.
5. Update the preview API route to support `importMode` and ZIP behavior, integrating `parseTransactionsZip` and `validateImportDocumentsForZip`.
6. Update the commit API route to support `importMode`, run the same validation pipeline, and add document upload + linking logic for ZIP mode.
7. Update `TransactionsImportWizard` UI with:
   - Mode toggle.
   - Conditional file input.
   - Document field mapping.
   - `importMode` included in `mappingConfig`.
8. Update the Transactions page button label and the sample CSV endpoint to reflect the new `document` column.
9. Add integration tests for ZIP preview and commit, plus any small unit tests for `parseTransactionsZip` and document validation helpers.

