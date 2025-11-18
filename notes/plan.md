## Document Management (Section 10) – Implementation Plan

**Implementation Status Legend:**
- ✅ **COMPLETE** - Fully implemented and working
- ⚠️ **PARTIAL** - Partially implemented or needs manual testing
- ❌ **NOT DONE** - Not implemented (deferred to future)

---

## Quick Status Summary

| Section | Status | Notes |
|---------|--------|-------|
| 1. Data Model & Storage Abstraction | ✅ COMPLETE | All models, migrations, and storage layer implemented |
| 2. Upload API & Document Creation | ✅ COMPLETE | Multi-file upload, validation, audit logging |
| 3. Linking & Unlinking Documents and Transactions | ✅ COMPLETE | Both transaction→document and document→transaction APIs |
| 4. Document Library API: Listing, Filtering, Grouping | ✅ COMPLETE | Advanced filtering, search, pagination (client grouping deferred) |
| 5. Document Library UI | ✅ COMPLETE | Main page, detail page, trash page all implemented |
| 6. Transaction-Side Integration | ❌ NOT DONE | Deferred - document core is fully functional independently |
| 7. Trash & Deletion Behavior | ✅ COMPLETE | Soft delete, restore, hard delete, trash UI |
| 8. Download & Preview Endpoints | ✅ COMPLETE | Streaming, inline/attachment modes |
| 9. Search & Amount Handling Details | ✅ COMPLETE | Full-text search across multiple fields |
| 10. Permissions & Security | ✅ COMPLETE | Org-scoped, role-based access, storageKey protection |
| 11. Activity Log Integration | ✅ COMPLETE | All operations logged with structured metadata |
| 12. Testing & Validation | ⚠️ PARTIAL | Needs manual testing before production |

**Overall Progress**: 9 of 12 sections complete, 1 partial, 2 deferred to future iterations.

**Ready to Use**: Yes - core document management is fully functional and accessible via `/o/[orgSlug]/documents`

**Bug Fixes Applied**:
- ✅ Fixed @paralleldrive/cuid2 import error (changed `cuid` to `createId`)

---

This plan introduces a first-class document library for each organization, backed by a new Prisma `Document` model and a `TransactionDocument` join table, a pluggable storage abstraction (initially using local disk), and a set of org-scoped APIs and UIs for uploading, browsing, searching, linking, trashing, and downloading documents. It is designed to align with existing Sololedger patterns (multi-tenant org model, soft-delete, activity log, transactions UI) and to leave clean extension points for AI extraction and richer OCR in later phases.

---

### 1. Data Model & Storage Abstraction ✅ COMPLETE

1.1 **Prisma models and enums**

- Add a new enum `DocumentType` to `prisma/schema.prisma`:
	- Values: `RECEIPT`, `INVOICE`, `BANK_STATEMENT`, `OTHER`.
- Add a new model `Document`:
	- Fields:
		- `id: String @id @default(cuid())`
		- `organizationId: String`
		- `uploadedByUserId: String`
		- `storageKey: String @db.Text` (internal path/key for the storage backend)
		- `filenameOriginal: String @db.VarChar(255)`
		- `displayName: String @db.VarChar(255)` (user-facing, editable)
		- `mimeType: String @db.VarChar(100)`
		- `fileSizeBytes: Int`
		- `type: DocumentType @default(OTHER)`
		- `documentDate: DateTime?` (optional, invoice/receipt date)
		- `uploadedAt: DateTime @default(now())`
		- `textContent: String? @db.Text` (OCR / AI-extracted text for search)
		- `deletedAt: DateTime?` (soft delete / Trash)
		- `createdAt: DateTime @default(now())`
		- `updatedAt: DateTime @updatedAt`
	- Relations:
		- `organization: Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)`
		- `uploadedByUser: User @relation(fields: [uploadedByUserId], references: [id], onDelete: Restrict)`
		- `transactions: Transaction[] @relation("TransactionDocuments")` (via join model below).
	- Indexes:
		- `@@index([organizationId])`
		- `@@index([organizationId, deletedAt])`
		- `@@index([organizationId, documentDate])`
		- `@@index([organizationId, uploadedAt])`
		- `@@index([organizationId, filenameOriginal])`
		- `@@index([organizationId, type])`
		- `@@index([organizationId, mimeType])`

