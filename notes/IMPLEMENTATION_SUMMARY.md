# Document Management Implementation Summary

**Branch**: `feat/document_management`
**Date**: 2025-11-18
**Status**: ✅ Core Implementation Complete

## Overview

Implemented a comprehensive document management system for Sololedger, allowing organizations to upload, organize, search, and link financial documents (receipts, invoices, bank statements) to transactions.

## What Was Built

### 1. Data Model & Database

**Files**: `prisma/schema.prisma`, migration files

- **DocumentType enum**: RECEIPT, INVOICE, BANK_STATEMENT, OTHER
- **Document model**: Complete metadata including:
  - Storage key, filename, display name, MIME type, file size
  - Document type and optional document date
  - Text content field (for future OCR/AI extraction)
  - Soft delete support (deletedAt)
  - Relations to Organization, User, and Transactions
- **TransactionDocument join table**: Many-to-many relationship
- **OrganizationSettings extension**: Added documentRetentionDays field
- **Comprehensive indexes**: Optimized for org-scoped queries, date ranges, file types

### 2. Storage Abstraction

**File**: `lib/document-storage.ts`

- **Pluggable interface** (`DocumentStorage`) for future extensibility
- **LocalDiskDocumentStorage** implementation:
  - Files stored in `storage/documents/{orgId}/{year}/{month}/{filename}`
  - Org-scoped directory structure for tenant isolation
  - Automatic directory creation
  - Streaming support for efficient downloads
- **Ready for cloud migration**: Easy to swap LocalDisk → S3/Azure Blob

### 3. API Endpoints (Complete)

All endpoints use `runtime = "nodejs"` and include full auth, validation, and audit logging.

#### Document Management
- `POST /api/orgs/[orgSlug]/documents` - Upload (multipart/form-data, batch support)
- `GET /api/orgs/[orgSlug]/documents` - List with filters, search, pagination
- `GET /api/orgs/[orgSlug]/documents/[id]` - Get single document details
- `PATCH /api/orgs/[orgSlug]/documents/[id]` - Update metadata
- `DELETE /api/orgs/[orgSlug]/documents/[id]` - Soft delete (move to trash)
- `GET /api/orgs/[orgSlug]/documents/[id]/download` - Download/preview with mode=inline|attachment
- `POST /api/orgs/[orgSlug]/documents/[id]/restore` - Restore from trash
- `DELETE /api/orgs/[orgSlug]/documents/[id]/hard` - Permanent delete (admin-only)
- `GET /api/orgs/[orgSlug]/documents/trash` - List trashed documents

#### Transaction Linking
- `POST /api/orgs/[orgSlug]/transactions/[id]/documents` - Link documents to transaction
- `DELETE /api/orgs/[orgSlug]/transactions/[id]/documents` - Unlink documents
- `POST /api/orgs/[orgSlug]/documents/[id]/transactions` - Link document to transactions
- `DELETE /api/orgs/[orgSlug]/documents/[id]/transactions` - Unlink from transactions

### 4. Search & Filtering

**Supported filters**:
- Date range (documentDate with fallback to uploadedAt)
- Linked status (all | linked | unlinked)
- Vendor/Client (via linked transactions)
- Amount range (linked transactions + basic text search)
- File type (all | image | pdf | text)
- Uploader user
- Free-text search (filename, display name, text content, vendor/client names)

**Implementation notes**:
- Complex Prisma query building with dynamic OR/AND conditions
- Pagination with page/pageSize support
- Returns linked transaction metadata in list responses

### 5. UI Pages (Complete)

#### Documents Library (`/o/[orgSlug]/documents`)
- **Features**:
  - Upload button with multi-file support
  - Comprehensive filter panel
  - Document cards with thumbnails/icons
  - Display: filename, type badge, file size, date, linked count
  - Actions: View, Download, Trash
  - Pagination controls
- **Patterns**: Follows transactions page structure

#### Document Detail (`/o/[orgSlug]/documents/[id]`)
- **Left side**: Preview panel
  - Images: Native `<img>` preview
  - PDFs: Embedded `<iframe>` viewer
  - Other types: "Open in new tab" fallback
- **Right side**: Metadata & links
  - Editable: display name, type, document date
  - Read-only: file info, upload info
  - Linked transactions list with unlink actions
  - Save button for metadata changes
- **Header**: Back, Download, Trash buttons

#### Trash (`/o/[orgSlug]/documents/trash`)
- **Features**:
  - List all soft-deleted documents
  - Search by filename
  - Actions: Restore, Delete Permanently
  - Shows deletion timestamp
- **Note**: Per requirements, restoring does NOT restore transaction links

### 6. Navigation Integration

**File**: `app/o/[orgSlug]/layout.tsx`

- Added "Documents" to Business section (between Transactions and Accounts)
- Accessible to all members (not admin-only)
- Uses FileText icon for consistency

### 7. Security & Permissions

**Permission tiers**:
- **requireMembership** (any member): Upload, link/unlink, soft delete, restore, download
- **requireAdminOrSuperadmin**: Hard delete only

