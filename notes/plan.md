# Plan: Add Notion Internal Integration alongside Public OAuth

This plan adds first-class support for two Notion integration types—public (OAuth) and internal (token)—controlled via environment flags. We’ll enforce a single Notion integration per org at a time, persist the connection type in the database, and provide secure admin-only endpoints and UI to connect and rotate internal tokens. The existing OAuth flow remains for public; client requests to Notion continue to use the same provider key ("notion"). The UI shows a single Notion card with a connect dropdown for the chosen variant(s), plus an “Update token” action for internal.

## Decisions (your choices)

- INTEGRATIONS_ALLOWED format: a) "reddit,notion_public,notion_internal"
- Allow both Notion variants simultaneously: a) No (one per org)
- Store workspace ID: a) Yes (optional)
- UI for both variants: a) Single Notion card with dropdown
- Token rotation UX: a) Provide "Update token" action (PATCH)
- Legacy "notion" in env: b) Hard-break (require explicit notion_public/internal)
- DB column name for variant: a) connectionType

## Scope

1. Env and validation
2. DB schema + migration
3. API surface (list, public authorize guard, internal connect, internal token rotate, disconnect)
4. Client utilities (reuse)
5. UI updates (single Notion card, connect dropdown, internal connect dialog, update token)
6. Documentation updates
7. QA and minimal tests

## Changes by Layer

### 1) Environment and Provider Helpers

- INTEGRATIONS_ALLOWED accepts: `reddit`, `notion_public`, `notion_internal`.
- Remove legacy `notion` (hard break) with a clear validation error.
- Require `NOTION_CLIENT_ID` and `NOTION_CLIENT_SECRET` only when `notion_public` is enabled.
- `lib/integrations/providers.ts`:
  - Keep `IntegrationProvider = "reddit" | "notion"`.
  - `getAllowedIntegrations()` returns base providers; if any Notion variant enabled, include `"notion"`.
  - Add `getNotionVariantFlags()` returning `{ public: boolean, internal: boolean }`.

### 2) Database Schema and Migration

- `OrganizationIntegration` add fields:
  - `connectionType` String @db.VarChar(20), default: "public"; values: "public" | "internal".
  - `workspaceId` String? @db.VarChar(255).
- Keep unique constraint `(organizationId, provider)` (enforces one Notion integration per org).
- Migration: backfill existing Notion rows with `connectionType = "public"`.

### 3) APIs

- GET `/api/orgs/[orgSlug]/integrations`
  - Include `variantsAllowed` for Notion item: `{ public, internal }`.
  - Include `connectionType` when connected.

- POST `/api/orgs/[orgSlug]/integrations/[provider]/authorize` (public OAuth)
  - If `provider === "notion"`, require `notion_public` enabled; else 400.

- GET `/api/integrations/[provider]/callback` (public OAuth)
  - Unchanged. Upsert will implicitly set `connectionType = "public"`.

- NEW: POST `/api/orgs/[orgSlug]/integrations/notion/internal-connect`
  - Admin-only + CSRF.
  - Input: `{ token: string; workspaceId?: string }`.
  - Client: require non-empty token only; Server: verify token via API call.
  - Verify token via `GET https://api.notion.com/v1/users/me` using `Notion-Version`.
  - If a Notion integration already exists for org: 409 (disconnect first).
  - Upsert `provider="notion"`, `connectionType="internal"`, `encryptedAccessToken=token`, `encryptedRefreshToken=null`, `tokenType="bearer"` (optional), `expiresAt=null`, `scope=null`, `workspaceId` if provided; save `accountId` (bot id) and `accountName` (workspace_name). Audit log `integration.connected`.

- NEW: PATCH `/api/orgs/[orgSlug]/integrations/notion/token`
  - Admin-only + CSRF.
  - Input: `{ token: string }`.
  - Verify token via `/v1/users/me`. If Notion internal is not the current connection: 409 or 400.
  - Update `encryptedAccessToken` and optionally refresh `accountName`. Audit log `integration.token_rotated`.