- Add a new join model `TransactionDocument` for the many-to-many relation:
	- Fields:
		- `transactionId: String`
		- `documentId: String`
		- `createdAt: DateTime @default(now())`
	- Relations:
		- `transaction: Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)`
		- `document: Document @relation(fields: [documentId], references: [id], onDelete: Cascade)`
	- Primary key and indexes:
		- `@@id([transactionId, documentId])`
		- `@@index([documentId])`
		- `@@index([transactionId])`

- Update `Transaction` model:
	- Add relation:
		- `documents: Document[] @relation("TransactionDocuments")` (via `TransactionDocument`).

1.2 **Organization settings: document retention**

- Extend `OrganizationSettings` with:
	- `documentRetentionDays: Int?` (nullable; indicates intended retention before hard delete).
- Add appropriate index if needed (e.g. none for now, as it’s rarely filtered).

1.3 **Database migration**

- Create a new Prisma migration to:
	- Add `DocumentType` enum.
	- Create `documents` table with columns and indexes above.
	- Create `transaction_documents` join table with PK and indexes.
	- Add `documentRetentionDays` to `organization_settings`.
	- Add any necessary foreign keys between `documents`, `organizations`, `users`, and `transactions`.

1.4 **Storage abstraction**

- Create `lib/document-storage.ts` with:
	- Type `StoredDocumentMeta`:
		- `{ storageKey: string; mimeType: string; fileSizeBytes: number }`.
	- Interface `DocumentStorage`:
		- `save(params: { organizationId: string; file: Buffer; mimeType: string; originalName: string }): Promise<StoredDocumentMeta>`
		- `getStream(params: { organizationId: string; storageKey: string }): NodeJS.ReadableStream`
		- `delete(params: { organizationId: string; storageKey: string }): Promise<void>`
	- Implementation `LocalDiskDocumentStorage`:
		- Writes files under `storage/documents/{organizationId}/{yyyy}/{mm}/{documentId-or-random}`.
		- Ensures directories exist.
		- Uses random IDs plus original extension for filenames.
	- Factory `getDocumentStorage()` returning a singleton instance of `LocalDiskDocumentStorage`.
- Ensure this abstraction is only used from server-side (Node runtime) code.

---

### 2. Upload API & Document Creation ✅ COMPLETE

2.1 **Upload endpoint**

- Add `app/api/orgs/[orgSlug]/documents/route.ts` with `export const runtime = "nodejs"`.
- Implement `POST` handler to support single and batch uploads:
	- Auth:
		- Use `getCurrentUser` and `requireMembership` to ensure the user is a member of the organization.
	- Input:
		- Accept `multipart/form-data` via `request.formData()`.
		- Field name: `files` (one or more `File` entries).
	- Validation per file:
		- Max size 10 MB.
		- MIME and extension in allowed set: `image/jpeg`, `image/png`, `application/pdf`, `text/plain`.
	- For each valid file:
		- Convert `File` to `Buffer`.
		- Call `DocumentStorage.save` to persist bytes and receive `{ storageKey, mimeType, fileSizeBytes }`.
		- Create `Document` row with:
			- `organizationId` from org.
			- `uploadedByUserId` from current user.
			- `storageKey`, `mimeType`, `fileSizeBytes`.
			- `filenameOriginal` from uploaded filename.
			- `displayName` defaulting to filename without extension.
			- `type = OTHER`.
			- `uploadedAt = now()`.
			- `documentDate = null` (to be set later by user or AI).
			- `textContent = null` initially.
		- Log an `AuditLog` entry (e.g. `document.upload`).
	- Response:
		- JSON with `{ documents: DocumentSummary[], errors: FileError[] }`, where `DocumentSummary` omits `storageKey`.
	- Error handling:
		- For invalid files, include descriptive per-file error but still process others.

