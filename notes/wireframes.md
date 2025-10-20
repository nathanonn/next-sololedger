# UX Flow Map and Screen-by-Screen Wireframes

This UX follows the organization-wide AI plan in `notes/plan.md`. Admins (and superadmins) manage provider keys and curated models under AI API Keys. AI Usage provides filters, totals, a paginated log table, and detail inspector, with purge controls. All actions are server-backed and CSRF-protected.

---

## Flow Map

- Entry (Org Admin): Organization Settings → AI API Keys ("ai-keys")
	- Server: fetch provider statuses and models
	- Actions: add/update/delete provider key, verify before save; manage curated models; set default model

- Entry (Org Admin): Organization Settings → AI Usage ("ai-usage")
	- Server: fetch paginated logs with filters and totals
	- Actions: filter, view detail, purge logs older than N days

- Entry (Superadmin): Admin → Organizations → [Org] → AI API Keys / AI Usage
	- Same flows, scoped to selected organization

---

## Screen 1: AI API Keys Management

Goal: Let org admins configure provider API keys and curated models. Keys are never shown in plaintext after save; verification occurs server-side.

```
+-----------------------------------------------------------------------------------+
| Settings / Organization / AI API Keys                                             |
+-----------------------------------------------------------------------------------+
| Provider        | Status        | Default Model        | Actions                  |
|-----------------------------------------------------------------------------------|
| OpenAI          | Verified ✓    | gpt-4o-mini          | [ Manage ]               |
| Google Gemini   | Missing       | —                    | [ Manage ]               |
| Anthropic       | Verified ✓    | claude-3-haiku       | [ Manage ]               |
+-----------------------------------------------------------------------------------+
```

Manage drawer/modal (per provider)

```
+------------------------------------------------------------+
| Manage: OpenAI                                             |
|------------------------------------------------------------|
| API Key                                                    |
| [ sk-************************************** ] [ Verify ]   |
|                                                            |
| Models (curated)                                           |
| [ Add Model ]                                              |
| --------------------------------------------------------   |
| | Name         | Label     | Max Out | Default |       |   |
| | gpt-4o-mini  | 4o Mini   | 2048    |  (•)    |       |   |
| | gpt-4o       | 4o        | 2048    |  ( )    |       |   |
| --------------------------------------------------------   |
| [ Set Default ]  [ Remove Model ]                          |
|                                                            |
| Save [ Update ]   Cancel                                   |
+------------------------------------------------------------+
```

Notes
- Verify triggers a server call using the provider adapter; on success, persist encryptedKey, lastVerifiedAt, and lastFour.
- Clamp Max Out to provider caps; curated model list reduces error risk.
- Prevent removing a default model without choosing a replacement.
- Show Sonner toasts for success/error; never display plaintext after save.

Edge cases
- Invalid key → show structured error; do not persist
- Rate limited → show retry messaging (429) with backoff
- Remove key → warn that dependent models become inactive

---

## Screen 2: AI Usage Logs Dashboard

Goal: Provide observability and retention for AI requests without exposing sensitive data. Admins only at org level; superadmins at admin level.

```
+-----------------------------------------------------------------------------------+
| Settings / Organization / AI Usage                                                |
+-----------------------------------------------------------------------------------+
| Filters: [ Provider v ] [ Model v ] [ Feature v ] [ Status v ] [ Date Range v ]   |
|          [ Search (correlation/text) ]                                            |
|-----------------------------------------------------------------------------------|
| Totals: Requests: 1,248 | In: 98,420 tok | Out: 122,311 tok | Avg Lat: 842 ms    |
|-----------------------------------------------------------------------------------|
| Correlation ID  | Time              | Prov | Model          | Feat  | St         |
|-----------------------------------------------------------------------------------|
| 7f6a…9b         | 2025-10-01 14:18  | OAI  | gpt-4o-mini    | gen   | OK         |
| 18cd…42         | 2025-10-01 13:57  | GEM  | gemini-1.5     | gen   | OK         |
| b2aa…77         | 2025-10-01 13:51  | ANT  | claude-3-haiku | gen   | ER         |
| ...                                                                             |
+-----------------------------------------------------------------------------------+
| [ Prev ] Page 1/42 [ Next ]   [ Purge older than (30) days ]  [ Go ]             |
+-----------------------------------------------------------------------------------+
```

Row detail inspector (drawer/modal)

```
+------------------------------------------------------------+
| Log: 7f6a…9b                                               |
|------------------------------------------------------------|
| Meta                                                       |
| Organization: acme                                         |
| User: user@example.com                                     |
| Provider: OpenAI   | Model: gpt-4o-mini                    |
| Feature: generic-text | Status: OK | Latency: 612 ms       |
| Tokens: in 132, out 289                                    |
| Correlation ID: 7f6a…9b                                    |
| Time: 2025-10-01 14:18:22                                  |
|------------------------------------------------------------|
| Input (sanitized & truncated)                              |
| "Write a two-sentence summary of…"                         |
|------------------------------------------------------------|
| Output (sanitized & truncated)                             |
| "Here are two sentences …"                                 |
|------------------------------------------------------------|
| Provider response meta (safe fields only)                  |
| httpStatus: 200 | modelVersion: 2025-09-30                 |
+------------------------------------------------------------+
```

Notes
- Search filters by correlationId and free-text across sanitized fields.
- Totals recompute per filter; pagination preserves filters.
- Purge action deletes logs older than N days; confirm before execution; toast on success.

Edge cases
- Large outputs → ensure truncation UI and copy-visible only
- Error entries → show errorCode and safe errorMessage
- Stream cancellations → status "canceled"; tokens may be partial; still record correlationId

---

## Components & Patterns

- shadcn/ui: Table, Dialog/Sheet, Input, Button, Badge, Select, Pagination, Tabs
- RHF + Zod for forms (API Keys modal)
- Sonner for toasts (success/error/info)
- Server-first pages with Node runtime API calls; CSRF validation on mutations
- Correlation ID visible and copyable from detail view

