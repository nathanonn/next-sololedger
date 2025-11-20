# API Documentation for MCP Server

Complete reference for all organization-scoped API endpoints in SoloLedger. This documentation is designed for building MCP servers and external integrations using Personal API Keys.

## Table of Contents

- [Authentication & Security](#authentication--security)
- [Common Response Patterns](#common-response-patterns)
- [API Endpoints](#api-endpoints)
  - [1. Organization Management](#1-organization-management)
  - [2. Settings](#2-settings)
  - [3. Transactions](#3-transactions)
  - [4. Categories](#4-categories)
  - [5. Accounts](#5-accounts)
  - [6. Vendors](#6-vendors)
  - [7. Clients](#7-clients)
  - [8. Documents](#8-documents)
  - [9. Reports](#9-reports)
- [Implementation Patterns](#implementation-patterns)

---

## Authentication & Security

### Authentication Methods

All organization-scoped endpoints support two authentication methods:

1. **Cookie-based** (browser sessions)
2. **Bearer tokens** (API keys via `/api/auth/api-key/exchange`)

For MCP servers, use Bearer token authentication:

```bash
# Step 1: Exchange API key for access token
curl -X POST https://app.sololedger.local/api/auth/api-key/exchange \
  -H "Authorization: ApiKey slk_YOUR_API_KEY"

# Step 2: Use access token for API calls
curl https://app.sololedger.local/api/orgs/my-org/transactions \
  -H "Authorization: Bearer <access-token>"
```

### Three-Layer Security Model

All organization-scoped routes implement defense-in-depth:

1. **User Authentication**: `getCurrentUser(request)` validates JWT or cookie session
2. **Membership Check**: Verifies user belongs to the organization
3. **API Key Scoping**: Ensures API keys can only access their designated organization

### Permission Tiers

- **Member**: Read access and regular CRUD operations (GET, POST, PATCH soft-delete)
- **Admin or Superadmin**: Destructive operations (hard delete, configuration changes)

**Pattern**: Regular operations accessible to all members; destructive operations require elevated privileges.

---

## Common Response Patterns

### Success Responses

- **200 OK**: Successful GET or PATCH
- **201 Created**: Successful POST for resource creation
- **204 No Content**: Successful DELETE (rare, most return `{ success: true }`)

### Error Responses

```typescript
{
  error: string;        // Human-readable error message
  details?: unknown;    // Optional validation details (e.g., Zod errors)
}
```

**Status Codes**:
- **400 Bad Request**: Invalid input, validation errors
- **401 Unauthorized**: Not authenticated
- **403 Forbidden**: Authenticated but lacks permission (membership, admin role, API key scope)
- **404 Not Found**: Resource doesn't exist or soft-deleted
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server-side error

---

## API Endpoints

### 1. Organization Management

#### GET `/api/orgs/[orgSlug]`

Get organization details.

- **Auth**: Admin or Superadmin
- **Response**:
  ```typescript
  {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    updatedAt: string;
  }
  ```

#### PATCH `/api/orgs/[orgSlug]`

Update organization details.

- **Auth**: Admin or Superadmin (Superadmin only for slug changes)
- **Request Body**:
  ```typescript
  {
    name?: string;        // 1-255 chars
    slug?: string;        // Superadmin only, unique
  }
  ```
- **Validation**: Slug format (lowercase, alphanumeric + hyphens), reserved slugs, uniqueness
- **Response**:
  ```typescript
  {
    organization: {
      id: string;
      name: string;
      slug: string;
      updatedAt: string;
    }
  }
  ```

#### DELETE `/api/orgs/[orgSlug]`

Delete organization (cascades memberships, invitations).

- **Auth**: Superadmin only
- **Response**:
  ```typescript
  {
    success: true;
  }
  ```

#### POST `/api/orgs/[orgSlug]/complete-onboarding`

Mark organization onboarding as complete.

- **Auth**: Member
- **Validation**: Requires at least 1 active income category and 1 active expense category
- **Response**:
  ```typescript
  {
    success: true;
    organization: {
      id: string;
      slug: string;
      onboardingComplete: boolean;
    }
  }
  ```

---

### 2. Settings

#### Business Settings

##### GET `/api/orgs/[orgSlug]/settings/business`

Get business settings.

- **Auth**: Member
- **Response**:
  ```typescript
  {
    organization: {
      id: string;
      name: string;
    };
    settings: {
      businessType: "Freelance" | "Consulting" | "Agency" | "SaaS" | "Other";
      businessTypeOther: string | null;
      address: string | null;
      phone: string | null;
      email: string | null;
      taxId: string | null;
    } | null;
  }
  ```

##### PATCH `/api/orgs/[orgSlug]/settings/business`

Update business settings.

- **Auth**: Admin or Superadmin
- **Request Body**:
  ```typescript
  {
    businessName: string;              // 1-255 chars
    businessType: "Freelance" | "Consulting" | "Agency" | "SaaS" | "Other";
    businessTypeOther?: string | null; // Required if businessType is "Other"
    address?: string | null;           // Max 1000 chars
    phone?: string | null;             // Max 50 chars
    email?: string | null;             // Valid email or empty string
    taxId?: string | null;             // Max 100 chars
  }
  ```
- **Response**:
  ```typescript
  {
    success: true;
    organization: { id, name };
    settings: BusinessSettings;
  }
  ```

#### Financial Settings

##### GET `/api/orgs/[orgSlug]/settings/financial`

Get financial configuration.

- **Auth**: Member (members need formatting settings)
- **Response**:
  ```typescript
  {
    settings: {
      baseCurrency: string;               // 3-char currency code (e.g., "USD")
      fiscalYearStartMonth: number;       // 1-12 (1 = January)
      dateFormat: "DD_MM_YYYY" | "MM_DD_YYYY" | "YYYY_MM_DD";
      decimalSeparator: "DOT" | "COMMA";
      thousandsSeparator: "COMMA" | "DOT" | "SPACE" | "NONE";
      softClosedBefore: string | null;    // ISO date
    } | null;
  }
  ```

##### PATCH `/api/orgs/[orgSlug]/settings/financial`

Update financial configuration.

- **Auth**: Admin or Superadmin
- **Request Body**:
  ```typescript
  {
    baseCurrency: string;          // 3-char code, auto-uppercased
    fiscalYearStartMonth: number;  // 1-12
    dateFormat: "DD_MM_YYYY" | "MM_DD_YYYY" | "YYYY_MM_DD";
    decimalSeparator: "DOT" | "COMMA";
    thousandsSeparator: "COMMA" | "DOT" | "SPACE" | "NONE";
  }
  ```
- **Validation**: Decimal and thousands separators must be different
- **Response**:
  ```typescript
  {
    success: true;
    settings: FinancialSettings;
  }
  ```

---

### 3. Transactions

Transactions use a **dual-currency model** supporting both base currency (organization default) and optional secondary currency with exchange rate tracking.

#### GET `/api/orgs/[orgSlug]/transactions`

List transactions with optional filters.

- **Auth**: Member
- **Query Parameters**:
  ```typescript
  {
    type?: "INCOME" | "EXPENSE";
    status?: "DRAFT" | "POSTED";
    dateFrom?: string;              // ISO date
    dateTo?: string;                // ISO date
    clientId?: string;              // Filter by client
    vendorId?: string;              // Filter by vendor
    categoryIds?: string;           // Comma-separated category IDs
    amountMin?: string;             // Number string
    amountMax?: string;             // Number string
    currency?: string;              // "BASE" or 3-char currency code
  }
  ```
- **Response**:
  ```typescript
  {
    transactions: Array<{
      id: string;
      type: "INCOME" | "EXPENSE";
      status: "DRAFT" | "POSTED";
      amountBase: number;
      currencyBase: string;
      amountSecondary: number | null;
      currencySecondary: string | null;
      date: string;
      description: string;
      notes: string | null;
      category: { id, name, type };
      account: { id, name };
      vendor: { id, name } | null;
      client: { id, name } | null;
      documentCount: number;
      createdAt: string;
      updatedAt: string;
    }>
  }
  ```

#### POST `/api/orgs/[orgSlug]/transactions`

Create a new transaction.

- **Auth**: Member
- **Request Body**:
  ```typescript
  {
    type: "INCOME" | "EXPENSE";
    status: "DRAFT" | "POSTED";
    amountBase: number;                    // Positive, in org base currency
    amountSecondary?: number | null;       // Must pair with currencySecondary
    currencySecondary?: string | null;     // 3-char code, must pair with amountSecondary
    date: string;                          // ISO date
    description: string;                   // Min 1 char
    categoryId: string;                    // Must match type
    accountId: string;
    vendorId?: string | null;              // EXPENSE only
    vendorName?: string | null;            // EXPENSE only, auto-creates vendor
    clientId?: string | null;              // INCOME only
    clientName?: string | null;            // INCOME only, auto-creates client
    notes?: string | null;
  }
  ```
- **Validation Rules**:
  - INCOME transactions: can only have clients (no vendors)
  - EXPENSE transactions: can only have vendors (no clients)
  - POSTED status: cannot have future dates
  - Category type must match transaction type
  - Both `amountSecondary` and `currencySecondary` must be provided together or both null
- **Auto-creation**: Vendors/clients created if name provided without ID
- **Response**: `{ transaction }` with full relations (201 Created)

**Example Request**:
```json
{
  "type": "EXPENSE",
  "status": "POSTED",
  "amountBase": 150.00,
  "amountSecondary": 120.00,
  "currencySecondary": "EUR",
  "date": "2025-11-15",
  "description": "Office supplies",
  "categoryId": "clx123",
  "accountId": "clx456",
  "vendorName": "Staples",
  "notes": "Monthly office supplies order"
}
```

#### GET `/api/orgs/[orgSlug]/transactions/[transactionId]`

Get single transaction details.

- **Auth**: Member
- **Response**:
  ```typescript
  {
    transaction: {
      // All transaction fields
      category: { id, name, type };
      account: { id, name };
      vendor: { id, name } | null;
      client: { id, name } | null;
      documents: Array<{ id, displayName, filename }>;
    }
  }
  ```

#### PATCH `/api/orgs/[orgSlug]/transactions/[transactionId]`

Update a transaction.

- **Auth**: Member
- **Request Body**: Same fields as POST but all optional, plus:
  ```typescript
  {
    allowSoftClosedOverride?: boolean;  // Required if editing soft-closed POSTED transaction
    // ... all fields from POST as optional
  }
  ```
- **Validation**:
  - Cannot change type if client/vendor already set
  - Soft-closed period check for POSTED transactions (requires override flag)
  - Cannot convert POSTED transaction to future date
- **Response**: `{ transaction }` with full relations

#### DELETE `/api/orgs/[orgSlug]/transactions/[transactionId]`

Soft delete a transaction (moves to trash).

- **Auth**: Member
- **Effect**: Sets `deletedAt` timestamp, preserves data
- **Response**: `{ success: true }`

#### POST `/api/orgs/[orgSlug]/transactions/[transactionId]/restore`

Restore a soft-deleted transaction.

- **Auth**: Member
- **Response**: `{ transaction }` with full relations

#### DELETE `/api/orgs/[orgSlug]/transactions/[transactionId]/hard-delete`

Permanently delete a soft-deleted transaction.

- **Auth**: Member
- **Validation**: Transaction must be soft-deleted first
- **Effect**: Removes record from database permanently
- **Response**: `{ success: true }`

#### POST `/api/orgs/[orgSlug]/transactions/bulk`

Perform bulk operations on multiple transactions.

- **Auth**: Member
- **Request Body**:
  ```typescript
  {
    transactionIds: string[];              // Min 1 ID, array of transaction IDs
    action: "changeCategory" | "changeStatus" | "delete";
    categoryId?: string;                   // Required for "changeCategory"
    status?: "DRAFT" | "POSTED";           // Required for "changeStatus"
    allowSoftClosedOverride?: boolean;     // Optional override for soft-closed period
  }
  ```
- **Response**:
  ```typescript
  {
    successCount: number;
    failureCount: number;
    failures: Array<{
      transactionId: string;
      reason: string;
    }>;
  }
  ```

**Example Request**:
```json
{
  "transactionIds": ["clx123", "clx456", "clx789"],
  "action": "changeCategory",
  "categoryId": "clx999"
}
```

#### GET `/api/orgs/[orgSlug]/transactions/trash`

List soft-deleted transactions.

- **Auth**: Member
- **Query Parameters**:
  ```typescript
  {
    type?: "INCOME" | "EXPENSE";
    deletedFrom?: string;  // ISO date
    deletedTo?: string;    // ISO date
    search?: string;       // Search description, vendorName, clientName
  }
  ```
- **Response**: `{ transactions: Transaction[] }`

#### GET `/api/orgs/[orgSlug]/transactions/export`

Export selected transactions to CSV.

- **Auth**: Member
- **Query Parameters**: `ids=id1,id2,id3` (comma-separated, required)
- **Response**: CSV file download
- **Headers**: ID, Date, Type, Status, Description, Category, Account, Vendor, Client, Amount (Base), Currency (Base), Amount (Secondary), Currency (Secondary), Exchange Rate, Notes

#### POST `/api/orgs/[orgSlug]/transactions/export-range`

Export transactions by date range to CSV.

- **Auth**: Member
- **Request Body**:
  ```typescript
  {
    dateFrom: string;  // ISO date
    dateTo: string;    // ISO date
    type?: "INCOME" | "EXPENSE";
    status?: "DRAFT" | "POSTED";
  }
  ```
- **Response**: CSV file download with same headers as export endpoint

#### Transaction-Document Linking

##### POST `/api/orgs/[orgSlug]/transactions/[transactionId]/documents`

Link documents to a transaction.

- **Auth**: Member
- **Request Body**:
  ```typescript
  {
    documentIds: string[];  // Min 1 document ID
  }
  ```
- **Response**:
  ```typescript
  {
    linkedDocuments: Array<{
      id: string;
      displayName: string;
      filename: string;
      // ... other document fields
    }>;
  }
  ```
- **Audit**: Logs `document.link` event

##### DELETE `/api/orgs/[orgSlug]/transactions/[transactionId]/documents`

Unlink documents from a transaction.

- **Auth**: Member
- **Request Body**:
  ```typescript
  {
    documentIds: string[];  // Min 1 document ID
  }
  ```
- **Response**: `{ linkedDocuments: Document[] }` (remaining linked documents)
- **Audit**: Logs `document.unlink` event

---

### 4. Categories

Categories organize transactions into income and expense groups with optional hierarchy (parent-child relationships).

#### GET `/api/orgs/[orgSlug]/categories`

List all categories.

- **Auth**: Member
- **Response**:
  ```typescript
  {
    categories: Array<{
      id: string;
      name: string;
      type: "INCOME" | "EXPENSE";
      parentId: string | null;
      parent: { id, name } | null;
      color: string | null;
      icon: string | null;
      includeInPnL: boolean;
      active: boolean;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
    }>
  }
  ```
- **Ordering**: By type, sortOrder, name

#### POST `/api/orgs/[orgSlug]/categories`

Create a new category.

- **Auth**: Member
- **Request Body**:
  ```typescript
  {
    name: string;                  // 1-255 chars, required
    type: "INCOME" | "EXPENSE";    // Required
    parentId?: string | null;      // Optional parent category
    color?: string | null;         // Max 50 chars
    icon?: string | null;          // Max 50 chars
    includeInPnL?: boolean;        // Default true
    active?: boolean;              // Default true
  }
  ```
- **Validation**: Parent must exist, belong to organization, and have same type as child
- **Response**: `{ category }` (201 Created)

**Example Request**:
```json
{
  "name": "Software Subscriptions",
  "type": "EXPENSE",
  "parentId": "clx_operating_expenses",
  "color": "#3B82F6",
  "icon": "laptop",
  "includeInPnL": true,
  "active": true
}
```

#### PATCH `/api/orgs/[orgSlug]/categories/[categoryId]`

Update a category.

- **Auth**: Member
- **Request Body**: Same as POST but all fields optional
- **Validation**:
  - Cannot be its own parent
  - Parent type must match category type
- **Response**: `{ category }`

#### POST `/api/orgs/[orgSlug]/categories/reorder`

Reorder categories within their groups.

- **Auth**: Member
- **Request Body**:
  ```typescript
  {
    categories: Array<{
      id: string;
      sortOrder: number;  // Min 0
    }>
  }
  ```
- **Grouping**: Categories are reordered within (type, parentId) groups only
- **Response**:
  ```typescript
  {
    message: string;
    updated: number;
  }
  ```

#### GET `/api/orgs/[orgSlug]/categories/usage`

Get category usage analytics.

- **Auth**: Member
- **Query Parameters**:
  ```typescript
  {
    from?: string;  // ISO date, defaults to 12 months ago
    to?: string;    // ISO date, defaults to now
  }
  ```
- **Response**:
  ```typescript
  {
    usage: Array<{
      id: string;
      name: string;
      type: "INCOME" | "EXPENSE";
      active: boolean;
      sortOrder: number;
      transactionCount: number;    // POSTED transactions only
      totalAmount: number;         // Base currency
      lastUsedAt: string | null;   // ISO date of last POSTED transaction
    }>;
    dateRange: {
      from: string;
      to: string;
    };
  }
  ```

#### POST `/api/orgs/[orgSlug]/categories/seed`

Seed default categories for a new organization.

- **Auth**: Member
- **Purpose**: Populates starter income/expense categories during onboarding
- **Response**:
  ```typescript
  {
    success: true;
    categoriesCreated: number;
  }
  ```

#### POST `/api/orgs/[orgSlug]/categories/[categoryId]/delete-with-reassignment`

Delete a category and reassign its transactions.

- **Auth**: Member
- **Request Body**:
  ```typescript
  {
    newCategoryId: string;  // Must have same type as deleted category
  }
  ```
- **Validation**: New category must have same type (INCOME or EXPENSE)
- **Effect**: Reassigns all transactions to new category, deletes old category
- **Response**:
  ```typescript
  {
    success: true;
    transactionsReassigned: number;
  }
  ```

---

### 5. Accounts

Accounts track different payment methods or bank accounts used for transactions.

#### GET `/api/orgs/[orgSlug]/accounts`

List all accounts.

- **Auth**: Admin or Superadmin
- **Response**:
  ```typescript
  {
    accounts: Array<{
      id: string;
      name: string;
      description: string | null;
      isDefault: boolean;
      active: boolean;
      createdAt: string;
      updatedAt: string;
    }>
  }
  ```
- **Ordering**: By `isDefault` desc, `name` asc

#### POST `/api/orgs/[orgSlug]/accounts`

Create a new account.

- **Auth**: Admin or Superadmin
- **Request Body**:
  ```typescript
  {
    name: string;                  // 1-255 chars, required
    description?: string | null;   // Max 1000 chars
    isDefault?: boolean;           // Default false
    active?: boolean;              // Default true
  }
  ```
- **Behavior**: Setting `isDefault: true` clears the flag from other accounts
- **Response**: `{ account }` (201 Created)

#### PATCH `/api/orgs/[orgSlug]/accounts/[accountId]`

Update an account.

- **Auth**: Admin or Superadmin
- **Request Body**: Same as POST but all fields optional
- **Behavior**: Setting `isDefault: true` clears the flag from other accounts
- **Response**: `{ account }`

#### GET `/api/orgs/[orgSlug]/accounts/balances`

Get account balances for a date range.

- **Auth**: Member
- **Query Parameters**:
  ```typescript
  {
    from?: string;  // ISO date, defaults to 30 days ago
    to?: string;    // ISO date, defaults to now
  }
  ```
- **Calculation**: `(Income - Expense)` per account, POSTED transactions only
- **Response**:
  ```typescript
  {
    accounts: Array<{
      id: string;
      name: string;
      description: string | null;
      isDefault: boolean;
      active: boolean;
      balanceBase: number;        // Income - Expense in base currency
      transactionCount: number;   // POSTED transactions only
    }>;
    dateRange: {
      from: string;
      to: string;
    };
  }
  ```

---

### 6. Vendors

Vendors are expense payees (service providers, suppliers, etc.).

#### GET `/api/orgs/[orgSlug]/vendors`

List vendors with optional search and transaction totals.

- **Auth**: Member
- **Query Parameters**:
  ```typescript
  {
    query?: string;  // Name search (case-insensitive)
    from?: string;   // ISO date - includes totals if both from/to provided
    to?: string;     // ISO date - includes totals if both from/to provided
  }
  ```
- **Response**:
  ```typescript
  {
    vendors: Array<{
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      notes: string | null;
      createdAt: string;
      updatedAt: string;
      // If date range provided:
      totals?: {
        transactionCount: number;    // EXPENSE POSTED transactions only
        totalAmount: number;         // Base currency
      };
    }>
  }
  ```

#### POST `/api/orgs/[orgSlug]/vendors`

Create a new vendor.

- **Auth**: Member
- **Request Body**:
  ```typescript
  {
    name: string;          // Required, 1-255 chars
    email?: string | null; // Valid email format
    phone?: string | null;
    notes?: string | null;
  }
  ```
- **Validation**: Name uniqueness (case-insensitive via `nameLower` field)
- **Response**: `{ vendor }` (201 Created)

#### PATCH `/api/orgs/[orgSlug]/vendors/[vendorId]`

Update a vendor.

- **Auth**: Member
- **Request Body**: Same as POST but all fields optional
- **Response**: `{ vendor }`

#### POST `/api/orgs/[orgSlug]/vendors/merge`

Merge two vendors (combines transaction history).

- **Auth**: Member
- **Request Body**:
  ```typescript
  {
    sourceVendorId: string;   // Will be deleted after merge
    targetVendorId: string;   // Will receive all transactions
  }
  ```
- **Effect**: Reassigns all transactions from source to target, deletes source vendor
- **Response**:
  ```typescript
  {
    success: true;
    transactionsMerged: number;
  }
  ```

---

### 7. Clients

Clients are income payers (customers, clients, etc.).

#### GET `/api/orgs/[orgSlug]/clients`

List clients with optional search and transaction totals.

- **Auth**: Member
- **Query Parameters**: Same as vendors
- **Response**: Same structure as vendors (INCOME POSTED transactions only for totals)

#### POST `/api/orgs/[orgSlug]/clients`

Create a new client.

- **Auth**: Member
- **Request Body**: Same as vendors
- **Response**: `{ client }` (201 Created)

#### PATCH `/api/orgs/[orgSlug]/clients/[clientId]`

Update a client.

- **Auth**: Member
- **Request Body**: Same as POST but all fields optional
- **Response**: `{ client }`

#### POST `/api/orgs/[orgSlug]/clients/merge`

Merge two clients (combines transaction history).

- **Auth**: Member
- **Request Body**: Same structure as vendor merge
- **Response**:
  ```typescript
  {
    success: true;
    transactionsMerged: number;
  }
  ```

---

### 8. Documents

Documents are uploaded files (receipts, invoices, statements) that can be linked to transactions.

#### POST `/api/orgs/[orgSlug]/documents`

Upload one or more documents.

- **Auth**: Member
- **Content-Type**: `multipart/form-data`
- **Form Data**: `files: File[]` (array of files)
- **Validation**:
  - Max file size: 10 MB per file
  - Allowed MIME types: `image/jpeg`, `image/png`, `application/pdf`, `text/plain`
- **Response**:
  ```typescript
  {
    documents: Array<{
      id: string;
      filename: string;
      displayName: string;
      mimeType: string;
      fileSize: number;
      type: "RECEIPT" | "INVOICE" | "BANK_STATEMENT" | "OTHER";
      documentDate: string | null;
      uploadedById: string;
      createdAt: string;
    }>;
    errors: Array<{
      filename: string;
      error: string;
    }>;
    success: boolean;
  }
  ```
- **Audit**: Logs `document.upload` event per file

**Example Usage** (multipart form):
```bash
curl -X POST https://app.sololedger.local/api/orgs/my-org/documents \
  -H "Authorization: Bearer <token>" \
  -F "files=@receipt1.pdf" \
  -F "files=@receipt2.jpg"
```

#### GET `/api/orgs/[orgSlug]/documents`

List and search documents with filters and pagination.

- **Auth**: Member
- **Query Parameters**:
  ```typescript
  {
    page?: number;           // Default 1
    pageSize?: number;       // Default 20, max 100
    dateFrom?: string;       // Filters documentDate or uploadedAt (ISO date)
    dateTo?: string;         // ISO date
    linked?: "all" | "linked" | "unlinked";  // Default "all"
    vendorId?: string;       // Via linked transactions
    clientId?: string;       // Via linked transactions
    amountMin?: string;      // Via linked transactions
    amountMax?: string;      // Via linked transactions
    fileType?: "all" | "image" | "pdf" | "text";  // Default "all"
    uploaderId?: string;
    q?: string;              // Search filename, displayName, textContent, vendor/client names
  }
  ```
- **Response**:
  ```typescript
  {
    items: Array<{
      id: string;
      filename: string;
      displayName: string;
      mimeType: string;
      fileSize: number;
      type: "RECEIPT" | "INVOICE" | "BANK_STATEMENT" | "OTHER";
      documentDate: string | null;
      textContent: string | null;
      uploadedBy: { id, name, email };
      isLinked: boolean;
      linkedTransactionCount: number;
      linkedTransactions: Transaction[];  // First 3 only
      createdAt: string;
      updatedAt: string;
    }>;
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  }
  ```

#### GET `/api/orgs/[orgSlug]/documents/[documentId]`

Get document details with all linked transactions.

- **Auth**: Member
- **Response**:
  ```typescript
  {
    id: string;
    filename: string;
    displayName: string;
    mimeType: string;
    fileSize: number;
    type: "RECEIPT" | "INVOICE" | "BANK_STATEMENT" | "OTHER";
    documentDate: string | null;
    textContent: string | null;
    uploadedBy: { id, name, email };
    linkedTransactions: Array<{
      id: string;
      type: "INCOME" | "EXPENSE";
      status: "DRAFT" | "POSTED";
      amountBase: number;
      date: string;
      description: string;
      category: { id, name };
      vendor: { id, name } | null;
      client: { id, name } | null;
      linkedAt: string;  // ISO date when linked
    }>;
    createdAt: string;
    updatedAt: string;
  }
  ```

#### PATCH `/api/orgs/[orgSlug]/documents/[documentId]`

Update document metadata.

- **Auth**: Member
- **Request Body**:
  ```typescript
  {
    displayName?: string;     // 1-255 chars
    type?: "RECEIPT" | "INVOICE" | "BANK_STATEMENT" | "OTHER";
    documentDate?: string | null;  // ISO date
  }
  ```
- **Response**: Updated document object

#### DELETE `/api/orgs/[orgSlug]/documents/[documentId]`

Soft delete document (move to trash).

- **Auth**: Member
- **Effect**: Sets `deletedAt` timestamp, removes all transaction links
- **Response**:
  ```typescript
  {
    success: true;
    message: string;
  }
  ```
- **Audit**: Logs `document.delete` event

#### POST `/api/orgs/[orgSlug]/documents/[documentId]/restore`

Restore a soft-deleted document.

- **Auth**: Member
- **Effect**: Clears `deletedAt` timestamp (does not restore transaction links)
- **Response**: `{ document }`

#### DELETE `/api/orgs/[orgSlug]/documents/[documentId]/hard`

Permanently delete a soft-deleted document.

- **Auth**: Admin or Superadmin
- **Validation**: Document must be soft-deleted first
- **Effect**: Deletes file from storage and database record permanently
- **Response**: `{ success: true }`

#### GET `/api/orgs/[orgSlug]/documents/[documentId]/download`

Download or preview a document.

- **Auth**: Member
- **Query Parameters**: `mode=attachment|inline` (default: attachment)
- **Response**: File stream with appropriate Content-Disposition and Content-Type headers
- **Audit**: Logs `document.download` event

**Example**:
```bash
# Download file
curl https://app.sololedger.local/api/orgs/my-org/documents/clx123/download \
  -H "Authorization: Bearer <token>" \
  -o receipt.pdf

# Preview in browser (if supported)
curl "https://app.sololedger.local/api/orgs/my-org/documents/clx123/download?mode=inline" \
  -H "Authorization: Bearer <token>"
```

#### GET `/api/orgs/[orgSlug]/documents/trash`

List soft-deleted documents.

- **Auth**: Member
- **Query Parameters**:
  ```typescript
  {
    page?: number;        // Default 1
    pageSize?: number;    // Default 20, max 100
    deletedFrom?: string; // ISO date
    deletedTo?: string;   // ISO date
  }
  ```
- **Response**: Paginated deleted documents (same structure as list endpoint)

#### Document-Transaction Linking

##### POST `/api/orgs/[orgSlug]/documents/[documentId]/transactions`

Link a document to multiple transactions.

- **Auth**: Member
- **Request Body**:
  ```typescript
  {
    transactionIds: string[];  // Min 1 transaction ID
  }
  ```
- **Response**:
  ```typescript
  {
    linkedTransactions: Transaction[];  // All currently linked transactions
  }
  ```

##### DELETE `/api/orgs/[orgSlug]/documents/[documentId]/transactions`

Unlink a document from transactions.

- **Auth**: Member
- **Request Body**:
  ```typescript
  {
    transactionIds: string[];  // Min 1 transaction ID
  }
  ```
- **Response**: `{ linkedTransactions: Transaction[] }` (remaining linked transactions)

#### Document AI Extraction

##### POST `/api/orgs/[orgSlug]/documents/[documentId]/ai/extract`

Extract data from a document using AI.

- **Auth**: Member
- **Request Body**:
  ```typescript
  {
    fields?: string[];  // Specific fields to extract
    prompt?: string;    // Custom extraction prompt
  }
  ```
- **Response**:
  ```typescript
  {
    extraction: {
      id: string;
      data: object;           // Extracted fields
      status: "pending" | "completed" | "failed";
      createdAt: string;
    }
  }
  ``` (201 Created)

##### GET `/api/orgs/[orgSlug]/documents/[documentId]/ai/extractions`

List all AI extractions for a document.

- **Auth**: Member
- **Response**: `{ extractions: Extraction[] }`

##### GET `/api/orgs/[orgSlug]/documents/[documentId]/ai/extractions/[extractionId]`

Get specific extraction.

- **Auth**: Member
- **Response**: `{ extraction }`

##### PATCH `/api/orgs/[orgSlug]/documents/[documentId]/ai/extractions/[extractionId]`

Update extraction data.

- **Auth**: Member
- **Request Body**: Partial extraction data
- **Response**: `{ extraction }`

##### POST `/api/orgs/[orgSlug]/documents/[documentId]/ai/extractions/[extractionId]/set-active`

Set an extraction as the active/preferred one.

- **Auth**: Member
- **Response**: `{ success: true }`

##### GET `/api/orgs/[orgSlug]/documents/ai/prompt-history`

Get AI prompt history for document processing.

- **Auth**: Member
- **Response**: `{ prompts: PromptHistory[] }`

---

### 9. Reports

#### Profit & Loss (P&L)

##### GET or POST `/api/orgs/[orgSlug]/reports/pnl`

Generate Profit & Loss report.

- **Auth**: Member
- **Methods**: GET (query params) or POST (request body)
- **Parameters**:
  ```typescript
  {
    dateMode?: "fiscalYear" | "calendarYear" | "ytd" | "lastMonth" | "custom";  // Default "fiscalYear"
    customFrom?: string;   // ISO date, required if dateMode="custom"
    customTo?: string;     // ISO date, required if dateMode="custom"
    detailLevel?: "summary" | "detailed";  // Default "summary"
  }
  ```
- **Response**:
  ```typescript
  {
    income: Array<{
      categoryId: string;
      categoryName: string;
      amount: number;
      percentage: number;
      transactionCount: number;
    }>;
    expenses: Array<{
      categoryId: string;
      categoryName: string;
      amount: number;
      percentage: number;
      transactionCount: number;
    }>;
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;        // totalIncome - totalExpenses
    dateRange: {
      from: string;
      to: string;
    };
    // Organization settings for formatting
    baseCurrency: string;
    dateFormat: string;
    decimalSeparator: string;
    thousandsSeparator: string;
  }
  ```

**Note**: YTD (Year-To-Date) uses fiscal year based on `fiscalYearStartMonth`, not calendar year.

##### GET `/api/orgs/[orgSlug]/reports/categories`

Category breakdown report.

- **Auth**: Member
- **Query Parameters**:
  ```typescript
  {
    from?: string;  // ISO date
    to?: string;    // ISO date
    type?: "INCOME" | "EXPENSE";
  }
  ```
- **Response**: Category-wise totals, percentages, and transaction counts

##### GET `/api/orgs/[orgSlug]/reports/vendors`

Vendor spending report.

- **Auth**: Member
- **Query Parameters**:
  ```typescript
  {
    from?: string;  // ISO date
    to?: string;    // ISO date
    limit?: number; // Top N vendors by spending
  }
  ```
- **Response**: Vendor-wise expense totals, transaction counts, and averages

---

## Implementation Patterns

### Dual-Currency Model

Transactions support both base currency (organization default) and optional secondary currency with exchange rate tracking.

**Fields**:
- `amountBase`: Amount in organization's base currency (always present)
- `currencyBase`: Organization's base currency code (always present)
- `amountSecondary`: Amount in foreign currency (optional)
- `currencySecondary`: Foreign currency code (optional)

**Rules**:
- Both `amountSecondary` and `currencySecondary` must be provided together or both null
- Base currency fields are automatically populated from organization settings
- Legacy fields (`amountOriginal`, `currencyOriginal`, `exchangeRateToBase`) maintained for backward compatibility

**Example**:
```json
{
  "amountBase": 150.00,
  "currencyBase": "USD",
  "amountSecondary": 120.00,
  "currencySecondary": "EUR"
}
```

### Soft Delete Pattern

Resources with `deletedAt: DateTime?` field support soft deletion:

**Affected Resources**:
- Transactions
- Documents

**Workflow**:
1. **Soft Delete**: Sets `deletedAt` timestamp, preserves data
2. **Active Queries**: Filter with `deletedAt: null`
3. **Trash Endpoints**: List soft-deleted records
4. **Restore**: Clears `deletedAt` timestamp
5. **Hard Delete**: Permanently removes record (admin+ only)

**Benefits**:
- Accidental deletion recovery
- Audit trail preservation
- Compliance with data retention policies

### Auto-Creation Pattern

Vendors and clients are automatically created when names are provided without IDs.

**How it works**:
1. Transaction includes `vendorName` or `clientName` without corresponding ID
2. System performs case-insensitive lookup via `nameLower` field
3. If found: uses existing record
4. If not found: creates new vendor/client record
5. Links transaction to vendor/client

**Example**:
```json
{
  "type": "EXPENSE",
  "vendorName": "Staples",  // No vendorId provided
  // ... other fields
}
```
Result: System finds or creates vendor "Staples" and links to transaction.

### Fiscal Year Support

Date calculations respect organization's fiscal year configuration.

**Configuration**: `fiscalYearStartMonth` (1-12, where 1 = January)

**Affected Features**:
- YTD (Year-To-Date) reports use fiscal year, not calendar year
- P&L "fiscalYear" mode respects custom fiscal year start
- Dashboard widgets show fiscal year metrics

**Example**:
- Fiscal year starts in July (`fiscalYearStartMonth: 7`)
- Current date: December 15, 2025
- YTD period: July 1, 2025 - December 15, 2025 (not January 1 - December 15)

### Soft-Closed Period

Financial settings include `softClosedBefore` date to prevent accidental edits to finalized periods.

**Rules**:
- Applies to POSTED transactions only
- Editing transactions before `softClosedBefore` requires `allowSoftClosedOverride: true` flag
- DRAFT transactions always editable
- Prevents accidental changes to closed books

**Override Example**:
```json
{
  "description": "Updated description",
  "allowSoftClosedOverride": true
}
```

### Audit Logging

Key actions are logged to `audit_logs` table for compliance and security.

**Logged Events**:
- `org_updated`, `org_deleted`
- `document.upload`, `document.delete`, `document.download`, `document.link`, `document.unlink`

**Metadata**: Includes relevant context (user ID, IP address, resource IDs, names, changes)

### Rate Limiting

API endpoints may have rate limits to prevent abuse. Rate limit information is provided in response headers when applicable.

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699999999
```

### CSRF Protection

All mutation endpoints (POST, PATCH, DELETE) require CSRF token validation.

**Implementation**: `validateCsrf(request)` middleware

**Exemptions**: API key authentication (Bearer tokens) bypasses CSRF checks as tokens are not vulnerable to CSRF attacks.

### File Constraints

**Documents**:
- Max size: 10 MB per file
- Allowed types: `image/jpeg`, `image/png`, `application/pdf`, `text/plain`
- Storage: Server-side file system with metadata in database

**CSV Exports**:
- No size limits (server-generated, streamed to client)
- Dual-currency fields included
- All fields in UTF-8 encoding

### Pagination

List endpoints support pagination with consistent patterns.

**Query Parameters**:
```typescript
{
  page?: number;      // Default 1
  pageSize?: number;  // Default varies (20-50), max typically 100
}
```

**Response**:
```typescript
{
  items: T[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}
```

### Error Handling

All endpoints return consistent error formats.

**Structure**:
```typescript
{
  error: string;        // Human-readable message
  details?: unknown;    // Optional validation details
}
```

**Common Errors**:
- **400**: Zod validation errors include field-level details
- **401**: "Unauthorized" - not authenticated
- **403**: "Forbidden" - lacks permission or API key scope violation
- **404**: "Not found" - resource doesn't exist or soft-deleted
- **429**: "Rate limited" - includes retry-after header
- **500**: "Internal server error" - logged server-side

---

## Quick Reference

### Authentication Flow

```
1. Exchange API Key � Access Token
   POST /api/auth/api-key/exchange
   Header: Authorization: ApiKey slk_...
   Response: { accessToken, tokenType: "Bearer", expiresIn: 3600 }

2. Use Access Token for API Calls
   Header: Authorization: Bearer <accessToken>

3. Re-exchange when token expires (1 hour)
```

### Common Workflows

**Create Transaction with Auto-Created Vendor**:
```bash
POST /api/orgs/my-org/transactions
{
  "type": "EXPENSE",
  "status": "POSTED",
  "amountBase": 99.99,
  "date": "2025-11-15",
  "description": "Software license",
  "categoryId": "clx_category",
  "accountId": "clx_account",
  "vendorName": "Adobe"  # Auto-creates if not exists
}
```

**Upload Document and Link to Transaction**:
```bash
# 1. Upload
POST /api/orgs/my-org/documents
Content-Type: multipart/form-data
files=@receipt.pdf

# 2. Link
POST /api/orgs/my-org/transactions/clx_txn/documents
{ "documentIds": ["clx_doc"] }
```

**Generate P&L Report**:
```bash
GET /api/orgs/my-org/reports/pnl?dateMode=fiscalYear&detailLevel=summary
```

### Permission Quick Reference

| Endpoint | Member | Admin | Superadmin |
|----------|--------|-------|------------|
| GET (read) |  |  |  |
| POST (create) |  |  |  |
| PATCH (update) | * |  |  |
| DELETE (soft) | * |  |  |
| DELETE (hard) |  |  |  |
| Settings |  |  |  |
| Organization |  | ** |  |

\* Some resources (settings, accounts) require admin+
\** Slug changes require superadmin

---

## MCP Server Implementation Tips

### Token Management

```typescript
class TokenManager {
  private accessToken: string | null = null;
  private expiresAt: number = 0;

  async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt) {
      return this.accessToken;
    }

    // Re-exchange
    const response = await fetch('/api/auth/api-key/exchange', {
      headers: { 'Authorization': `ApiKey ${API_KEY}` }
    });
    const data = await response.json();

    this.accessToken = data.accessToken;
    this.expiresAt = Date.now() + (data.expiresIn * 1000) - 60000; // 1min buffer

    return this.accessToken;
  }
}
```

### Error Handling

```typescript
async function apiCall(endpoint: string, options: RequestInit) {
  const token = await tokenManager.getToken();

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API Error (${response.status}): ${error.error}`);
  }

  return response.json();
}
```

### Pagination Helper

```typescript
async function* fetchAllPages<T>(endpoint: string): AsyncGenerator<T[]> {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const data = await apiCall(`${endpoint}?page=${page}&pageSize=100`);
    yield data.items;

    hasMore = page < data.totalPages;
    page++;
  }
}

// Usage
for await (const transactions of fetchAllPages('/api/orgs/my-org/transactions')) {
  console.log(`Batch: ${transactions.length} transactions`);
}
```

### MCP Tool Examples

```typescript
// Example tool: Create transaction
server.tool({
  name: 'create_transaction',
  description: 'Create a new income or expense transaction',
  inputSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
      amount: { type: 'number' },
      date: { type: 'string' },
      description: { type: 'string' },
      categoryId: { type: 'string' },
      accountId: { type: 'string' },
      vendorName: { type: 'string' },  // Auto-creates
      clientName: { type: 'string' }   // Auto-creates
    },
    required: ['type', 'amount', 'date', 'description', 'categoryId', 'accountId']
  }
}, async ({ type, amount, ...params }) => {
  const transaction = await apiCall('/api/orgs/my-org/transactions', {
    method: 'POST',
    body: JSON.stringify({
      type,
      status: 'POSTED',
      amountBase: amount,
      ...params
    })
  });

  return {
    content: [{
      type: 'text',
      text: `Created ${type.toLowerCase()} transaction: ${transaction.description} ($${transaction.amountBase})`
    }]
  };
});
```

---

## Additional Resources

- [Personal API Key Documentation](./personal_api_key.md) - API key setup and usage
- [CLAUDE.md](../CLAUDE.md) - Full codebase guidelines
- [Authentication Guide](./skills/authentication.md) - Detailed auth implementation

---

**Last Updated**: 2025-11-20
**API Version**: 1.0
**Total Endpoints**: 60 organization-scoped endpoints