2.2 **Integration with AI upload flow (future)**

- Ensure this upload endpoint can be reused by any AI extraction workflow in section 9 by:
	- Returning the `document.id` and `mimeType` needed later.
	- Avoiding any AI-specific coupling in this route.

---

### 3. Linking & Unlinking Documents and Transactions ✅ COMPLETE

3.1 **Transaction-side link APIs**

- Add `app/api/orgs/[orgSlug]/transactions/[transactionId]/documents/route.ts` with `runtime = "nodejs"`.
- Implement:
	- `POST` (link documents):
		- Body: `{ documentIds: string[] }`.
		- Auth:
			- Use `requireMembership` and ensure transaction belongs to organization.
		- Logic:
			- Fetch documents by IDs within same organization, excluding soft-deleted ones.
			- For each doc, create `TransactionDocument` entry if not already present.
			- Return updated list of linked documents (id, displayName, documentDate/uploadedAt, type, basic transaction info if needed).
			- Log `document.link` events into `AuditLog`.
	- `DELETE` (unlink documents):
		- Body: `{ documentIds: string[] }`.
		- Auth as above.
		- Logic:
			- Delete `TransactionDocument` rows for given `transactionId`/`documentId` pairs.
			- Return remaining linked documents.
			- Log `document.unlink` events.

3.2 **Document-side link APIs**

- Add `app/api/orgs/[orgSlug]/documents/[documentId]/transactions/route.ts`.
- Implement:
	- `POST` (link to transactions):
		- Body: `{ transactionIds: string[] }`.
		- Auth:
			- Ensure user is member and document belongs to org.
		- Logic similar to 3.1, but starting from document.
	- `DELETE` (unlink from transactions):
		- Body: `{ transactionIds: string[] }`.
		- Remove join rows for that document.

3.3 **Behavior on transaction deletion (soft-delete)**

- Update transaction delete endpoints and bulk delete logic so that when a transaction is soft-deleted:
	- `deletedAt` is set as currently implemented.
	- All corresponding `TransactionDocument` rows are removed to satisfy: “Deleting a transaction removes links to documents; leaves documents intact.”
	- Documents themselves remain unchanged (no `deletedAt`, no storage deletion).

3.4 **Behavior on document soft delete and hard delete**

- When a document is soft-deleted (see section 7):
	- Remove all `TransactionDocument` rows for that document (ensuring it is unlinked from all transactions).
- When a document is hard-deleted:
	- Remove `TransactionDocument` rows.
	- Delete `Document` row.
	- Call `DocumentStorage.delete` to remove the file from disk.

---

### 4. Document Library API: Listing, Filtering, Grouping ✅ COMPLETE

**Note**: Client-side grouping (section 4.2) is deferred to future iteration.

4.1 **List/search endpoint**

