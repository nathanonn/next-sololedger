# SoloLedger MCP Server

Model Context Protocol (MCP) server for SoloLedger financial management API. Enables AI assistants to interact with your SoloLedger organization through 48 comprehensive tools covering transactions, documents, and organizational setup.

## Features

- **Intelligent Token Management**: Bearer token caching with automatic refresh (1-hour lifetime, 60-second buffer)
- **Comprehensive Coverage**: 48 tools across all major SoloLedger features
- **Dual-Currency Support**: Full support for transactions in base and secondary currencies
- **Document Management**: Upload, link, download, and AI data extraction
- **Financial Reporting**: P&L reports, category breakdowns, vendor analytics
- **Secure**: All API calls use Bearer token authentication with API key exchange

## Prerequisites

- Node.js 18+ and npm
- SoloLedger API key (get from Settings → API Access in SoloLedger web app)
- Organization slug (from your SoloLedger organization URL)

## Installation

```bash
cd mcp-server
npm install
npm run build
```

## Configuration

Set the following environment variables:

```bash
export SOLOLEDGER_API_KEY="slk_your_api_key_here"
export SOLOLEDGER_ORG_SLUG="your-organization-slug"
export SOLOLEDGER_API_URL="http://localhost:3000"  # Optional, defaults to localhost:3000
```

Or create a `.env` file (not recommended for production):

```env
SOLOLEDGER_API_KEY=slk_your_api_key_here
SOLOLEDGER_ORG_SLUG=your-organization-slug
SOLOLEDGER_API_URL=http://localhost:3000
```

## Usage

### With MCP Inspector (Testing)

Test the server with MCP Inspector:

```bash
npm run inspector
```

This opens an interactive UI to explore and test all available tools.

