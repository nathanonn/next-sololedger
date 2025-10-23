# External Integrations (Reddit + Notion) — Implementation Plan

Short description: We will add an org-scoped integrations framework parallel to the existing AI pattern. Environment flags control availability; org admins connect Reddit and Notion via secure OAuth (PKCE where supported). Tokens (including refresh tokens) are encrypted at rest. A server-only client handles token retrieval/refresh and exposes a reusable callIntegration function (plus provider-specific helpers). Admin UI provides connect/disconnect and status, with optional usage logs. All routes run on Node runtime with CSRF and admin checks.

## Goals

- Org admin can connect Reddit and Notion for the organization.
- Save and encrypt access/refresh tokens (refresh when available).
- Env allowlist controls which providers are available.
- Server-only trigger function to call provider APIs with auto-refresh and logging.
- Admin UI for connect/disconnect/status and optional logs view.

## Environment Variables

- Feature flags
  - INTEGRATIONS_ENABLED=true|false
  - INTEGRATIONS_ALLOWED="reddit,notion"
  - INTEGRATIONS_USAGE_LOGGING_ENABLED=true|false (default: false) — when false, no integration usage is logged and related UI is hidden
- Reddit
  - REDDIT_CLIENT_ID
  - REDDIT_CLIENT_SECRET
  - REDDIT_USER_AGENT="yourapp/1.0 by yourorg" (required by Reddit)
  - REDDIT_SCOPES="identity read" (default if omitted)
  - Redirect URI: ${APP_URL}/api/integrations/reddit/callback
- Notion
  - NOTION_CLIENT_ID
  - NOTION_CLIENT_SECRET
  - NOTION_API_VERSION=2022-06-28 (or latest stable)
  - Redirect URI: ${APP_URL}/api/integrations/notion/callback
- Encryption
  - APP_ENCRYPTION_KEY (base64-encoded 32 bytes, AES-256-GCM)

lib/env.ts updates

- When INTEGRATIONS_ENABLED=true, validate presence of APP_ENCRYPTION_KEY.
- Validate provider-specific envs only if allowed via INTEGRATIONS_ALLOWED.
- Default INTEGRATIONS_ALLOWED to "reddit,notion".
- Add INTEGRATIONS_USAGE_LOGGING_ENABLED with default "false"; expose as boolean flag.

lib/secrets.ts updates

- Require APP_ENCRYPTION_KEY if AI_FEATURES_ENABLED || INTEGRATIONS_ENABLED.

## Database Schema (Prisma)

- model OrganizationIntegration
  - id: String @id @default(cuid())
  - organizationId: String (FK Organization)
  - provider: String ("reddit" | "notion")
  - status: String ("connected" | "disconnected" | "error")
  - accountId: String? (Reddit user id; Notion workspace/bot id)
  - accountName: String? (Reddit username; Notion workspace name)
  - encryptedAccessToken: String @db.Text
  - encryptedRefreshToken: String? @db.Text
  - tokenType: String? (e.g., "bearer")
  - expiresAt: DateTime?
  - scope: String?
  - createdByUserId: String
  - updatedByUserId: String
  - createdAt: DateTime @default(now())
  - updatedAt: DateTime @updatedAt
  - @@unique([organizationId, provider])
  - @@index([organizationId, provider])
  - @@index([organizationId, updatedAt])

- model IntegrationAuthState
  - id: String @id @default(cuid())
  - state: String
  - provider: String
  - organizationId: String
  - userId: String
  - codeVerifier: String?
  - expiresAt: DateTime
  - createdAt: DateTime @default(now())
  - @@index([state, provider])

- model IntegrationCallLog
  - id: String @id @default(cuid())
  - organizationId: String
  - userId: String
  - provider: String
  - endpoint: String
  - method: String
  - status: String ("ok" | "error")
  - httpStatus: Int?
  - latencyMs: Int
  - correlationId: String
  - requestTruncated: String @db.Text
  - responseTruncated: String @db.Text
  - errorCode: String?
  - errorMessage: String? @db.Text
  - createdAt: DateTime @default(now())
  - @@index([organizationId, createdAt])
  - @@index([organizationId, provider, createdAt])
  - @@index([organizationId, correlationId])

Reuse encryptSecret/decryptSecret from lib/secrets.ts for token storage.

## OAuth Flows

State + PKCE

- Generate state and (if supported) code_verifier + S256 code_challenge.
- Store IntegrationAuthState with 10-minute TTL; single-use on callback.

Reddit

- Authorize: https://www.reddit.com/api/v1/authorize
  - response_type=code, duration=permanent, client_id, redirect_uri, scope (identity read), state, PKCE params.
- Token: https://www.reddit.com/api/v1/access_token
  - Basic auth (client_id:client_secret), grant_type=authorization_code or refresh_token.
- API base: https://oauth.reddit.com
- Required headers: Authorization: Bearer <token>, User-Agent: REDDIT_USER_AGENT.
- Store refresh_token; compute expiresAt; refresh when expired or on 401.

Notion

- Authorize: https://api.notion.com/v1/oauth/authorize (owner=workspace)
- Token: https://api.notion.com/v1/oauth/token (authorization_code)
- API base: https://api.notion.com/v1
- Required headers: Authorization: Bearer <token>, Notion-Version: NOTION_API_VERSION, Content-Type: application/json.
- No refresh token typically; treat tokens as long-lived. On 401, mark status=error (prompt reconnect).

Disconnect/Revoke

- Reddit: attempt revoke via token endpoint if supported; otherwise delete locally.
- Notion: delete locally; instruct user to disconnect in Notion UI if needed.

