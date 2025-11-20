# Bearer Token Authentication - Testing Guide

This guide outlines manual testing steps to verify Bearer token authentication is working correctly across all organization-scoped API routes.

## Prerequisites

1. **Running development server**: `npm run dev`
2. **Test user account**: Email address in ALLOWED_EMAILS
3. **Test organization**: Created organization with test data
4. **API testing tool**: curl, Postman, or similar

## Testing Flow

### Step 1: Cookie-Based Authentication (Browser)

Verify existing cookie-based authentication still works:

1. Log in via the UI at `http://localhost:3000/login`
2. Navigate to an organization dashboard
3. Verify key routes work:
   - Transactions list: `/o/{orgSlug}/transactions`
   - Vendors list: `/o/{orgSlug}/vendors`
   - Reports: `/o/{orgSlug}/reports/pnl`
   - Settings: `/o/{orgSlug}/settings/organization`

**Expected result**: All routes work normally with cookie-based auth

### Step 2: Generate API Key

1. Navigate to API Access page: `/o/{orgSlug}/settings/api-access`
2. Click "Create API Key"
3. Enter a name (e.g., "Test Key")
4. Optional: Set expiration date
5. Copy the generated API key (starts with `sk_`)
6. Save the API key securely

**Expected result**: API key generated successfully

### Step 3: Exchange API Key for Bearer Token

Use the API key to get a Bearer token:

```bash
curl -X POST http://localhost:3000/api/auth/api-key/exchange \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "sk_..."}'
```

**Expected response**:
```json
{
  "accessToken": "eyJhbG..."
}
```

Save the access token for subsequent requests.

### Step 4: Test Organization Discovery

Verify API key can discover its scoped organization:

```bash
curl -X GET http://localhost:3000/api/user/organizations \
  -H "Authorization: Bearer eyJhbG..."
```

**Expected response**:
```json
{
  "organizations": [
    {
      "id": "...",
      "name": "Your Org",
      "slug": "your-org"
    }
  ]
}
```

Note: Should return ONLY the organization the API key is scoped to.

### Step 5: Test GET Endpoints (Read Operations)

Test various organization-scoped GET endpoints:

#### Transactions List
```bash
curl -X GET "http://localhost:3000/api/orgs/{orgSlug}/transactions" \
  -H "Authorization: Bearer eyJhbG..."
```

#### Vendors List
```bash
curl -X GET "http://localhost:3000/api/orgs/{orgSlug}/vendors" \
  -H "Authorization: Bearer eyJhbG..."
```

#### Clients List
```bash
curl -X GET "http://localhost:3000/api/orgs/{orgSlug}/clients" \
  -H "Authorization: Bearer eyJhbG..."
```

#### P&L Report
```bash
curl -X GET "http://localhost:3000/api/orgs/{orgSlug}/reports/pnl?dateMode=fiscalYear" \
  -H "Authorization: Bearer eyJhbG..."
```

#### Organization Settings
```bash
curl -X GET "http://localhost:3000/api/orgs/{orgSlug}/settings/financial" \
  -H "Authorization: Bearer eyJhbG..."
```

**Expected result**: All endpoints return valid data without 401 errors

### Step 6: Test POST Endpoints (Write Operations)

Test creating resources with Bearer token:

#### Create Transaction
```bash
curl -X POST http://localhost:3000/api/orgs/{orgSlug}/transactions \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{
    "type": "EXPENSE",
    "status": "DRAFT",
    "amountBase": 100.00,
    "date": "2025-11-19",
    "description": "Test transaction via API",
    "categoryId": "...",
    "accountId": "...",
    "vendorName": "Test Vendor API"
  }'
```

#### Create Vendor
```bash
curl -X POST http://localhost:3000/api/orgs/{orgSlug}/vendors \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test Vendor",
    "email": "vendor@test.com"
  }'
```

#### Create Client
```bash
curl -X POST http://localhost:3000/api/orgs/{orgSlug}/clients \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test Client",
    "email": "client@test.com"
  }'
```

**Expected result**: Resources created successfully without CSRF errors

### Step 7: Test PATCH Endpoints (Update Operations)