**Security features**:
- File type validation (MIME + extension)
- File size limits (10 MB)
- Org-scoped queries (all endpoints filter by organizationId)
- storageKey never exposed in API responses
- Auth required for downloads (can't guess URLs)

### 8. Audit Logging

**All operations logged** with structured metadata:
- `document.upload` - documentId, filename, mimeType, fileSizeBytes
- `document.link` / `document.unlink` - documentId, transactionId, filename
- `document.delete` - documentId, filename
- `document.restore` - documentId, filename
- `document.hard_delete` - documentId, filename, storageKey
- `document.download` - documentId, filename, mode

### 9. Soft Delete Behavior

**Design decisions**:
- Soft deleting a document → removes all transaction links immediately
- Restoring a document → does NOT restore previous links (clean slate)
- Transaction soft delete → does NOT delete linked documents (preserves docs)
- Hard delete → removes document from DB + storage + all links

**Rationale**: Prevents confusion and edge cases where linked transactions might be deleted.

## What's NOT Included (Future Work)

The following features from the plan are intentionally deferred:

### Transaction Integration (Deferred)
- ❌ Document indicators on transaction list
- ❌ Documents panel in transaction detail page
- ❌ Document picker component
- ❌ "Upload & link" shortcut in transaction detail

**Reason**: Core document features are complete and usable. Transaction integration would require:
1. Updating transaction list API to include document counts
2. Modifying transaction detail page (complex component)
3. Building document picker dialog
4. These can be added incrementally without API changes

### Advanced Features (Not in v1)
- AI/OCR text extraction (textContent field is prepared but not populated)
- Advanced grouping UI (by month/category/vendor - plan noted client-side implementation)
- Retention policy automation (documentRetentionDays is captured but not enforced)
- Cloud storage migration (abstraction is ready)

## File Structure

```
prisma/
  schema.prisma                           # Document models added
  migrations/
    20251118003404_add_document_management/  # Migration

lib/
  document-storage.ts                     # Storage abstraction (NEW)

app/api/orgs/[orgSlug]/
  documents/
    route.ts                              # Upload + List
    [documentId]/
      route.ts                            # Get + Update + Delete
      download/route.ts                   # Download/preview
      restore/route.ts                    # Restore from trash
      hard/route.ts                       # Permanent delete
      transactions/route.ts               # Link/unlink transactions
    trash/route.ts                        # List trashed documents
  transactions/[transactionId]/documents/
    route.ts                              # Link/unlink documents

app/o/[orgSlug]/
  documents/
    page.tsx                              # Documents library (NEW)
    trash/page.tsx                        # Trash page (NEW)
    [id]/page.tsx                         # Document detail (NEW)
  layout.tsx                              # Updated navigation

.claude/insights/
  session-2025-11-18-003404.md            # Implementation insights
```

## Testing Checklist

Before merging, test these flows:

### Basic Operations
- [ ] Upload single document (JPEG, PNG, PDF, TXT)
- [ ] Upload multiple documents in batch
- [ ] View document in library
- [ ] Edit document metadata (display name, type, date)
- [ ] Download document
- [ ] Preview image document
- [ ] Preview PDF document
- [ ] Move document to trash
- [ ] Restore document from trash
- [ ] Permanently delete document (admin)

### Search & Filtering
- [ ] Filter by date range
- [ ] Filter by linked/unlinked status
- [ ] Filter by file type
- [ ] Search by filename
- [ ] Navigate pagination

### Linking (via API)
- [ ] Link document to transaction (API call)
- [ ] Unlink document from transaction (API call)
- [ ] Verify soft delete removes links
- [ ] Verify restore does not restore links

### Error Cases
- [ ] Upload file exceeding 10 MB limit
- [ ] Upload disallowed file type
- [ ] Access document from different org (403)
- [ ] Download non-existent document (404)

## API Documentation

For detailed API usage, see the route files. Example upload:

```typescript
const formData = new FormData();
formData.append("files", file1);
formData.append("files", file2);

const response = await fetch(`/api/orgs/${orgSlug}/documents`, {
  method: "POST",
  body: formData,
});

const { documents, errors } = await response.json();
```

Example search:

```typescript
const params = new URLSearchParams({
  page: "1",
  pageSize: "20",
  linked: "unlinked",
  fileType: "pdf",
  q: "invoice",
});

const response = await fetch(`/api/orgs/${orgSlug}/documents?${params}`);
const { items, totalPages, totalItems } = await response.json();
```

## Migration Notes

**Safe to run**: Migration adds new tables and does not modify existing transaction/user tables.

**Rollback**: If needed, remove the migration and drop the documents/transaction_documents tables.

**Storage**: The `storage/documents/` directory will be created on first upload. Ensure the application has write permissions.

## Next Steps

To complete the full feature as designed in the plan:

1. **Update transaction list**:
   - Add `documentCount` to transaction list API response
   - Show paperclip icon in transaction rows when documentCount > 0

2. **Add documents panel to transaction detail**:
   - Create reusable DocumentsPanel component
   - Integrate into transaction detail page
   - Add "Add existing document" and "Upload & link" buttons

3. **Build document picker**:
   - Create DocumentPickerDialog component
   - Reuse documents list API with unlinked filter
   - Handle multi-select and linking

4. **Optional enhancements**:
   - Add client-side grouping (by month/category/vendor)
   - Implement retention policy job
   - Add OCR/AI text extraction pipeline

## Notes

- All code follows established Sololedger patterns (multi-tenant, soft-delete, audit logging)
- Storage abstraction is ready for cloud migration (S3, Azure Blob)
- UI matches existing page designs (transactions, reports)
- Full TypeScript type safety maintained
- No breaking changes to existing code
