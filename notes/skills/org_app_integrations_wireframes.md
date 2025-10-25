# App Integrations UX Flow and Wireframes

This document provides a reusable UX flow map and ASCII wireframes for organization-level App Integrations. It aligns with `org_app_integrations.md` and follows the current app’s patterns: provider cards, OAuth callback at `/api/integrations/[provider]/callback?code&state`, encrypted tokens, admin/superadmin actions, and a test connection utility. It assumes multi-tenant support already exists and does not repeat it.

Assumptions from your selections

- Providers: Reddit, Notion (public OAuth), LinkedIn, WordPress (non‑OAuth internal connect) (1/a)
- Layout: Card/grid per provider; follow current app’s layout (2/a)
- Post‑callback messaging: Inline banner at top (success/error); optional toast (3/a)
- Test connection: Simple form (method, endpoint, headers, query, body), show JSON result and correlationId (4/a)
- WordPress connect: Modal with Site URL, Username, Application Password; validate HTTPS; show site title on success (5/a)
- Notion variants: Single Notion card with “Public OAuth” note when allowed; prevent connect when variant not allowed (6/a)
- Permissions (non‑admins): Show read‑only status and hide action buttons (7/b)
- Disconnect: Confirmation dialog before action (8/a)
- Empty/config‑disabled: Clear empty state when `INTEGRATIONS_ENABLED=false` or none allowed (9/a)
- Mobile: Single‑column stacked cards; actions accessible (10/a)
- Card details: Connected/Disconnected/Error chip; accountName; last updated; optional scope; WP shows truncated site URL (11/a)
- Post‑connect quick actions: Keep Test + Disconnect on card; optional details drawer (12/a)
- LinkedIn analytics link: Excluded for now (13/b)
- Correlation ID: Always show with Copy in Test UI (14/a)
- Error state: Only show Disconnect (no dedicated Reconnect button) (15/b)

## Flow map

- Entry: `/o/[orgSlug]/settings/organization/integrations`
  - If `INTEGRATIONS_ENABLED=false` or `INTEGRATIONS_ALLOWED` empty → show Disabled Empty State
  - Else → fetch providers and statuses via `GET /api/orgs/[orgSlug]/integrations`

- Provider Cards
  - Show display name, status chip, accountName, last updated, scope?, and (WP) site URL truncated
  - Actions (admin/superadmin only): [Connect] or [Test] [Disconnect]
  - Non‑admins: read‑only card (no action buttons)

- Connect (OAuth providers: Reddit, Notion public, LinkedIn)
  - Click [Connect] → `POST /api/orgs/[orgSlug]/integrations/[provider]/authorize` → returns `{ url }`
  - Browser redirects to provider → consent → callback to `/api/integrations/[provider]/callback?code&state`
  - Callback resolves `orgSlug` from state, upserts integration, then redirects back with `?connected=provider&accountName=...` or `?error=...`
  - Page shows banner with success/error and updates card status

- Connect (WordPress internal)
  - Click [Connect] → open “Connect WordPress” modal
  - Admin enters Site URL (HTTPS), Username, Application Password → `POST` to a WordPress connect endpoint (internal‑connect) → on success, card shows Connected with site title

- Test Connection
  - Click [Test] → modal with form (method, endpoint, headers, query, body)
  - Submit → `POST /api/orgs/[orgSlug]/integrations/[provider]/test`
    - Success: show JSON result, HTTP status, and correlationId (copyable)
    - Error: show structured code/message and correlationId (copyable)

- Disconnect
  - Click [Disconnect] → confirm dialog → `DELETE /api/orgs/[orgSlug]/integrations/[provider]` → banner on success/error

---

## Screen 1: Integrations (Desktop — Provider Cards Grid)

+-----------------------------------------------------------------------------------+
| Settings / Organization / Integrations                                            |
+-----------------------------------------------------------------------------------+
| [ Banner: Connected Reddit as @exampleUser ]  or  [ Banner: Error: OAuth denied ] |
+-----------------------------------------------------------------------------------+
| Reddit                          | Notion (Public OAuth)         | LinkedIn        |
|-----------------------------------------------------------------------------------|
| Status: [ Connected ✓ ]         | Status: [ Disconnected ]      | Status: [ Error ]|
| Account: @exampleUser           | Account: —                    | Account: —       |
| Last Updated: 2025-10-25 13:22  | Last Updated: —               | Last Updated: —  |
| Scope: identity read            | Note: Public OAuth enabled     | Scope: r_lite... |
|                                 |                                |                  |
| [ Test ] [ Disconnect ]         | [ Connect ]                    | [ Disconnect ]   |
+-----------------------------------------------------------------------------------+
| WordPress (Internal Connect)                                                       |
|-----------------------------------------------------------------------------------|
| Status: [ Disconnected ]                                                           |
| Site: — (enter HTTPS site URL on connect)                                          |
| Last Updated: —                                                                    |
|                                                                                    |
| [ Connect ]                                                                        |
+-----------------------------------------------------------------------------------+

Notes
- Non‑admin users see the same cards but without action buttons; a footnote can explain “Admin or superadmin required.”
- Error status shows only [Disconnect]. No dedicated [Reconnect] button.
- Use provider display names from registry; scope shown when available.

---

## Screen 2: Integrations (Mobile — Stacked Cards)

