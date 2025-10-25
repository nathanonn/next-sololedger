This plan adds LinkedIn (member posting) and self-hosted WordPress integrations to the existing multi-tenant integration framework, enabling each organization to securely connect their own accounts, post updates, and view basic analytics from within the platform. It reuses your current OAuth/state/PKCE, secure secret storage, per-org scoping, usage logging, and admin-guarded API route patterns, while introducing provider-specific settings pages with minimal, focused workflows to validate value quickly.

## Assumptions and decisions

- LinkedIn scope: member posting only (no Company Page), using w_member_social and r_liteprofile; include offline_access to enable refresh tokens when available.
- WordPress: self-hosted OSS via Application Passwords over HTTPS (required); store site URL + basic auth token securely; no plugin dependency.
- Analytics: basic CMS metrics from WordPress REST; basic LinkedIn recent-post listing (no Marketing Developer Program features).
- One connection per provider per org (current schema uniqueness kept).
- Provider settings have targeted “quick actions” (post/test) within each provider page; a unified publisher can be added later.
- Feature gating via INTEGRATIONS_ALLOWED adds: linkedin, wordpress.

## Phase 0 – Prerequisites

- Confirm APP_ENCRYPTION_KEY is set (required when INTEGRATIONS_ENABLED=true).
- Prepare LinkedIn developer app with redirect: ${APP_URL}/api/integrations/linkedin/callback.
- Confirm WordPress target sites support Application Passwords and HTTPS.

## Phase 1 – Provider wiring and environment

Files to update:

- `lib/integrations/providers.ts`
  - Extend `IntegrationProvider` union: add "linkedin" | "wordpress".
  - Add PROVIDER_INFO entries:
    - linkedin: baseUrl=https://api.linkedin.com/v2, authorizeUrl=https://www.linkedin.com/oauth/v2/authorization, tokenUrl=https://www.linkedin.com/oauth/v2/accessToken, defaultScopes from env, defaultHeaders: { "X-Restli-Protocol-Version": "2.0.0", "Content-Type": "application/json" }, supportsRefresh=true.
    - wordpress: placeholder config; will not use OAuth authorize/token; supportsRefresh=false. defaultHeaders empty.
- `lib/env.ts`
  - Add env vars (all optional unless provider allowed):
    - LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_SCOPES (default: "r_liteprofile w_member_social offline_access").
    - INTEGRATIONS_ALLOWED to accept "linkedin" and "wordpress".
    - WORDPRESS_ALLOW_HTTP_DEV? (boolean, default false) to optionally allow http in dev only.
  - Add refinements:
    - If INTEGRATIONS_ENABLED and INTEGRATIONS_ALLOWED includes "linkedin": require LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.
    - If INTEGRATIONS_ENABLED and INTEGRATIONS_ALLOWED includes "wordpress": no global secrets required; validation defers to per-org connect.
- `.env.example` / `.env.local` docs (no code change here in plan): document new keys.

Acceptance criteria

- Adding "linkedin" or "wordpress" to INTEGRATIONS_ALLOWED shows providers in the integrations list.
- Env validation fails if linkedin is enabled without client credentials.

## Phase 2 – Connect/Disconnect flows

LinkedIn (OAuth):

- `lib/integrations/oauth.ts`
  - buildAuthorizeUrl: handle provider "linkedin" with scopes from env; include code_challenge (PKCE) and offline_access in scope if configured.
  - exchangeCodeForToken: POST to LinkedIn token endpoint; store encrypted access_token and refresh_token (if present), token_type, expiresAt.
  - fetchAccountInfo: GET /me (v2) with r_liteprofile to resolve member URN (e.g., urn:li:person:...) and localized name; set `accountId=member URN`, `accountName=localized name`.
  - revokeIntegration: LinkedIn may not support a standard revoke endpoint for all apps; if unavailable, just delete integration and log.
- `app/api/orgs/[orgSlug]/integrations/[provider]/authorize/route.ts`
  - Existing generic route already works; provider must pass isIntegrationAllowed("linkedin").
- `app/api/integrations/[provider]/callback/route.ts`
  - Existing generic route handles state validation and redirect; no changes beyond oauth.ts provider support.

WordPress (internal connect – Application Passwords):

