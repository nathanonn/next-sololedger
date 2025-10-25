---
name: app-integrations-setup
description: This skill should be used when setting up organization-level app integrations (Reddit, Notion, LinkedIn, WordPress) with OAuth flows, encrypted token storage, API client wrappers, and usage logging in a Next.js App Router application. Use this skill when implementing external provider connections for a multi-tenant app with secure credential management, token refresh, and admin-controlled integration features.
---

# App Integrations Setup

## Overview

Implement production-ready organization-level app integrations that allow admins to connect external services (Reddit, Notion, LinkedIn, WordPress) to their organizations. Each integration supports secure OAuth flows (or non-OAuth credential capture for WordPress), encrypted token storage with AES-256-GCM, automatic token refresh when supported, provider-specific API client wrappers, structured usage logging, and comprehensive test utilities.

## When to Use This Skill

Use this skill when:
- User requests "Add Reddit integration" or "Set up LinkedIn OAuth"
- User wants to "Enable app integrations for organizations"
- User asks "How do I connect external services to my multi-tenant app?"
- User needs "Secure OAuth flow implementation with encrypted tokens"
- User wants to "Add third-party API connections per organization"

**Prerequisites**: Multi-tenant support with Organizations, Memberships, and role-based permissions must already be implemented. If not, use the `multi-tenant-setup` skill first.

## Implementation Workflow

Follow these steps in order to implement app integrations:

### 1. Environment Configuration

Generate and configure required environment variables.

**Generate encryption key:**
```bash
python scripts/generate_encryption_key.py
```

Add to `.env`:
```bash
# Core Integration Toggles
INTEGRATIONS_ENABLED=true
INTEGRATIONS_ALLOWED=reddit,notion_public,linkedin,wordpress
APP_ENCRYPTION_KEY=<generated-key-from-script>
INTEGRATIONS_USAGE_LOGGING_ENABLED=true

# Provider Credentials (add as needed based on INTEGRATIONS_ALLOWED)
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=MyApp/1.0
REDDIT_SCOPES=identity,read

NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
NOTION_API_VERSION=2022-06-28

LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_SCOPES=openid,profile,email

# WordPress: no OAuth; credentials captured at connect time
```

**Update environment validation** in `lib/env.ts`:
- Add integration-specific env vars with Zod validation
- Ensure encryption key is 32 bytes when base64-decoded
- Validate provider credentials only when provider is in `INTEGRATIONS_ALLOWED`

### 2. Database Schema (Prisma)

Add three models to `prisma/schema.prisma`:

```prisma
model OrganizationIntegration {
  id                      String   @id @default(cuid())
  organizationId          String
  provider                String   // reddit, notion, linkedin, wordpress
  connectionType          String   // "public" | "internal"
  status                  String   @default("disconnected") // connected | disconnected | error

  // Account info
  accountId               String?
  accountName             String?
  workspaceId             String?

  // Encrypted tokens
  encryptedAccessToken    String?
  encryptedRefreshToken   String?
  tokenType               String?
  expiresAt               DateTime?
  scope                   String?

  // Audit trail
  createdByUserId         String
  updatedByUserId         String?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  organization            Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdBy               User         @relation("IntegrationCreatedBy", fields: [createdByUserId], references: [id])
  updatedBy               User?        @relation("IntegrationUpdatedBy", fields: [updatedByUserId], references: [id])

  @@unique([organizationId, provider])
  @@index([organizationId])
  @@index([provider])
}

model IntegrationAuthState {
  id             String   @id @default(cuid())
  state          String   @unique
  provider       String
  organizationId String
  userId         String
  codeVerifier   String?  // PKCE
  expiresAt      DateTime
  createdAt      DateTime @default(now())

  @@index([state])
  @@index([expiresAt])
}

model IntegrationCallLog {
  id                String   @id @default(cuid())
  organizationId    String
  userId            String
  provider          String
  endpoint          String
  method            String
  status            String   // success | error
  httpStatus        Int?
  latencyMs         Int
  correlationId     String
  requestTruncated  String?  @db.Text
  responseTruncated String?  @db.Text
  errorCode         String?
  errorMessage      String?
  createdAt         DateTime @default(now())

  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user              User         @relation(fields: [userId], references: [id])

  @@index([organizationId])
  @@index([correlationId])
  @@index([createdAt])
}
```

