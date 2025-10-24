# Integrations UX Flow & Wireframes

The following ASCII maps outline the end‑to‑end flows for connecting Reddit, handling the OAuth callback without logging users out, and testing connections from the Integrations settings. Code blocks are intentionally wrapped in triple backticks for proper formatting.

## Flow Map

```
User (Admin)                              App                                      Reddit
────────────────────────────────────────────────────────────────────────────────────────────────────────
1. Navigate to Integrations tab
   /o/{org}/settings/organization/integrations
    │
    │  [Connect Reddit]
    ├────────────────────────────┐ 2. POST /api/orgs/{org}/integrations/reddit/authorize
    │                            │    - Node runtime, CSRF, Admin check
    │                            │    - buildAuthorizeUrl() saves state + PKCE
    │                            ▼    - returns { url }
    │                        302 Redirect to Reddit authorize (identity read, duration=permanent)
    │                            │
    │                            ▼
    │                      User authorizes app
    │                            │
    │                            ▼
    │                        302 Redirect back to
    │                            /api/integrations/reddit/callback?code=...&state=...
    │                            │   (Top‑level navigation; cookies sent with SameSite=lax)
    │                            ▼
    │        Exchange code → tokens → upsert integration → write audit log
    │                            │
    │                        302 Redirect to
    │                            /o/{org}/settings/organization/integrations
    │                            ?connected=reddit&accountName={u}
    │                            │
    ▼                            ▼
Toast: “Reddit connected as {u}”     UI reloads providers list


Callback error branch (missing/denied code or invalid state):
    /api/integrations/reddit/callback?error=access_denied&state=...
    │
    ├─ resolves state → orgSlug → 302 to
    │   /o/{org}/settings/organization/integrations?error=access_denied
    ▼
Toast: “Connection failed: access_denied”


Test Connection flow:
    Integrations tab → [Test Connection] on Reddit card
    │
    ▼
    Modal opens with defaults: Method=GET, Endpoint=/api/v1/me
    │
    ├─ Run Test → POST /api/orgs/{org}/integrations/reddit/test
    │             - Node runtime, CSRF, Admin check, provider allowlist
    │             - callIntegration() → redditRequest() (auto refresh 401)
    │             - logIntegrationCall() (correlationId)
    ▼
    Result in modal: HTTP 200, correlationId=abcd..., JSON payload pretty‑printed
    [View logs] → Integration Usage tab (filter by correlationId)
```

## Screen: Integrations (Connected + Actions)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Integrations                                                                │
│ Connect external services to your organization.                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Reddit                         [Connected]                                   │
│ Account: u_myreddit                                                  ▼      │
│ Scopes: identity read                                                      │
│                                                                             │
│ [Test Connection]   [Disconnect]                                            │
└─────────────────────────────────────────────────────────────────────────────┘

Notes:
- “Test Connection” appears only when status=connected.
- “Disconnect” opens confirmation dialog; on confirm, tokens revoked and removed.
```

## Screen: Connect to Reddit (Redirect)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Redirecting to Reddit…                                                      │
│ You’ll be sent back here automatically after authorizing.                   │
└─────────────────────────────────────────────────────────────────────────────┘

Notes:
- Actual redirect is immediate after POST authorize; this is a conceptual screen.
```

## Screen: OAuth Callback (Success/Error -> Always Back to Integrations)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ (No visible page; server redirects)                                         │
└─────────────────────────────────────────────────────────────────────────────┘

Success redirect:
  /o/{org}/settings/organization/integrations?connected=reddit&accountName={u}
  → Toast: “Reddit connected successfully as {u}” → providers list refreshed

Error redirect:
  /o/{org}/settings/organization/integrations?error=... (e.g., access_denied)
  → Toast: “Connection failed: …” → URL cleaned → user stays signed in
```

## Screen: Test Connection (Modal)

```
┌──────────────────────────── Test Reddit Connection ──────────────────────────┐
│ Provider: Reddit                                                            │
│ Will call: GET https://oauth.reddit.com/api/v1/me                           │
│                                                                             │
│ Method: [ GET ▾ ]   Endpoint: [/api/v1/me__________________________]        │
│                                                                             │
│ Headers (JSON, optional)                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                       │ │
│ │   "Accept": "application/json"                                         │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Body (JSON, optional; shown for non‑GET/HEAD)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ { }                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [Run Test]                                             [Cancel]             │
└─────────────────────────────────────────────────────────────────────────────┘

Run state:
  - Button shows spinner (Loader2). Inputs disabled during request.

Validation:
  - Endpoint must start with "/". Headers/Body must be valid JSON if provided.
  - All requests are POSTed to server test route (Node runtime, CSRF, Admin).
```

## Screen: Test Connection (Results)

```
┌──────────────────────────── Test Reddit Connection ──────────────────────────┐
│ Status: ✓ Success   HTTP: 200   Correlation ID: 1f9c9a3c0a2b4e9a            │
│                                                                             │
│ Response                                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                       │ │
│ │   "name": "u_myreddit",                                               │ │
│ │   "id": "t2_abcd1234",                                              │ │
│ │   "comment_karma": 1234,                                              │ │
│ │   "link_karma": 567                                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [Close]                                   [View logs in Integration Usage]   │
└─────────────────────────────────────────────────────────────────────────────┘

Error example (mapped guidance):
  - 401 → “Reddit auth expired. Reconnect.” + “Reconnect” CTA
  - 403 → “Permission denied”
  - 404 → “Not found”
  - 429 → “Rate limited”
```

## Screen: Integration Usage (Correlate Results)

```
┌────────────────────────────── Integration Usage ─────────────────────────────┐
│ Filters: Provider [All ▾ | Reddit | Notion]  Search [1f9c9a3c...] [Search]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Time                Provider   Method  Endpoint           Status  HTTP  Lat. │
│ 2025-10-24 10:05    reddit     GET     /api/v1/me         ok      200   145ms│
│ 2025-10-24 10:01    reddit     GET     /api/v1/me         error   401   130ms│
└─────────────────────────────────────────────────────────────────────────────┘

Notes:
- Users can paste the correlation ID from the modal to locate the log entry.
```

## Accessibility & Patterns

```
- Buttons have clear labels and focus states.
- Toasts confirm success/errors and do not obstruct form controls.
- Only Admin/Superadmin can see the Test Connection button and call the test API.
- No secrets or tokens are exposed to the client; all network calls happen server‑side.
- Follow shadcn Dialog guidance; restore pointer events only when a dialog is opened from a menu.
```
