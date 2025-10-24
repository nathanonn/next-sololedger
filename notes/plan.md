# Reddit OAuth Callback Fix + Integrations “Test Connection” Plan

This plan fixes the post‑OAuth logout/crash by updating auth cookies to SameSite=lax (toggleable via a new env flag for safe rollback) and by ensuring the OAuth callback always redirects users back to the Integrations page with a clear error message instead of returning raw 400/500 errors. It then adds a provider‑agnostic “Test Connection” feature in the Integrations settings: a modal playground that posts to a new server‑only test endpoint, supports all HTTP methods, optional headers and JSON body, and displays prettified results with correlation IDs that link to the existing Integration Usage logs. All work respects guardrails: Node runtime for DB access, server‑only secrets, Lucide icons only, and local Postgres with Prisma.

## Decisions (confirmed)
- 1/ Cookies: a) SameSite=lax for both access and refresh
- 2/ Callback errors: a) Redirect back to Integrations with `?error=`
- 3/ Modal scope: b) Full controls (method, endpoint, headers JSON, body JSON)
- 4/ Endpoint safety: a) Relative paths only; base URL server‑side
- 5/ Who can test: a) Admin or Superadmin
- 6/ Button placement: a) On each connected provider card
- 7/ Default tests: a) Reddit `/api/v1/me`, Notion `/users/me`
- 8/ Results UI: a) Pretty‑printed JSON + status + correlation ID
- 9/ Error guidance: a) Map common codes to friendly messages
- 10/ Rollback: a) Feature flag `AUTH_SAMESITE_STRATEGY`

## Implementation Steps

1) Fix OAuth Return Logout
- Add `AUTH_SAMESITE_STRATEGY` to `lib/env.ts` as a z.enum(`strict | lax | none`), default `lax`.
- In `lib/jwt.ts`, set both access and refresh cookies using `sameSite` from env:
  - `strict` → current behavior (not recommended for OAuth)
  - `lax` → default; allows cookies on top‑level cross‑site redirects
  - `none` → only if fully HTTPS; force `secure: true`
- Add inline comments documenting why OAuth flows require `lax`.
- Update `.env.example` with the new variable and guidance.

2) Harden OAuth Callback UX
- File: `app/api/integrations/[provider]/callback/route.ts` (Node runtime).
- If provider returns `error`, keep current redirect with `?error=`.
- If `code` or `state` are missing but `state` resolves to an org, redirect to `/o/{orgSlug}/settings/organization/integrations?error=Missing+code+or+state` instead of returning 400.
- If `state` is invalid and orgSlug cannot be resolved, respond 500 (no safe org to target).
- Keep success path: redirect with `?connected={provider}&accountName=...`.

3) Test Connection API (server‑only)
- New route: `app/api/orgs/[orgSlug]/integrations/[provider]/test/route.ts`.
- `export const runtime = "nodejs"`.
- AuthZ: `getCurrentUser`, `getOrgBySlug`, `requireAdminOrSuperadmin`.
- CSRF: `validateCsrf(request)`.
- Provider allowlist: `isIntegrationAllowed(provider)`.
- Input (Zod):
  - `method`: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS"
  - `endpoint`: string; must start with `/` (reject absolute URLs)
  - `headers?`: Record<string,string>
  - `query?`: Record<string,string>
  - `body?`: unknown (JSON)
- Execution: call `callIntegration({ orgId, userId, provider, endpoint, method, headers, query, body })`.
- Response:
  - Success: `{ ok: true, httpStatus, correlationId, data }`
  - Error: `{ ok: false, code, message, httpStatus?, correlationId? }`
- Safety: enforce relative endpoints; base URL comes from `PROVIDER_INFO` server‑side (prevents SSRF); never expose tokens to client.

4) UI — “Test Connection” Modal
- Update `components/features/integrations/integrations-management.tsx`:
  - For each provider card with `connected=true`, render a `Test Connection` button.
  - Clicking opens a new client component `IntegrationTestDialog`.
- New `components/features/integrations/integration-test-dialog.tsx` (client):
  - Props: `orgSlug`, `provider`, `displayName`.
  - Prefills: Reddit → `GET /api/v1/me`; Notion → `GET /users/me`.
  - Controls: Method select; Endpoint input (relative only); Headers JSON textarea (optional); Body JSON textarea (shown for non‑GET/HEAD). Validate JSON before submit.
  - Preview: “Will call: {METHOD} {providerBaseUrl}{endpoint}”. Use a small client‑safe map for base URLs (no server imports).
  - Submit: POST to `/api/orgs/{orgSlug}/integrations/{provider}/test`.
  - Result: status badge (success/destructive), HTTP status, correlation ID, and a pretty‑printed code block of the response. Map common error codes to friendly text (401 “Reconnect the integration”, 403 “Permission denied”, 404 “Not found”, 429 “Rate limited”).
  - Follow shadcn Dialog guidance; only apply the pointer‑events restore pattern if invoked via a dropdown/context menu.

5) Logging & Observability
- Reuse `logIntegrationCall` (already redacts secrets and truncates payloads).
- Surface returned `correlationId` in the modal. Mention that full details appear in the Integration Usage dashboard.

6) File Changes (summary)
- Update: `lib/env.ts`, `lib/jwt.ts`, `app/api/integrations/[provider]/callback/route.ts`, `.env.example`, `notes/skills/reddit_integration.md` (cookie note).
- Add: `app/api/orgs/[orgSlug]/integrations/[provider]/test/route.ts`, `components/features/integrations/integration-test-dialog.tsx`.
- Minor: `components/features/integrations/integrations-management.tsx` to mount the dialog and button.

7) Validation Plan
- OAuth: Reddit connect returns to Integrations while staying signed in; denial/missing code redirects back with error toast.
- Test modal: default GET to identity endpoints succeeds and shows payload + correlation ID; 401 after manual revoke prompts reconnection; non‑JSON responses render as text.
- Regression: OTP signin, refresh rotation, and protected routes continue to work.

8) Rollout & Rollback
- Default `AUTH_SAMESITE_STRATEGY=lax` across environments.
- Rollback options: set to `strict` (OAuth returns will fail as before) or `none` (only if fully HTTPS; `secure=true` enforced).

## Acceptance Criteria
- Connecting Reddit no longer logs users out; callback never strands users on a raw error page.
- Integrations settings show a “Test Connection” button for connected providers.
- Test modal supports method/endpoint/headers/body, runs calls server‑side, and displays results with correlation IDs.
- All guardrails maintained: Node runtime for DB, secrets never exposed client‑side.
