# App Integrations (Reusable for Next.js Apps)

This guide documents a portable, provider-agnostic pattern to add external app integrations to any Next.js App Router app that already has multi-tenant support. It follows the current repository’s implementation and focuses on per‑organization connections, secure OAuth (and non‑OAuth) flows, encrypted secret storage, API client wrappers, structured usage logging, and minimal UI/API contracts.

Important: This document assumes multi‑tenant routing, roles, and permissions are already implemented (see `multi_tenant_support.md`). It does not repeat tenant basics.

## Baseline and Principles

- Next.js App Router + React + TypeScript (strict)
- Prisma + Postgres (single DB)
- Node runtime only for routes touching DB/secrets
- JWT auth, CSRF Origin/Referer checks on mutating routes
- AES‑256‑GCM encryption at rest for tokens via `APP_ENCRYPTION_KEY`
- Org‑level connections: one integration per organization per provider (unique constraint)
- Observability: correlation IDs and structured usage logs (opt‑in)

Success criteria

- Admins (or superadmins) can connect, view, test, and disconnect integrations per organization
- Tokens are encrypted at rest; refresh handled when the provider supports it
- Client wrappers centralize headers, retries, and error parsing
- Calls are optionally logged with sanitized payloads for support/debugging

## Environment and Configuration

Required when integrations are enabled

- Core toggles
  - `INTEGRATIONS_ENABLED` = "true" to enable features and env validation
  - `INTEGRATIONS_ALLOWED` = comma list of providers; supports: `reddit`, `notion_public`, `notion_internal`, `linkedin`, `wordpress`
  - `APP_ENCRYPTION_KEY` = base64‑encoded 32 bytes (AES‑256‑GCM)
  - `INTEGRATIONS_USAGE_LOGGING_ENABLED` = "true" to persist call logs
- Provider credentials (as needed by `INTEGRATIONS_ALLOWED`)
  - Reddit: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`, `REDDIT_SCOPES` (e.g., "identity read")
  - Notion (public OAuth): `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_API_VERSION` (e.g., 2022‑06‑28)
  - LinkedIn: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_SCOPES`
  - WordPress: no OAuth; site URL and credentials are captured at connect time

Notes

- Env is validated at boot with Zod (`lib/env.ts`), including required credentials per allowed provider and the encryption key. Misconfiguration fails fast.
- Internally we normalize Notion variants; `INTEGRATIONS_ALLOWED` may include `notion_public` and/or `notion_internal` but exposed provider id is `notion`.

## Data Model (Prisma sketch)

Portable intent (names match this repo):

- OrganizationIntegration
  - `organizationId`, `provider` (unique together)
  - `connectionType` ("public" | "internal")
  - `status` ("connected" | "disconnected" | "error")
  - `accountId`, `accountName`, `workspaceId?`
  - `encryptedAccessToken`, `encryptedRefreshToken?`, `tokenType?`, `expiresAt?`, `scope?`
  - `createdByUserId`, `updatedByUserId`, timestamps
- IntegrationAuthState
  - Temporary OAuth state with `state`, `provider`, `organizationId`, `userId`, `codeVerifier?` (PKCE), `expiresAt`
- IntegrationCallLog (optional, if logging enabled)
  - `organizationId`, `userId`, `provider`, `endpoint`, `method`, `status`, `httpStatus?`, `latencyMs`, `correlationId`, `requestTruncated`, `responseTruncated`, `errorCode?`, `errorMessage?`, `createdAt`

Notes

- Tokens are stored encrypted (AES‑256‑GCM) using `encryptSecret`/`decryptSecret` in `lib/secrets.ts`.
- Unique index `(organizationId, provider)` enforces one connection per org/provider. Use additional rows only if you need multiple connections.

## Provider Abstraction and Configuration

Define a small registry for supported providers with base URLs, OAuth endpoints, default headers/scopes, and refresh capability. See `lib/integrations/providers.ts`.

Included examples

- Reddit (OAuth + refresh)
- Notion (public OAuth; no refresh)
- LinkedIn (OAuth + refresh)
- WordPress (non‑OAuth; Basic Auth credentials stored encrypted)