Run migration:
```bash
npx prisma migrate dev --name add_integrations
npx prisma generate
```

### 3. Encryption Utilities

Create `lib/secrets.ts` for AES-256-GCM encryption:

```typescript
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32

function getEncryptionKey(): Buffer {
  const key = process.env.APP_ENCRYPTION_KEY
  if (!key) throw new Error('APP_ENCRYPTION_KEY not configured')
  return Buffer.from(key, 'base64')
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
}

export function decryptSecret(ciphertext: string): string {
  const key = getEncryptionKey()
  const [ivHex, tagHex, encryptedHex] = ciphertext.split(':')

  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encrypted)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString('utf8')
}
```

### 4. Provider Registry

Create `lib/integrations/providers.ts` to define supported providers:

```typescript
export const PROVIDERS = {
  reddit: {
    displayName: 'Reddit',
    baseUrl: 'https://oauth.reddit.com',
    authorizeUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    revokeUrl: 'https://www.reddit.com/api/v1/revoke_token',
    defaultScopes: ['identity', 'read'],
    defaultHeaders: { 'User-Agent': process.env.REDDIT_USER_AGENT || '' },
    supportsRefresh: true,
  },
  notion: {
    displayName: 'Notion',
    baseUrl: 'https://api.notion.com',
    authorizeUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    defaultScopes: [],
    defaultHeaders: { 'Notion-Version': process.env.NOTION_API_VERSION || '2022-06-28' },
    supportsRefresh: false,
  },
  linkedin: {
    displayName: 'LinkedIn',
    baseUrl: 'https://api.linkedin.com',
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    defaultScopes: ['openid', 'profile', 'email'],
    defaultHeaders: {},
    supportsRefresh: true,
  },
  wordpress: {
    displayName: 'WordPress',
    baseUrl: '', // Set per-connection
    supportsRefresh: false,
  },
} as const
```

### 5. OAuth Helpers

Create `lib/integrations/oauth.ts` with:
- `buildAuthorizeUrl(provider, organizationId, userId)` - Generate OAuth URL with PKCE
- `exchangeCodeForToken(provider, code, codeVerifier)` - Exchange authorization code
- `fetchAccountInfo(provider, accessToken)` - Retrieve account details
- `refreshAccessToken(provider, refreshToken)` - Refresh expired tokens

Refer to `references/implementation.md` for complete implementation details.

### 6. Client Wrappers

Create `lib/integrations/client.ts` with provider-specific request helpers:
- `redditRequest(orgId, path, options)` - Reddit API client
- `notionRequest(orgId, path, options)` - Notion API client
- `linkedinRequest(orgId, path, options)` - LinkedIn API client
- `wordpressRequest(orgId, path, options)` - WordPress API client
- `callIntegration({ orgId, userId, provider, endpoint, ... })` - Unified interface

Each helper should:
1. Fetch and decrypt integration tokens from database
2. Set provider-specific headers
3. Handle token refresh when supported
4. Mark integration as "error" status on 401 if no refresh available
5. Log calls when `INTEGRATIONS_USAGE_LOGGING_ENABLED=true`

### 7. API Routes

Create org-scoped API routes:

**List integrations:**
- `GET /api/orgs/[orgSlug]/integrations/route.ts`
- Returns all providers with connection status

**Start OAuth:**
- `POST /api/orgs/[orgSlug]/integrations/[provider]/authorize/route.ts`
- Returns `{ url }` for redirect

**OAuth callback (global):**
- `GET /api/integrations/[provider]/callback/route.ts`
- Exchanges code, upserts integration, redirects back

**Test connection:**
- `POST /api/orgs/[orgSlug]/integrations/[provider]/test/route.ts`
- Accepts `{ method, endpoint, headers?, query?, body? }`

**Disconnect:**
- `DELETE /api/orgs/[orgSlug]/integrations/[provider]/route.ts`
- Revokes tokens at provider when supported

**WordPress connect (non-OAuth):**
- `POST /api/orgs/[orgSlug]/integrations/wordpress/connect/route.ts`
- Accepts `{ siteUrl, username, applicationPassword }`

All routes must:
- Use `export const runtime = "nodejs"`
- Require admin or superadmin via `requireAdminOrSuperadmin()`
- Validate CSRF on POST/PUT/PATCH/DELETE
- Never expose plaintext secrets

### 8. UI Components