### With Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "sololedger": {
      "command": "node",
      "args": ["/absolute/path/to/next-sololedger/mcp-server/dist/index.js"],
      "env": {
        "SOLOLEDGER_API_KEY": "slk_your_api_key_here",
        "SOLOLEDGER_ORG_SLUG": "your-organization-slug",
        "SOLOLEDGER_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

Restart Claude Desktop, and the tools will be available.

### With Other MCP Clients

Any MCP-compatible client can use this server via stdio transport. Configure according to your client's documentation.

## Tool Categories

### 📊 Transactions (13 tools)

Comprehensive transaction management with dual-currency support:

- `transactions_list` - List transactions with advanced filtering (type, status, date range, category, client/vendor, amount)
- `transactions_get` - Get single transaction details with full relations
- `transactions_create` - Create income/expense transactions with auto-vendor/client creation
- `transactions_update` - Update transactions with soft-closed period override
- `transactions_delete` - Soft delete (move to trash)
- `transactions_restore` - Restore from trash
- `transactions_hard_delete` - Permanently delete (requires trash first)
- `transactions_bulk_update` - Bulk category/status changes or deletions
- `transactions_list_trash` - List deleted transactions
- `transactions_export_csv` - Export selected transactions to CSV
- `transactions_export_range_csv` - Export date range to CSV
- `transactions_link_documents` - Link documents to transaction
- `transactions_unlink_documents` - Unlink documents from transaction

### 📁 Documents (13 tools)

Document management with AI extraction:

- `documents_upload` - Upload files (PDF, JPEG, PNG, TXT) from local file paths
- `documents_list` - List/search documents with pagination and filters
- `documents_get` - Get document details with all linked transactions
- `documents_update` - Update metadata (name, type, date)
- `documents_delete` - Soft delete (removes transaction links)
- `documents_restore` - Restore from trash (links not restored)
- `documents_hard_delete` - Permanently delete (admin+ only)
- `documents_download` - Download file as base64
- `documents_list_trash` - List deleted documents
- `documents_link_transactions` - Link document to transactions
- `documents_unlink_transactions` - Unlink document from transactions
- `documents_ai_extract` - AI data extraction from documents
- `documents_ai_list_extractions` - List AI extraction history

### ⚙️ Setup & Configuration (22 tools)

Organizational setup and management:

**Categories (7 tools)**
- `categories_list` - List all categories with hierarchy
- `categories_create` - Create income/expense category
- `categories_update` - Update category details
- `categories_reorder` - Reorder categories within groups
- `categories_usage` - Get usage analytics (count, amount, last used)
- `categories_seed` - Seed default categories for onboarding
- `categories_delete_with_reassignment` - Delete category and reassign transactions

**Accounts (4 tools)**
- `accounts_list` - List payment methods/bank accounts
- `accounts_create` - Create new account
- `accounts_update` - Update account details
- `accounts_balances` - Get account balances for date range

**Vendors (4 tools)**
- `vendors_list` - List vendors with optional totals
- `vendors_create` - Create new vendor
- `vendors_update` - Update vendor details
- `vendors_merge` - Merge two vendors (combines history)

**Clients (4 tools)**
- `clients_list` - List clients with optional totals
- `clients_create` - Create new client
- `clients_update` - Update client details
- `clients_merge` - Merge two clients (combines history)

**Organization (3 tools)**
- `organization_get` - Get organization details
- `organization_update` - Update name/slug
- `organization_complete_onboarding` - Mark onboarding complete

**Settings (4 tools)**
- `settings_business_get` - Get business settings
- `settings_business_update` - Update business settings
- `settings_financial_get` - Get financial configuration
- `settings_financial_update` - Update currency, fiscal year, formatting

## Key Features Explained

### Bearer Token Management

The server implements intelligent token caching:

1. **First API call**: Exchanges API key for access token
2. **Subsequent calls**: Reuses cached token for ~59 minutes
3. **Auto-refresh**: Exchanges for new token when expired (with 60s buffer)
4. **Thread-safe**: Handles concurrent requests during token refresh

This means you'll only see one `/api/auth/api-key/exchange` call even when making dozens of API requests.

### Dual-Currency Transactions

Transactions support both base currency (organization default) and optional secondary currency:

```json
{
  "type": "EXPENSE",
  "amountBase": 150.00,
  "amountSecondary": 120.00,
  "currencySecondary": "EUR",
  "date": "2025-11-15",
  "description": "Office supplies",
  "categoryId": "clx123",
  "accountId": "clx456",
  "vendorName": "Staples"
}
```

### Auto-Creation Pattern

Vendors and clients are automatically created when names are provided without IDs:

- Provide `vendorName` without `vendorId` → Creates vendor if doesn't exist
- Provide `clientName` without `clientId` → Creates client if doesn't exist
- Case-insensitive matching prevents duplicates

### Soft Delete Pattern

Resources can be soft-deleted (moved to trash) and later restored or permanently deleted:

1. `transactions_delete` / `documents_delete` → Moves to trash (sets `deletedAt`)
2. `transactions_list_trash` / `documents_list_trash` → View trash
3. `transactions_restore` / `documents_restore` → Restore from trash
4. `transactions_hard_delete` / `documents_hard_delete` → Permanent deletion

## Common Workflows

### Create Expense with Receipt

Complete workflow to record an expense and attach a receipt/invoice document:

```
1. documents_upload
   - Provide file path(s) to upload (e.g., ["/path/to/invoice.pdf"])
   - Supported formats: PDF, JPEG, PNG, TXT (max 10MB each)
   - Returns document ID(s) in response

2. transactions_create
   - type: "EXPENSE"
   - date: "2025-03-24" (YYYY-MM-DD format)
   - description: "Invoice description"
   - amountBase: 20.00
   - categoryId: Get from categories_list (e.g., "Software & Subscriptions")
   - accountId: Get from accounts_list
   - vendorId: Get from vendors_list OR use vendorName for auto-creation
   - status: "POSTED" (or "DRAFT" for future-dated transactions)
   - Returns transaction ID in response

3. transactions_link_documents
   - transactionId: From step 2
   - documentIds: [documentId from step 1]
   - Links the document to the transaction
   - Verify with transactions_get to see linked documents
```

**Example Response Flow:**
- Upload returns: `{ documents: [{ id: "doc_abc123", ... }] }`
- Create returns: `{ transaction: { id: "txn_xyz789", ... } }`
- Link returns: `{ linkedDocuments: [...] }` with full document metadata

**Important Notes:**
- `documents_upload` requires **absolute file paths** to files on the local filesystem
- After uploading, the document appears in the SoloLedger web app immediately
- After linking, the document is visible in the transaction's document list
- If MCP server was rebuilt, reconnect to the MCP server to pick up any new tools

### Monthly P&L Report

```
1. transactions_list (dateFrom, dateTo, status=POSTED)
2. categories_usage (from, to)
3. Group by category and calculate totals
```

### Find Software Expenses in Q4

```
1. categories_list (type=EXPENSE, find "Software" category)
2. transactions_list (type=EXPENSE, categoryId, dateFrom="2024-10-01", dateTo="2024-12-31")
3. Analyze results
```

### Bulk Category Change

```
1. transactions_list (categoryId=oldCategoryId)
2. Extract transaction IDs
3. transactions_bulk_update (transactionIds, action=changeCategory, categoryId=newCategoryId)
```

## Error Handling

All tools return actionable error messages:

- **400 Bad Request**: Invalid input - check parameters
- **401 Unauthorized**: API key invalid/revoked
- **403 Forbidden**: Permission denied or API key scope violation
- **404 Not Found**: Resource doesn't exist or is soft-deleted
- **429 Rate Limited**: Wait before retrying (10 req/min for exchange endpoint)
- **500 Server Error**: Contact support if persists

## Security Best Practices

1. **Never commit API keys**: Use environment variables only
2. **Rotate keys**: Recommend rotating every 90 days
3. **Monitor usage**: Check "Last Used" in SoloLedger web app
4. **Revoke compromised keys**: Immediate revocation via web app
5. **Scope awareness**: API keys have full user access to the organization

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Test with Inspector

```bash
npm run inspector
```

## Troubleshooting

### "Invalid API key" on startup

- Verify API key is correct and starts with `slk_`
- Check key hasn't been revoked in SoloLedger web app
- Ensure key hasn't expired

### "Rate limited" errors

- Exchange endpoint: 10 requests/minute per IP
- Wait 60 seconds before retrying
- Token caching should prevent this in normal use

### "Permission denied" errors

- Check API key has access to the organization
- Verify organization slug is correct
- Some operations require admin/superadmin role

### Build errors

```bash
# Clean install
rm -rf node_modules dist
npm install
npm run build
```

## API Documentation

For detailed API endpoint documentation, see:
- `/notes/api_docs_for_mcp.md` - Complete API reference
- `/notes/personal_api_key.md` - API key setup and usage

## License

MIT

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review API documentation in `/notes/`
3. Open an issue in the repository