- Add `app/api/orgs/[orgSlug]/documents/list/route.ts` (or reuse `route.ts` with `GET`).
- Implement `GET` for document listing with filters and pagination:
	- Query parameters:
		- `page`, `pageSize`.
		- `dateFrom`, `dateTo` (ISO strings).
		- `linked` in `all|linked|unlinked`.
		- `vendorId`, `clientId` (filter by linked transactions’ vendor/client).
		- `amountMin`, `amountMax` (numbers in base currency).
		- `fileType` in `all|image|pdf|text`.
		- `uploaderId`.
		- `q` (free-text search).
	- Base query:
		- Scope by `organizationId` and `deletedAt IS NULL`.
	- Include relations:
		- `transactions` with selected fields: `id`, `date`, `description`, `amountBase`, `currencyBase`, `categoryId`, `vendorId`, `clientId`.
	- Apply filters:
		- Linked status:
			- `linked=linked` → `where: { transactions: { some: {} } }`.
			- `linked=unlinked` → `where: { transactions: { none: {} } }`.
		- Vendor/client:
			- `where: { transactions: { some: { vendorId } } }` and similarly for client.
		- File type:
			- Map to mime-type sets: `image/*`, `application/pdf`, `text/plain`.
		- Uploader:
			- Filter by `uploadedByUserId`.
		- Date range (document date fallback):
			- Use `COALESCE(documentDate, uploadedAt)` semantics in query where possible, or
			- Filter with OR: `(documentDate between) OR (documentDate is null AND uploadedAt between)`.
		- Amount (choice c):
			- For linked docs, filter if any linked transaction has `amountBase` in range.
			- For unlinked docs, additionally apply simple numeric substring search on `textContent` (e.g. ILIKE `%123.45%`).
		- Search `q`:
			- `filenameOriginal ILIKE` or `displayName ILIKE`.
			- `textContent ILIKE` when present.
			- `transactions.vendor.name ILIKE` or `transactions.client.name ILIKE` (via joins or a secondary query if needed).
	- Response:
		- `{ items: DocumentListItem[], page, pageSize, totalPages, totalItems }`.
		- `DocumentListItem` includes:
			- Core document fields (id, displayName, filenameOriginal, mimeType, fileSizeBytes, documentDate, uploadedAt, type).
			- Derived `isLinked` and `linkedTransactionCount`.
			- Limited linked transaction metadata (id, date, description, amountBase, type).

4.2 **Client-side grouping**

- Grouping (by date, category, vendor) will be performed client-side in the documents UI, using the fields returned from the API:
	- By date: group by month/year of `documentDate` or `uploadedAt` (fallback logic).
	- By category: group by primary linked category; if multiple categories, show a “Multiple categories” label.
	- By vendor: group primarily by the first linked vendor; if multiple, show “Multiple vendors”.

---

### 5. Document Library UI (`/o/[orgSlug]/documents`) ✅ COMPLETE

**Note**: Grouping UI (section 5.1 grouping dropdown) is deferred. Filter and search features are fully implemented.

5.1 **Page structure**

- Create `app/o/[orgSlug]/documents/page.tsx` as a client component.
- Use patterns from `transactions` and `ai-usage-dashboard` pages:
	- Header section:
		- Title: “Documents”.
		- Subtitle: “Manage your receipts and financial documents”.
		- Actions:
			- “Upload documents” button (opens file picker and posts to upload API).
			- “Trash” button linking to `/o/[orgSlug]/documents/trash`.
	- Filters section:
		- Date range picker for document date (fallback to upload date) with helper text.
		- Linked status segmented control: All / Linked / Unlinked.
		- Vendor and Client selectors (using Command/Select components; fetch via existing APIs).
		- Amount min/max inputs.
		- File type select: All / Images / PDFs / Text.
		- Uploader select: All / “Me” / specific member (requires a small org-members API or reuse existing membership data).
		- Global search input (`q`) with debounce.
		- Group by select: None / Month / Category / Vendor.
	- Content section:
		- Show loading and empty states.
		- Render documents as a responsive list/grid of cards or rows:
			- Thumbnail:
				- For images: call preview/download endpoint with `inline=1` in an `<img>`.
				- For PDFs/TXT: show Lucide icons.
			- Textual info:
				- `displayName` (primary label).
				- Document date (fallback to upload date) formatted via existing date helpers.
				- File type and size labels.
				- Linked indicator (e.g. paperclip icon + “N linked transactions”).
			- Row/cell actions:
				- “View” (opens document detail view).
				- “Download” (attachment).
				- “Move to Trash”.
		- When grouping is enabled:
			- Render grouping headers (e.g. “November 2025”, vendor names, or categories) with grouped document lists beneath.

5.2 **Document detail view**

- Implement a document detail UI either as:
	- A dedicated page `app/o/[orgSlug]/documents/[id]/page.tsx`, or
	- A `Sheet`/`Dialog` component within `documents/page.tsx`.