Create integrations page at `/o/[orgSlug]/settings/organization/integrations/page.tsx`:

**Server component:**
- Fetch providers and status via API
- Show success/error banners from callback query params

**Client components:**
- Provider cards (grid on desktop, stack on mobile)
- Connect button → POST authorize → redirect to OAuth URL
- Test dialog → Form with method/endpoint/headers/query/body
- Disconnect confirm dialog → DELETE integration
- WordPress connect modal → Site URL, username, password form

Refer to `references/wireframes.md` for complete UX specifications.

### 9. Security Guardrails

Ensure all implementations follow:
- **Runtime**: Node runtime for all routes using DB/secrets
- **AuthZ**: `requireAdminOrSuperadmin()` on all org-scoped endpoints
- **CSRF**: Validate Origin/Referer on all mutations
- **Secrets**: Never expose plaintext tokens; decrypt just-in-time
- **Errors**: Map provider errors to structured codes; don't leak tokens
- **Audit**: Log `integration.connected` and `integration.disconnected` actions
- **Correlation IDs**: Generate per request for traceability

### 10. Testing

Verify implementation:
1. Connect OAuth provider (Reddit/Notion/LinkedIn)
2. Verify encrypted tokens in database
3. Test connection with valid endpoint
4. Verify correlation ID in response
5. Disconnect and verify provider revocation
6. Connect WordPress with site URL and credentials
7. Test token refresh for Reddit/LinkedIn
8. Verify non-admin users see read-only cards

## Adding a New Provider

To add a provider beyond the included four:

1. **Register in `lib/integrations/providers.ts`**
   - Add entry with baseUrl, OAuth URLs, scopes, headers, refresh capability

2. **Update `lib/env.ts`**
   - Add provider credentials with Zod validation
   - Gate validation on `INTEGRATIONS_ALLOWED` inclusion

3. **Extend OAuth helpers** (if OAuth provider)
   - Add case in `buildAuthorizeUrl()`
   - Add case in `exchangeCodeForToken()`
   - Implement `fetchAccountInfo()` for account details

4. **Create client wrapper**
   - Add `<provider>Request()` in `lib/integrations/client.ts`
   - Handle token refresh if supported
   - Add case in `callIntegration()` switch

5. **Create callback route** (if OAuth)
   - `GET /api/integrations/[provider]/callback/route.ts`

6. **Update UI**
   - Add provider card to integrations page
   - Wire Connect/Test/Disconnect buttons

## Resources

### scripts/
- `generate_encryption_key.py` - Generate secure 32-byte AES-256 encryption key

Execute to generate `APP_ENCRYPTION_KEY`:
```bash
python scripts/generate_encryption_key.py
```

### references/
- `implementation.md` - Complete technical implementation guide with API contracts, security patterns, and provider details
- `wireframes.md` - UX flow maps and ASCII wireframes for all integration screens and states

Load these references when implementing specific components or troubleshooting integration flows.

## Common Patterns

**Decrypt tokens just-in-time:**
```typescript
const integration = await db.organizationIntegration.findUnique({
  where: { organizationId_provider: { organizationId, provider } }
})
const accessToken = decryptSecret(integration.encryptedAccessToken)
```

**Handle token refresh:**
```typescript
if (integration.expiresAt && new Date() > integration.expiresAt) {
  if (provider.supportsRefresh && integration.encryptedRefreshToken) {
    const newTokens = await refreshAccessToken(provider, decryptSecret(integration.encryptedRefreshToken))
    await updateIntegrationTokens(integration.id, newTokens)
  } else {
    await markIntegrationError(integration.id)
    throw new Error('Token expired, reconnect required')
  }
}
```

**Log API calls:**
```typescript
await logIntegrationCall({
  organizationId,
  userId,
  provider,
  endpoint,
  method,
  status: 'success',
  httpStatus: response.status,
  latencyMs: Date.now() - startTime,
  correlationId,
  requestTruncated: sanitize(request),
  responseTruncated: sanitize(response)
})
```

## Notes

- One integration per organization per provider (enforced by unique constraint)
- Tokens encrypted at rest; never visible in UI
- OAuth state expires in 10 minutes and is single-use
- Correlation IDs enable support debugging without exposing secrets
- WordPress requires Application Passwords (not regular passwords)
- LinkedIn analytics require specific program approvals
- Non-admins see read-only status; no action buttons