You can add more by extending the registry and following the “Add a new provider” steps below.

## OAuth Flow (Org‑level)

Pattern

- Start: POST `/api/orgs/[orgSlug]/integrations/[provider]/authorize` → returns `{ url }`
- Redirect user to provider authorize URL (uses PKCE + short‑lived `IntegrationAuthState`)
- Callback: GET `/api/integrations/[provider]/callback?code=...&state=...`
  - Validate `state`, exchange code for tokens, fetch account info, upsert `OrganizationIntegration`
  - Redirect to `/o/[orgSlug]/settings/organization/integrations` with success or error

Key details

- State/PKCE stored in DB with 10‑minute TTL, single‑use delete on success.
- Callback path is global (not org‑scoped); the org is resolved via the validated `state` → `organizationId` → `slug`.
- Notion: public OAuth requires `notion_public` enabled; we prevent mixing variants in the same org.
- Reddit/LinkedIn: store `refresh_token` (if provided) and set `expiresAt`. WordPress: credentials are stored encrypted (no OAuth).

## Connect, List, Test, Disconnect (API Contracts)

All endpoints run in Node runtime, require JWT auth, enforce CSRF on mutating methods, and verify org admin or superadmin.

1. List providers and status

- GET `/api/orgs/[orgSlug]/integrations`
- Response: `{ providers: Array<{ provider, displayName, connected, status, accountId?, accountName?, scope?, lastUpdated?, variantsAllowed?, connectionType? }> }`

2. Start OAuth authorization

- POST `/api/orgs/[orgSlug]/integrations/[provider]/authorize`
- Body: none; CSRF required
- Response: `{ url }` (redirect target for the provider)

3. OAuth callback (global)

- GET `/api/integrations/[provider]/callback?code&state`
- Behavior: exchanges code, upserts integration, audits `integration.connected`, redirects back to org settings with search params

4. Disconnect integration

- DELETE `/api/orgs/[orgSlug]/integrations/[provider]`
- Behavior: attempts provider revocation when supported (e.g., Reddit), deletes local record, audits `integration.disconnected`
- Response: `{ success: true, message }`

5. Test connection

- POST `/api/orgs/[orgSlug]/integrations/[provider]/test`
- Body: `{ method, endpoint, headers?, query?, body? }` (endpoint must be a relative path like `/me`)
- Response (success): `{ ok: true, httpStatus, correlationId, data }`
- Response (error): `{ ok: false, code, message, httpStatus?, correlationId }`

## Security Guardrails

- Runtime: `export const runtime = "nodejs"` for all routes using DB/secrets
- AuthZ: `requireAdminOrSuperadmin(userId, orgId)` for org‑scoped endpoints
- CSRF: `validateCsrf(request)` on POST/PUT/PATCH/DELETE
- Secret handling: never expose plaintext; decrypt only on server just‑in‑time for requests
- Error hygiene: map provider errors to structured codes; avoid leaking tokens/headers
- Correlation IDs: generate per request and echo in responses; include in logs for traceability

## Client Wrappers and Call Pipeline

Centralize provider calls in `lib/integrations/client.ts` and `lib/integrations/trigger.ts`:

- Per‑provider request helpers: `redditRequest`, `notionRequest`, `linkedinRequest`, `wordpressRequest`
  - Decrypt tokens, set headers, build URL, auto‑refresh (when supported), mark expired integrations on 401 if no refresh
- `callIntegration({ orgId, userId, provider, endpoint, method?, headers?, query?, body?, correlationId? })`
  - Switches to the correct helper; parses response; maps errors to `IntegrationError`
  - Calls `logIntegrationCall` with sanitized/truncated bodies when logging is enabled

Usage logging (optional)

- Gate with `INTEGRATIONS_USAGE_LOGGING_ENABLED`
- Store `requestTruncated` and `responseTruncated` with sensitive keys redacted (token/secret/password/authorization)
- Record `correlationId`, latency, and HTTP status to aid debugging

## Minimal UI Pattern (follows current app)