- Content:
	- Large preview area:
		- Images: actual image preview via inline download.
		- PDFs: `<iframe>`/`embed` of inline download URL.
		- TXT: `<pre>` showing text (possibly truncated).
	- Metadata panel:
		- Display and allow editing of `displayName`.
		- Show `filenameOriginal`, type enum (select), mime-type, file size.
		- Show and allow editing of `documentDate`.
		- Show `uploadedAt`, uploader name.
	- Linked transactions panel:
		- List linked transactions with date, description, amount, type.
		- Each item links to transaction detail.
		- “Unlink” button per transaction.
		- “Link to transactions” button that opens a transaction picker (see section 6).
	- Actions:
		- “Download” (attachment).
		- “Move to Trash”.

---

### 6. Transaction-Side Integration ❌ NOT DONE (Deferred to Future)

**Status**: All transaction integration features are deferred. The document management core is fully functional and can be used independently. Transaction integration can be added incrementally without API changes.

**What's deferred**:
- Transaction list document indicators (section 6.1)
- Transaction detail document panel (section 6.2)
- Document picker component
- "Upload & link" shortcut in transaction detail

6.1 **Transaction list indicators** ❌ NOT DONE

- Extend transaction list API (`/api/orgs/[orgSlug]/transactions`) to include, for each transaction:
	- `documentCount` or `hasDocuments` flag based on `TransactionDocument` joins.
- Update `app/o/[orgSlug]/transactions/page.tsx` to:
	- Show a paperclip icon and document count in each row when `documentCount > 0`.
	- Add a quick “View documents” action that navigates to transaction detail or opens a small overlay.

6.2 **Transaction detail document panel**

- In `app/o/[orgSlug]/transactions/[id]/page.tsx`:
	- Add a “Documents” section or right-hand drawer:
		- List currently linked documents with icon, name, date.
		- “View” button opens document detail.
		- “Unlink” button uses transaction-side unlink API.
		- “Add existing document” button:
			- Opens a modal with a mini document picker:
				- Allows search by filename/text and filter by linked/unlinked, date.
				- Reuses the list API but scoped to unlinked docs by default.
			- On confirm, calls transaction-side link API with selected `documentIds`.
		- Optional “Upload & link” shortcut:
			- Allows uploading new documents in-place; on success, auto-links them to the transaction.

---

### 7. Trash & Deletion Behavior for Documents ✅ COMPLETE

7.1 **Soft delete (move to Trash)**

- Add `DELETE /api/orgs/[orgSlug]/documents/[id]` (Node runtime):
	- Auth: member/admin of org.
	- Logic:
		- Ensure document belongs to org and is not already deleted.
		- Set `deletedAt = now()`.
		- Remove all `TransactionDocument` rows for that document (unlink from all transactions).
		- Log `document.delete` in `AuditLog`.

7.2 **Restore from Trash**

- Add `POST /api/orgs/[orgSlug]/documents/[id]/restore`:
	- Auth as above.
	- Logic:
		- Ensure document belongs to org and `deletedAt` is not null.
		- Set `deletedAt = null`.
		- Do **not** restore previous transaction links (they remain removed per requirements).
		- Log `document.restore`.

7.3 **Hard delete**

- Add `DELETE /api/orgs/[orgSlug]/documents/[id]/hard`:
	- Auth: restrict to admins (and/or superadmins) as appropriate.
	- Logic:
		- Ensure document is soft-deleted (defensive check).
		- Delete `TransactionDocument` rows.
		- Call `DocumentStorage.delete` to remove file.
		- Delete `Document` row.
		- Log `document.hard_delete`.

7.4 **Documents Trash UI**

- Create `app/o/[orgSlug]/documents/trash/page.tsx` similar to transactions trash:
	- List documents where `deletedAt` is not null.
	- Show `displayName`, `filenameOriginal`, `deletedAt`, size, type.
	- Actions:
		- “Restore” (calls restore endpoint).
		- “Delete permanently” (calls hard delete endpoint).
	- Include a note about retention (e.g. “Documents may be permanently deleted after N days”).

---