## Server Utilities (lib/integrations)

providers.ts

- type IntegrationProvider = "reddit" | "notion"
- PROVIDER_INFO: displayName, baseUrl, authorizeUrl, tokenUrl, default scopes, default headers.
- isIntegrationAllowed(provider: string): provider is IntegrationProvider
- getAllowedIntegrations(): IntegrationProvider[]

oauth.ts

- buildAuthorizeUrl(orgId, userId, provider): Promise<{ url, stateId }>
- exchangeCodeForToken(provider, code, redirectUri, state): upsert OrganizationIntegration; return connection summary.
- refreshAccessToken(provider, refreshToken): Reddit only; persists new access/expiry.

client.ts

- getOrgIntegration(orgId, provider): loads row, decrypts tokens, checks expiry; refreshes Reddit if needed; returns a provider-aware fetcher.
- redditRequest(path, opts)
- notionRequest(path, opts)
- logIntegrationCall(params): when INTEGRATIONS_USAGE_LOGGING_ENABLED=true, write IntegrationCallLog with sanitized payloads; otherwise no-op. Logging failures are non-fatal.

trigger.ts

- export async function callIntegration({ orgId, userId, provider, endpoint, method, headers?, query?, body?, correlationId? }): Promise<{ data; httpStatus; correlationId }>
- Uses provider helpers; injects required headers; auto-refresh on Reddit expiry/401; structured errors (UNAUTHORIZED, TOKEN_EXPIRED, TOKEN_REFRESH_FAILED, RATE_LIMITED, NETWORK_ERROR, TIMEOUT, API_ERROR_XXX).

## API Routes (Node runtime)

Common guards: requireAdminOrSuperadmin, validateCsrf for mutating routes, return 404 if INTEGRATIONS_ENABLED=false.

- GET /api/orgs/[orgSlug]/integrations
  - Returns allowed providers with status, accountName, lastUpdated, connected flag.

- POST /api/orgs/[orgSlug]/integrations/[provider]/authorize
  - CSRF; returns { url } for client redirect; persists IntegrationAuthState.

- GET /api/integrations/[provider]/callback
  - Validates state; exchanges code; upserts OrganizationIntegration; writes AuditLog; redirects to /o/[slug]/settings/organization/integrations with query params indicating success/error.

- DELETE /api/orgs/[orgSlug]/integrations/[provider]
  - CSRF; revoke Reddit if possible; delete Integration; audit log.

- Optional: GET /api/orgs/[orgSlug]/integrations/logs?provider=&q=&from=&to=&page=
  - Paginated logs for dashboard; return 404 or { disabled: true } when INTEGRATIONS_USAGE_LOGGING_ENABLED=false.

## UI

New Integrations tab

- Page: /o/[orgSlug]/settings/organization/(tabs)/integrations/page.tsx
- Component: components/features/integrations/integrations-management.tsx
  - Lists allowed providers; shows status chip; Connect/Disconnect buttons; accountName and last updated.
  - "Connect" calls authorize endpoint; client navigates to returned URL.
  - "Disconnect" calls DELETE.
  - Link to Integration Usage view.

Integration Usage (optional)

- Page: /o/[orgSlug]/settings/organization/(tabs)/integration-usage/page.tsx
- Component: components/features/integrations/integration-usage-dashboard.tsx (mirrors AI usage—filters + details sheet).
- Visibility: only render the tab and page when INTEGRATIONS_USAGE_LOGGING_ENABLED=true; otherwise hide tab and route may show a disabled message or 404.

Organization tabs

- Update components/features/organization/organization-tabs.tsx to optionally show "Integrations" (behind INTEGRATIONS_ENABLED and allowlist checks).

## Security & Guardrails

- Node runtime only for all integration routes.
- Server-only token handling; never expose tokens to client.
- CSRF origin validation and admin checks for all mutating actions.
- Tokens encrypted with AES-256-GCM; redact secrets from logs.
- Respect rate limits and provide meaningful error codes/messages.
- Usage logging is strictly controlled by INTEGRATIONS_USAGE_LOGGING_ENABLED; when disabled, no logs are persisted and the Usage UI is hidden.

## Testing & QA

- Connect/disconnect flows for both providers (happy path + error path).
- Reddit token refresh on expiry and on 401.
- Notion 401 handling sets status=error and prompts reconnect.
- CSRF and authorization failures handled gracefully.
- Logging created with correlationId; payloads sanitized.
- Verify that when INTEGRATIONS_USAGE_LOGGING_ENABLED=false, no IntegrationCallLog rows are created and the Usage tab is hidden.

## Acceptance Criteria

- Env flags disable integrations globally (routes respond 404/disabled; UI hides tab).
- Admin connects Reddit/Notion successfully; account info displayed.
- Tokens encrypted at rest; Reddit refresh works; Notion handled as long-lived.
- callIntegration works for both, with logs and correlation IDs.
- When INTEGRATIONS_USAGE_LOGGING_ENABLED=false, no usage logs are recorded and the Integration Usage tab is not visible.
- Disconnect removes tokens and revokes Reddit where possible.
- UI shows allowed providers only; errors surface with clear guidance.

## Rollout Checklist

1. Add env variables; register provider redirect URIs.
2. Run Prisma migration; generate client.
3. Deploy server changes; verify Node runtime routes.
4. Connect providers in a test org; validate token storage and refresh.
5. Validate callIntegration against a trivial endpoint (Reddit /api/v1/me, Notion /users/me).
6. Review logs and UI states; iterate on copy.