- Create `app/api/orgs/[orgSlug]/integrations/wordpress/internal-connect/route.ts` (POST)
  - Admin + CSRF required.
  - Body: { siteUrl: string, username: string, applicationPassword: string, defaults?: { status?: "draft"|"publish", categoryId?: number, authorId?: number } }.
  - Validate HTTPS unless WORDPRESS_ALLOW_HTTP_DEV=true and NODE_ENV=development.
  - Build Basic token: base64(username:applicationPassword) but store raw "username:applicationPassword" encrypted (safer for future header formats).
  - Test connectivity: GET `${siteUrl}/wp-json/` (site info) and optionally GET `${siteUrl}/wp-json/wp/v2/users/me` to confirm credentials.
  - Upsert `organizationIntegration` with:
    - provider="wordpress", connectionType="internal", status="connected", accountId=siteUrl, accountName=siteTitle.
    - encryptedAccessToken=encrypt("username:applicationPassword").
    - scope: JSON string with defaults (and any extra settings); expiresAt=null; tokenType="basic".
  - Audit log: integration.connected.
- `app/api/orgs/[orgSlug]/integrations/[provider]/route.ts` (DELETE)
  - Existing generic disconnect works; for WordPress just delete and log.

Acceptance criteria

- LinkedIn: clicking Connect redirects to LinkedIn, returns, and shows connected with member name.
- WordPress: entering site URL + creds connects and shows site title; non-HTTPS blocked (except dev flag).

## Phase 3 – Provider client helpers and trigger routing

Files to update:

- `lib/integrations/client.ts`
  - Add `linkedinRequest(orgId, path, options)`:
    - Use `getOrgIntegration(orgId, "linkedin")`; build URL from LinkedIn base; set Authorization: Bearer; add X-Restli-Protocol-Version header; on 401 with supportsRefresh, call refreshAccessToken("linkedin", id) then retry.
  - Add `wordpressRequest(orgId, path, options)`:
    - Use `getOrgIntegration(orgId, "wordpress")`; extract siteUrl from `accountId` (or scope JSON fallback); build URL `${siteUrl}${path}`; set Authorization: Basic base64(username:appPassword); set Content-Type appropriately.
- `lib/integrations/trigger.ts`
  - Route provider === "linkedin" to `linkedinRequest`; provider === "wordpress" to `wordpressRequest`.
  - Extend parseProviderError with LinkedIn/WordPress typical error shapes to create IntegrationError.
- `lib/integrations/oauth.ts`
  - Add LinkedIn refresh support (grant_type=refresh_token) when refresh token exists; update tokens/expiresAt.

Acceptance criteria

- `POST /api/orgs/[orgSlug]/integrations/[provider]/test` works for linkedin and wordpress with simple GET endpoints.

## Phase 4 – Feature endpoints (posting + analytics)

LinkedIn (member posting):

- Create `app/api/orgs/[orgSlug]/integrations/linkedin/post/route.ts` (POST)
  - Admin + CSRF required.
  - Body: { text: string } (simple text updates first).
  - Resolve actor = `accountId` stored (member URN) and POST to `/ugcPosts` or `/posts` per current LinkedIn guidance for member posts.
  - Log via `logIntegrationCall` and return post URN.
- Create `app/api/orgs/[orgSlug]/integrations/linkedin/analytics/route.ts` (GET)
  - Return recent posts list and lightweight stats where accessible without Marketing Partner approval (e.g., fetch last N UGC posts; note: advanced analytics may not be available; handle gracefully).

WordPress:

- Create `app/api/orgs/[orgSlug]/integrations/wordpress/post/route.ts` (POST)
  - Admin + CSRF required.
  - Body: { title: string, content: string, status?: "draft"|"publish", categoryId?: number, authorId?: number }.
  - Apply defaults from scope JSON when missing; POST to `/wp-json/wp/v2/posts`.
  - Return created post ID and link.
- Create `app/api/orgs/[orgSlug]/integrations/wordpress/analytics/route.ts` (GET)
  - Fetch basic metrics: total posts (X-WP-Total from `/wp-json/wp/v2/posts?per_page=1`), recent posts (title/date/status), total comments, maybe users count if available.

Acceptance criteria

- Org admin can post a LinkedIn member update and a WordPress post successfully and receive IDs/links.
- Analytics endpoints return data without errors; if restricted, return partial data with friendly messages.

## Phase 5 – UI: management and provider settings pages

Integrations list enhancements (existing `IntegrationsManagement`):