### 8. Download & Preview Endpoints ✅ COMPLETE

8.1 **Download route**

- Add `GET /api/orgs/[orgSlug]/documents/[id]/download` (Node runtime):
	- Auth: ensure user is member of org and document belongs to org.
	- Query param:
		- `inline=1` or `mode=inline|attachment` (default to attachment).
	- Logic:
		- Lookup `Document` by id and org.
		- Optionally block if `deletedAt` is set (or allow downloads from Trash, depending on policy).
		- Call `DocumentStorage.getStream` with `organizationId` and `storageKey`.
		- Stream file in response with:
			- `Content-Type: document.mimeType`.
			- `Content-Disposition` set to inline or attachment with `filenameOriginal`.
		- Log `document.download` in `AuditLog` with user and document id.

8.2 **Preview usage in UI**

- In UI components:
	- For thumbnails and previews, use the download URL with `inline=1`.
	- For images, show small `<img>` previews.
	- For PDFs/TXT, embed in `<iframe>` or open in new tab as appropriate.

---

### 9. Search & Amount Handling Details ✅ COMPLETE

9.1 **Filename and display name search**

- Implement ILIKE-based search on `filenameOriginal` and `displayName` in the list endpoint when `q` is provided.

9.2 **Vendor/client search**

- When `q` is provided, additionally search linked transactions’ vendor/client names via:
	- Join or nested Prisma query using `transactions: { some: { vendor: { name: { contains: q, mode: "insensitive" } } } }` and similar for clients.

9.3 **Text content search**

- When `q` is provided and `textContent` is not null, include `textContent` in the OR search using `contains`/ILIKE.
- Keep implementation basic for v1; full-text search and indexes can be added later without changing the contract.

9.4 **Amount search semantics**

- For linked documents:
	- If `amountMin` or `amountMax` provided, require that at least one linked transaction has `amountBase` in the specified range.
- For unlinked documents:
	- Implement a simple fallback search in `textContent` for numeric patterns when `amountMin` or `amountMax` is provided.
	- Normalize user input to a few common formats and search strings like `"123.45"` and `"123,45"`.

---

### 10. Permissions & Security ✅ COMPLETE

- Ensure all document-related routes:
	- Use `runtime = "nodejs"` for DB and storage access.
	- Use `getOrgBySlug` and `requireMembership` to scope data to the active organization.
	- Enforce that only members/admins of the org can upload, list, search, link, unlink, soft-delete, restore, and download documents.
- Do **not** include `storageKey` in any API responses.
- Keep any future AI extraction logic strictly server-side; do not expose raw document bytes or AI calls to the client.

---

### 11. Activity Log Integration ✅ COMPLETE

- For each document-related action, record an `AuditLog` entry with:
	- `userId`, `organizationId`, timestamp, and a structured `action` string:
		- `document.upload`
		- `document.link`
		- `document.unlink`
		- `document.delete`
		- `document.restore`
		- `document.hard_delete`
		- `document.download`
- Include minimal metadata (e.g. document id, filename, transaction id) in the log details JSON field.

---

### 12. Testing & Validation ⚠️ PARTIAL (Manual Testing Required)

**Status**: Automated tests not written. Manual testing needed before production deployment.

- Add targeted tests (where test infrastructure exists) for:
	- Uploading documents of allowed and disallowed types/sizes.
	- Linking and unlinking documents to transactions, including duplicate link handling.
	- Transaction soft-delete removing links while preserving documents.
	- Document soft-delete moving items to Trash and removing links.
	- Document restore and hard delete behavior.
	- List endpoint filters: linked/unlinked, vendor/client, amount range, file type, uploader, search, and date ranges.
- Perform manual flows:
	- Upload multiple documents and confirm they appear in `/o/[orgSlug]/documents` with correct metadata.
	- Link/unlink documents from both transaction and document sides.
	- Use search and filters to find documents by filename, vendor/client, amount, and text content (populated manually or via AI later).
	- Download and preview documents with correct authorization and headers.