- Page: `/o/[orgSlug]/settings/organization/integrations`
- Server fetch: GET `/api/orgs/[orgSlug]/integrations` for providers and status
- Actions
  - Connect: POST `/api/orgs/[orgSlug]/integrations/[provider]/authorize` → client redirects to returned `url`
  - Test: POST `/api/orgs/[orgSlug]/integrations/[provider]/test` with a small, safe default endpoint
  - Disconnect: DELETE `/api/orgs/[orgSlug]/integrations/[provider]`
- Display: provider display name, connection status, `accountName`, last updated, and variant flags (for Notion)

Accessibility and UX notes

- Disable Connect when provider not allowed by env
- Show success/error banners using redirect params from the OAuth callback (`connected`, `error`, `accountName`)
- Confirm before disconnect; surface provider‑specific constraints (e.g., LinkedIn scope limitations)

## Adding a New Provider (Recipe)

1. Register provider

- Add entry in `lib/integrations/providers.ts` with `displayName`, `baseUrl`, `authorizeUrl`, `tokenUrl`, optional `revokeUrl`, `defaultScopes`, `defaultHeaders`, and `supportsRefresh`
- Update env validations in `lib/env.ts` to require credentials when allowed

2. OAuth specifics

- If OAuth: extend `buildAuthorizeUrl()` and `exchangeCodeForToken()` in `lib/integrations/oauth.ts`
  - Provide state/PKCE handling, token exchange (client auth style varies), and `fetchAccountInfo()` that returns `{ accountId, accountName }`
- If non‑OAuth: define how credentials are captured and stored (encrypt before persisting)

3. Client request wrapper

- Add a `xyzRequest(orgId, path, options)` in `lib/integrations/client.ts`
  - Decrypt tokens, set headers, handle refresh (if supported), mark `status="error"` on expired auth when no refresh
  - Reuse `getOrgIntegration()` and `refreshAccessToken()` where possible

4. API endpoints (org‑scoped)

- Connect: reuse POST `/api/orgs/[orgSlug]/integrations/[provider]/authorize`
- Disconnect: DELETE `/api/orgs/[orgSlug]/integrations/[provider]`
- Optional provider‑specific endpoints under `/api/orgs/[orgSlug]/integrations/[provider]/...`

5. UI

- Add a card/list item in the Integrations page; wire buttons to the endpoints above

## Testing and Edge Cases

- OAuth callback without resolvable `state` → 500 with plain text; ensure state TTL and single‑use delete
- Provider returns `error` on callback → redirect back with `error` param; message shown in UI
- Token refresh failures → mark integration `status="error"` and surface reconnect prompt
- 401 on non‑refresh providers (Notion/WordPress) → set error status; require reconnect
- Disconnect should attempt provider revocation if available; always delete local record and audit
- LinkedIn analytics and some endpoints require specific program approvals; expect limited data without them

## Security and Audit

- Audit actions: `integration.connected`, `integration.disconnected` (include provider and accountName)
- Keep all DB/secrets on server; never import server‑only modules in client code
- Ensure CSRF validation and Origin/Referer allowlist are enforced on all mutating endpoints

## Quick Reference (files in this repo)

- Env validation: `lib/env.ts`
- Encryption helpers: `lib/secrets.ts`
- Provider registry: `lib/integrations/providers.ts`
- OAuth helpers: `lib/integrations/oauth.ts`
- Client wrappers + logging: `lib/integrations/client.ts`, `lib/integrations/trigger.ts`
- List providers: `app/api/orgs/[orgSlug]/integrations/route.ts`
- Start OAuth: `app/api/orgs/[orgSlug]/integrations/[provider]/authorize/route.ts`
- Callback: `app/api/integrations/[provider]/callback/route.ts`
- Disconnect: `app/api/orgs/[orgSlug]/integrations/[provider]/route.ts` (DELETE)
- Test endpoint: `app/api/orgs/[orgSlug]/integrations/[provider]/test/route.ts`

---

This document is intentionally provider‑agnostic and mirrors robust patterns (org‑scoped connections, encrypted tokens, CSRF, structured errors, optional logging) so you can adopt it in any Next.js App Router codebase with existing multi‑tenant support.