+-----------------------------------------------------------------------------------+
| Settings / Organization / Integrations                                            |
+-----------------------------------------------------------------------------------+
| [ Banner (success/error) ]                                                        |
+-----------------------------------------------------------------------------------+
| [Card] Reddit                                                                     |
| Status: [ Connected ✓ ]  Account: @exampleUser  Last Updated: 13:22               |
| Scope: identity read                                                              |
| Actions: [ Test ]  [ Disconnect ]                                                 |
+-----------------------------------------------------------------------------------+
| [Card] Notion (Public OAuth)                                                      |
| Status: [ Disconnected ]  Note: Public OAuth enabled                              |
| Actions: [ Connect ]                                                              |
+-----------------------------------------------------------------------------------+
| [Card] LinkedIn                                                                   |
| Status: [ Error ]                                                                 |
| Actions: [ Disconnect ]                                                           |
+-----------------------------------------------------------------------------------+
| [Card] WordPress (Internal Connect)                                               |
| Status: [ Disconnected ]  Site: —                                                 |
| Actions: [ Connect ]                                                              |
+-----------------------------------------------------------------------------------+

Notes
- Cards stack vertically; actions may wrap or move to overflow menu if space is tight.

---

## Screen 3: OAuth Connect Flow (Represented by Banner on Return)

+-----------------------------------------------------------------------------------+
| After returning from provider callback                                            |
+-----------------------------------------------------------------------------------+
| [ Success Banner ] Connected Notion as “Acme Workspace”                           |
| [ Error Banner ] OAuth error: access_denied (user canceled)                       |
+-----------------------------------------------------------------------------------+
| The page refreshes provider cards to reflect new status.                          |
+-----------------------------------------------------------------------------------+

---

## Screen 4: Test Connection (Modal)

+-------------------------------------------+
| Test Connection: Reddit                   |
|-------------------------------------------|
| Method     [ GET  v ]                     |
| Endpoint   [ /api/v1/me               ]   |
| Headers    [ {"User-Agent":"..."}   ]   |
| Query      [ {"limit":"5"}          ]   |
| Body       [ { }                        ] |
|-------------------------------------------|
| [ Run Test ]                               |
|-------------------------------------------|
| Result:                                    |
| HTTP: 200   Correlation ID: 7f6a…9b [Copy] |
| {                                           |
|   "name": "exampleUser",                |
|   "id": "abc123"                       |
| }                                           |
+-------------------------------------------+

Error state example (same modal)

+-------------------------------------------+
| Test Connection: LinkedIn                 |
|-------------------------------------------|
| …                                         |
|-------------------------------------------|
| [ Run Test ]                               |
|-------------------------------------------|
| Error: FORBIDDEN (403)                     |
| Message: Permission denied                 |
| Correlation ID: 18cd…42 [Copy]            |
+-------------------------------------------+

Notes
- The endpoint is a relative path; server composes full URL per provider.
- Correlation ID is always shown and copyable for support.

---

## Screen 5: Connect WordPress (Modal)

+-------------------------------------------+
| Connect WordPress                         |
|-------------------------------------------|
| Site URL (HTTPS)                          |
| [ https://blog.example.com           ]     |
| Username                                  |
| [ admin                            ]       |
| Application Password                       |
| [ ******************************  ]       |
|-------------------------------------------|
| [ Cancel ]               [ Connect ]       |
+-------------------------------------------+

Post‑submit
- Validate HTTPS unless `WORDPRESS_ALLOW_HTTP_DEV=true` in development.
- On success, card shows: Status Connected ✓, Site: blog.example.com, Account: “Site Title”.
- On 401/invalid site → inline error under fields.

---

## Screen 6: Disconnect Confirmation (Dialog)

+-------------------------------------------+
| Disconnect Integration                    |
|-------------------------------------------|
| Disconnect Reddit from this organization? |
| This revokes access and removes tokens.   |
|-------------------------------------------|
| [ Cancel ]                 [ Disconnect ]  |
+-------------------------------------------+

Notes
- Simple confirm (no type‑to‑confirm). Use for disconnects only.

---

## Screen 7: Empty / Disabled State

+-----------------------------------------------------------------------------------+
| Integrations are disabled by environment                                          |
|-----------------------------------------------------------------------------------|
| This environment has `INTEGRATIONS_ENABLED=false` or no providers allowed.        |
| Ask your administrator to configure credentials and allowed providers.            |
| See docs: org_app_integrations.md                                                |
+-----------------------------------------------------------------------------------+

Variant: No connections yet

+-----------------------------------------------------------------------------------+
| No integrations connected yet                                                    |
|-----------------------------------------------------------------------------------|
| Connect a provider to get started.                                               |
| Cards below show status and available actions.                                   |
+-----------------------------------------------------------------------------------+

---

## Interaction and Security Notes

- All mutating routes (authorize, test, disconnect, WP connect) require CSRF validation and Origin/Referer checks.
- Only admins or superadmins see action buttons; non‑admins see read‑only status.
- Tokens are encrypted at rest and never visible in UI; logs redact sensitive fields.
- Callback errors are safely surfaced via banners; no secrets are revealed.
- Error status on a card shows only [Disconnect]; no dedicated [Reconnect] button.

## Checklist (for implementation)

- [ ] Integrations page with provider cards grid; mobile stacked layout
- [ ] Success/error banners after OAuth callback; update cards accordingly
- [ ] Connect (OAuth): POST authorize → external consent → global callback → redirect back
- [ ] Connect (WordPress): modal capture; validate HTTPS; on success show site title
- [ ] Test modal: method/endpoint/headers/query/body; show HTTP status, JSON, correlationId with Copy
- [ ] Disconnect confirm dialog; handle provider revocation when available
- [ ] Non‑admin read‑only cards; admins/superadmins get action buttons
- [ ] Disabled/empty states aligned with env (`INTEGRATIONS_ENABLED`, `INTEGRATIONS_ALLOWED`)
- [ ] Security: CSRF, server‑only secrets, audit connect/disconnect actions

---

These wireframes intentionally focus on the minimal, portable surfaces needed to manage and validate organization‑level integrations. They align with the server‑first patterns and API contracts in `org_app_integrations.md` and can be adapted to any Next.js App Router project.