- DELETE `/api/orgs/[orgSlug]/integrations/[provider]`
  - Unchanged. For Notion, no provider revoke; delete and audit log `integration.disconnected`.

### 4) Client Utilities

- `lib/integrations/client.ts` `notionRequest()` remains unchanged—resolves tokens regardless of connectionType.
- 401 handling remains: mark status="error"; UI prompts reconnect/update.

### 5) UI

- `components/features/integrations/integrations-management.tsx` updates:
  - Single Notion card with split-button dropdown:
    - "Connect with OAuth (Public)" shown when `variantsAllowed.public` is true.
    - "Connect with Token (Internal)" shown when `variantsAllowed.internal` is true.
  - Show badge: `Type: Public` or `Type: Internal` when connected.
  - When internal & connected: show an "Update token" action (opens the internal dialog in update mode; calls PATCH route).
  - Error state for Notion still shows Reconnect (public) or Update token (internal) accordingly.

- New `NotionInternalConnectDialog`:
  - Fields: Internal Integration Token (required), Workspace ID (optional).
  - Client validation: token must be non-empty; rely on server verification for correctness.
  - Submits to internal-connect (for connect) or token PATCH (for update).
  - Success and error toasts + list refresh.

### 6) Documentation

- `.env.example`
  - Use `INTEGRATIONS_ALLOWED="reddit,notion_public,notion_internal"`.
  - Note: `NOTION_CLIENT_ID`/`NOTION_CLIENT_SECRET` required only when `notion_public` is present.
  - Remove legacy `notion`; add a note it is unsupported.

- README/notes
  - Internal integration steps: create internal integration in Notion, copy token (starts with `secret_`), share pages/databases with the integration; optionally capture workspace ID.
  - How to reconnect/update tokens.

### 7) QA and Minimal Tests

- Manual checks:
  - Public OAuth connect and disconnect; Notion calls succeed.
  - Internal connect with valid token; invalid/expired token yields error; Notion calls succeed after connect.
  - Switching variants requires disconnect first (409).
  - 401 from Notion marks status="error" and prompts correct remediation for each type.

- Tests (optional initial set):
  - Env parsing/validation for variant flags and legacy `notion` hard-break.
  - Internal connect route token verification success/failure.

## API Contracts (succinct)

- POST `/api/orgs/[orgSlug]/integrations/notion/internal-connect`
  - In: `{ token: string; workspaceId?: string }`
  - Out: `200 { ok: true }` | `409 { error }` | `400 { error }` | `401/403`

- PATCH `/api/orgs/[orgSlug]/integrations/notion/token`
  - In: `{ token: string }`
  - Out: `200 { ok: true }` | `400/404/409 { error }` | `401/403`

- GET `/api/orgs/[orgSlug]/integrations`
  - Out (Notion item fields added): `variantsAllowed`, `connectionType` (if connected)

## Edge Cases

- Env contains legacy `notion` → fail validation with remediation message.
- Internal token invalid at connect/rotate → 400.
- Notion returns 401 later → set status="error"; surface correct remediation per type.
- Attempt to connect Notion when already connected → 409.

## User-Facing Error Copy

- When a Notion integration already exists and admin attempts to connect the other type:
  - HTTP 409 with message: "A Notion integration already exists for this organization. Disconnect it before switching the connection type."

## Rollout & Migration Steps

1. Apply Prisma migration (adds columns & backfill connectionType="public").
2. Update env: replace `notion` with `notion_public` / `notion_internal` as needed.
3. Deploy server and UI changes.
4. Verify both flows in staging.

## Acceptance Criteria

- Variant flags via env control which flows are available.
- Exactly one Notion integration per org; connect flow enforces this.
- Internal connect and token rotation work and are verified against Notion API.
- UI shows variant badges/actions appropriately; test dialog works for both types.
- Tokens are encrypted; logs redact secrets; audit events recorded.

## Risks & Follow-ups

- If Notion changes token format, relax token shape validation (keep server-side verification as source of truth).
- Optional: add rate limits to internal-connect and token PATCH routes.