- Ensure providers appear and support:
  - LinkedIn: standard OAuth Connect/Disconnect + Test Connection.
  - WordPress: show a WordPressInternalConnectDialog (similar to Notion internal) for siteUrl/username/app password.
  - Add a “Manage” button linking to per-provider settings pages.

New settings pages:

- `app/o/[orgSlug]/settings/organization/integrations/linkedin/page.tsx`
  - Show connection status, member name, last updated.
  - Form: quick post (textarea for text); submit to linkedin/post.
  - Readout: recent posts table (from analytics endpoint).
- `app/o/[orgSlug]/settings/organization/integrations/wordpress/page.tsx`
  - Show site info; form inputs for defaults (status/category/author) persisted into integration scope JSON via dedicated route (e.g., PATCH `/api/orgs/[orgSlug]/integrations/wordpress/settings`).
  - Quick post form (title, content, status) posting to wordpress/post.
  - Analytics readout (counts, recent posts).

UI patterns & guardrails

- Use React Hook Form + Zod; Toasts via Sonner; follow SelectItem “none” pattern; dialogs restore pointer events.
- Client-only components for forms; server routes for data fetch/submit; never expose tokens client-side.

Acceptance criteria

- Settings pages render under the org’s settings and respect admin-only access.
- Quick actions work and show success/error toasts.

## Phase 6 – Security, auditing, and logging

- CSRF validation on all POST/PATCH/DELETE.
- Admin or superadmin required for all integration actions per existing helpers.
- Tokens encrypted with AES-256-GCM; never sent to clients.
- Audit logs for connect/disconnect/post actions: integration.connected, integration.disconnected, integration.posted.
- Optional usage logging via `INTEGRATIONS_USAGE_LOGGING_ENABLED` already supported; ensure all new endpoints call `logIntegrationCall`.

## Phase 7 – Error handling and edge cases

- LinkedIn: handle lack of refresh token gracefully (require re-auth when expired); handle 429 rate limits with surfaced errors.
- WordPress: handle CORS and differing site configurations; show clear messages for auth failure, required capabilities, and non-HTTPS rejection.
- Network/timeout: return structured IntegrationError with correlationId to trace logs.

## Phase 8 – Testing and verification

- Manual flows:
  - Connect LinkedIn; create a member post; verify on LinkedIn.
  - Connect a test WordPress site; create a draft and publish; verify via site admin and REST response.
- Endpoint smoke tests using the existing `test` API route for both providers (e.g., LinkedIn: GET /me; WordPress: GET /wp-json/).
- Optional unit tests (future): mock fetch and assert oauth/client helpers’ behavior.

## Phase 9 – Rollout and toggles

- Enable via env: `INTEGRATIONS_ALLOWED="reddit,notion_internal,linkedin,wordpress"` (example).
- For dev-only HTTP WordPress sites (if needed): set WORDPRESS_ALLOW_HTTP_DEV=true.
- Keep LinkedIn Page posting/advanced analytics behind future flags until you obtain approvals.

## Data model notes

- No schema change required.
- Mapping:
  - LinkedIn: accountId = member URN; accountName = member name; scope = scopes string.
  - WordPress: accountId = siteUrl; accountName = site title; scope = JSON string for defaults.

## Deliverables checklist

- Env wiring in `lib/env.ts`, provider config in `lib/integrations/providers.ts`.
- OAuth support for LinkedIn in `lib/integrations/oauth.ts` (authorize, exchange, refresh, account info).
- WordPress internal connect route and dialog.
- Client helpers for linkedinRequest and wordpressRequest; trigger routing + error parsing.
- Feature endpoints: post + analytics for both providers.
- Provider settings pages with quick actions and basic analytics.
- Audit logging and (optional) usage logging.

## Acceptance criteria (summary)

- An org admin can:
  1.  Connect LinkedIn (member) and post a text update.
  2.  Connect a WordPress site via Application Passwords (HTTPS), set defaults, and create a post.
  3.  View basic analytics for both providers.
  4.  Test connections and disconnect from the integrations UI.
  5.  All operations respect CSRF, admin ACLs, and never expose secrets to client.

## Future enhancements (non-blocking)

- LinkedIn Page posting and analytics after Marketing Developer Program approval; Page selection UI and default target per org.
- WordPress media upload, taxonomy management, and scheduled publishing.
- Unified cross-provider Publisher with scheduling, previews, and content templates.
- Dedicated `organization_integration_settings` table for provider-specific settings; migrate JSON-in-scope to structured columns.