#### Update Transaction
```bash
curl -X PATCH http://localhost:3000/api/orgs/{orgSlug}/transactions/{transactionId} \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated via Bearer token"
  }'
```

#### Update Organization Settings
```bash
curl -X PATCH http://localhost:3000/api/orgs/{orgSlug}/settings/financial \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{
    "dateFormat": "DD_MM_YYYY"
  }'
```

**Expected result**: Updates applied successfully without CSRF errors

### Step 8: Test DELETE Endpoints

#### Soft Delete Transaction
```bash
curl -X DELETE http://localhost:3000/api/orgs/{orgSlug}/transactions/{transactionId} \
  -H "Authorization: Bearer eyJhbG..."
```

#### Delete Vendor
```bash
curl -X DELETE http://localhost:3000/api/orgs/{orgSlug}/vendors/{vendorId} \
  -H "Authorization: Bearer eyJhbG..."
```

**Expected result**: Resources deleted successfully without CSRF errors

### Step 9: Verify Account Endpoints Remain Cookie-Only

Test that account/password endpoints reject Bearer tokens:

#### Change Password (Should Fail)
```bash
curl -X POST http://localhost:3000/api/auth/profile/change-password \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "test",
    "newPassword": "newtest"
  }'
```

**Expected result**: 401 Unauthorized (Bearer token not supported for account endpoints)

### Step 10: Test Organization Scoping

Try to access a different organization than the one the API key is scoped to:

```bash
curl -X GET http://localhost:3000/api/orgs/{differentOrgSlug}/transactions \
  -H "Authorization: Bearer eyJhbG..."
```

**Expected result**: 403 Forbidden (API key not authorized for this organization)

### Step 11: Test Invalid/Expired Tokens

#### Invalid Token Format
```bash
curl -X GET http://localhost:3000/api/orgs/{orgSlug}/transactions \
  -H "Authorization: Bearer invalid_token"
```

**Expected result**: 401 Unauthorized

#### Revoked API Key
1. Revoke the API key via UI or API
2. Try using the Bearer token

**Expected result**: 401 Unauthorized

#### Expired API Key
1. Create an API key with expiration date in the past (or wait for expiration)
2. Exchange and use the token

**Expected result**: 401 Unauthorized

## Success Criteria

- ✅ All cookie-based browser flows continue to work
- ✅ API key can be exchanged for Bearer token
- ✅ Bearer token works for GET requests (reads)
- ✅ Bearer token works for POST requests (creates) without CSRF errors
- ✅ Bearer token works for PATCH requests (updates) without CSRF errors
- ✅ Bearer token works for DELETE requests without CSRF errors
- ✅ Account/password endpoints reject Bearer tokens (cookie-only)
- ✅ API keys are properly scoped to their organization
- ✅ Invalid/revoked/expired tokens are rejected

## Common Issues

### 401 Unauthorized
- Check token format: `Authorization: Bearer {token}`
- Verify API key hasn't been revoked
- Check expiration date
- Ensure token is valid JWT

### 403 Forbidden / Access Denied
- Verify organization slug matches API key's scoped organization
- Check user has membership in the organization
- For admin endpoints, verify user role

### 403 Invalid Origin (CSRF Error)
- This shouldn't happen with Bearer tokens
- If it does, check that `validateCsrf` is properly skipping Bearer requests
- Verify Authorization header format

### TypeScript Errors
- Check that all route handlers have `request` parameter in signature
- Verify `Request | NextRequest` types are properly imported

## Automated Testing (Future)

Once a test framework is chosen, add:

1. **Unit tests** for `getAuthFromRequest` and `getCurrentUser`
   - Cookie-only auth
   - Bearer-only auth
   - Both present (Bearer wins)
   - Invalid tokens

2. **Integration tests** for representative routes
   - `/api/orgs/{orgSlug}/transactions` (GET, POST)
   - `/api/orgs/{orgSlug}/reports/pnl` (GET)
   - `/api/user/organizations` (GET)
   - `/api/auth/profile/change-password` (POST - should reject Bearer)

3. **CSRF bypass tests**
   - Verify Bearer requests skip CSRF
   - Verify cookie requests still require valid Origin

4. **Organization scoping tests**
   - API key can only access scoped org
   - Cookie auth can access all memberships
