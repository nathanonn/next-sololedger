# External Integrations — UX Flow Map and ASCII Wireframes

This document outlines the end-to-end UX for org-level integrations (Reddit, Notion): discovery, connect, callback, status, disconnect, and optional usage logs. It mirrors the AI keys management experience for familiarity.

## Flow Map

```
Org Settings > Integrations Tab
				|
				|-- If INTEGRATIONS_ENABLED && provider in INTEGRATIONS_ALLOWED
				v
	[Integrations Management]
				|
				|-- Connect Reddit ---------------> POST /authorize (returns URL) -> Redirect to Reddit OAuth
				|                                                                                |
				|                                                                                v
				|                                                           GET /callback (exchange code, save tokens)
				|                                                                                |
				|                                                                                v
				|<-------------------- Redirect back to Integrations with success/error banner <-|
				|
				|-- Connect Notion ---------------> POST /authorize (returns URL) -> Redirect to Notion OAuth
				|                                                                                |
				|                                                                                v
				|                                                           GET /callback (exchange code, save tokens)
				|                                                                                |
				|                                                                                v
				|<-------------------- Redirect back to Integrations with success/error banner <-|
				|
				|-- Disconnect (Reddit/Notion) --> DELETE /integrations/[provider] -> Update status (revoke Reddit if possible)
				|
				|-- View Usage (optional) -------> Integration Usage (logs table) -> View Log Detail (sheet)
```

## Screens

### 1) Integrations Tab (List & Status)

Route: `/o/[orgSlug]/settings/organization/integrations`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Organization Settings ▸ Integrations                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Banner: Connected to Reddit as u/username] [Dismiss]                       │
│ [Banner: Notion disconnected successfully] [Dismiss]                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ Provider Cards                                                              │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Reddit (status: ● Connected | ○ Not connected)                           │ │
│ │ Account: u/username (last updated: 2025-10-23 14:20)                     │ │
│ │ Scopes: identity read                                                    │ │
│ │                                                                           │ │
│ │ [Connect]  [Disconnect]                      [View Usage]                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Notion (status: ● Connected | ○ Not connected)                           │ │
│ │ Workspace: Acme HQ (last updated: 2025-10-23 14:22)                      │ │
│ │ API Version: 2022-06-28                                                  │ │
│ │                                                                           │ │
│ │ [Connect]  [Disconnect]                      [View Usage]                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

States

- If not allowed (env): show empty state “No integrations available”.
- Connected: show account/workspace name, connected dot, and Disconnect.
- Error: status chip switches to error (e.g., token invalid); show Reconnect CTA.

Actions

- Connect: triggers POST /authorize; client navigates to returned URL.
- Disconnect: opens confirmation dialog, then DELETE; refresh list and show success banner.
- View Usage: navigates to logs view with provider filter.

### 2) Connect Flow (Client Action Dialog)

```
┌─────────────────────────── Connect Integration ─────────────────────────────┐
│ Provider: Reddit                                                            │
│                                                                              │
│ This will open Reddit to authorize access for your organization.             │
│ Scopes: identity read                                                        │
│                                                                              │
│ [Cancel]                                   [Continue to Reddit]              │
└─────────────────────────────────────────────────────────────────────────────┘
```

Note: We can inline this step or go straight to provider; if inline, show scope summary and privacy note.

### 3) Provider Authorization (External)

Handled on Reddit/Notion domains. User approves and returns to our callback.

### 4) OAuth Callback Result (Landing Back)

Redirect target: `/o/[orgSlug]/settings/organization/integrations?connected=reddit` or `?error=...`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Success] Reddit connected as u/username                                    │
│ [Error]   Notion connection failed: invalid_code. Try again.                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5) Disconnect Confirmation

```
┌──────────────────────────── Disconnect Integration ─────────────────────────┐
│ Are you sure you want to disconnect Reddit?                                 │
│ This will revoke access and remove all tokens.                              │
│                                                                              │
│ [Cancel]                                          [Disconnect]              │
└─────────────────────────────────────────────────────────────────────────────┘
```

For Notion, include a note: “You may also need to disconnect the integration in your Notion workspace settings.”

### 6) Integration Usage (optional, mirrors AI Usage)

Route: `/o/[orgSlug]/settings/organization/integration-usage`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Organization Settings ▸ Integration Usage                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Filters: [Provider ▼ reddit|notion]  [From: __] [To: __] [Search: ______]   │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Time                Provider  Method  Endpoint         Status  HTTP  …   │ │
│ │────────────────────────────────────────────────────────────────────────│ │
│ │ 2025-10-23 14:31   reddit    GET     /api/v1/me       ok      200       │ │
│ │ 2025-10-23 14:29   notion    POST    /search          error   401       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [Select row] → opens Log Details sheet                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7) Log Details (Sheet)

```
┌──────────────────────────────── Log Details ────────────────────────────────┐
│ Provider: Reddit    Correlation: a1b2c3d4                                   │
│ Endpoint: GET /api/v1/me  Status: ok  HTTP: 200  Latency: 142ms            │
│                                                                             │
│ Request (sanitized)                                                         │
│ { headers: { Authorization: "Bearer [REDACTED]", User-Agent: "…" }, … }   │
│                                                                             │
│ Response (truncated)                                                        │
│ { name: "u/username", id: "…" }                                           │
│                                                                             │
│ Error                                                                       │
│ — (hidden when status=ok)                                                   │
│                                                                             │
│ [Copy request] [Copy response]                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Empty/Disabled States

Integrations disabled (env)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Integrations are disabled for this deployment.                              │
│ Contact your administrator or set INTEGRATIONS_ENABLED=true.                │
└─────────────────────────────────────────────────────────────────────────────┘
```

No allowed providers (env)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ No integrations are available.                                              │
│ Update INTEGRATIONS_ALLOWED to enable providers.                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Routing Summary

- Settings (tab): /o/[orgSlug]/settings/organization/integrations
- Usage (optional): /o/[orgSlug]/settings/organization/integration-usage
- API (server):
  - GET /api/orgs/[orgSlug]/integrations
  - POST /api/orgs/[orgSlug]/integrations/[provider]/authorize
  - GET /api/integrations/[provider]/callback
  - DELETE /api/orgs/[orgSlug]/integrations/[provider]
  - GET /api/orgs/[orgSlug]/integrations/logs (optional)

## Interaction Notes

- Connect opens provider OAuth in the same tab or new tab; recommend same tab for clarity.
- CSRF and admin guard on all mutating endpoints.
- Error banners show next-step guidance (e.g., “Reconnect” for Notion 401s).
- Status chips: default, warning/error variants to reflect token health.
