## Org AI features — UX flow and ASCII wireframes

This document maps the UX for organization‑scoped AI configuration, usage logging, and admin/superadmin management. It aligns with the implementation plan in `notes/plan.md` and follows the repo guardrails (Next.js App Router, Tailwind v4 + shadcn/ui, Node runtime for AI routes, CSRF, JWT, Sonner toasts).

### Roles and access

- Superadmin: Manage any organization’s AI (providers, models, defaults, logs, purge). Bypasses membership.
- Org admin: Manage own org’s AI (providers, models, defaults, logs, purge).
- Org member: Can generate via org defaults and view “My AI Usage” for their own logs only.

### Primary routes

- Admin
  - /admin/organizations/[orgSlug]/ai
    - Providers: status/verify/upsert/delete
    - Usage: filterable logs, totals, row detail, purge
- Organization settings (admins)
  - /o/[orgSlug]/settings/ai/providers
  - /o/[orgSlug]/settings/ai/usage
- Member usage
  - /o/[orgSlug]/ai/my-usage
- API (Node runtime only)
  - /api/orgs/[orgSlug]/ai/providers/\*
  - /api/orgs/[orgSlug]/ai/models/\*
  - /api/orgs/[orgSlug]/ai/generate
  - /api/orgs/[orgSlug]/ai/logs/\*

---

## Navigation map (ASCII)

```
Top Nav (app)
 ├─ Dashboard
 ├─ Organizations (admin only)
 │   └─ [Org Name]
 │       ├─ Overview | Users | Billing | AI
 │       │                       ├─ Providers
 │       │                       └─ Usage
 └─ Current Org (/o/[orgSlug])
		 ├─ Dashboard
		 ├─ Settings
		 │   └─ AI
		 │       ├─ Providers (/o/[orgSlug]/settings/ai/providers)
		 │       └─ Usage     (/o/[orgSlug]/settings/ai/usage)
		 └─ AI
				 └─ My Usage (/o/[orgSlug]/ai/my-usage)

User Menu (DashboardShell)
 └─ My AI Usage → /o/${currentOrg.slug}/ai/my-usage
```

---

## Flow overview

1. Provider key management

- Open Providers → Manage provider → Verify key → Upsert/save → Optionally add models → Set default model

2. Model allowlist and defaults

- Add model (provider/name/label/max tokens) → Clamp to provider caps → List appears → Set default (one per provider per org)

3. Generation

- Member action in app (feature = "generic-text" initially) → API /generate resolves org config → AI SDK call (SSE optional) → Log usage → Response/stream to client

4. Usage visibility and hygiene

- Admins: Org Usage page with filters, totals, pagination, purge dialog
- Members: My AI Usage (self‑scoped), no purge

5. Safety rails

- CSRF on mutations; RL 30/min user, 60/min IP; redaction + truncation of logs; never expose API keys client‑side; Node runtime only

---

## Screen wireframes (ASCII)

### Admin → Organizations → [org] → AI

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [Org Name]                                                    [Org Menu]  │
│ Tabs: Overview | Users | Billing | AI [active]                            │
├───────────────────────────────────────────────────────────────────────────┤
│ AI                                                                       │
│ ┌ Providers ────────────────────────────────────────────────────────────┐ │
│ │ Provider  Status       Last Verified     Default Model     Actions    │ │
│ │ ──────────────────────────────────────────────────────────────────── │ │
│ │ OpenAI    Not set      —                  —               [Manage]    │ │
│ │ Gemini    Verified     2025‑10‑18 12:12   gemini-1.5-pro  [Manage]    │ │
│ │ Anthropic Invalid key  2025‑10‑01 09:01   —               [Manage]    │ │
│ │                                                                   ⓘ   │ │
│ │ [i] Keys are encrypted (AES‑GCM). Keys are never shown after save.   │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│ ┌ Usage ─────────────────────────────────────────────────────────────────┐ │
│ │ Filters: Provider [All▼]  Model [All▼]  Feature [All▼]  Status [All▼]  │ │
│ │          Date [▼]  Search (correlationId/text) [        ] (🔍)         │ │
│ │ Totals: Requests 1,284 | Tokens In 45,311 | Tokens Out 93,770          │ │
│ │ Avg Latency 1.2s                                                       │ │
│ │ ───────────────────────────────────────────────────────────────────── │ │
│ │ Time         Provider  Model             Feature        Status  Latency│ │
│ │ 12:12:31     Gemini    gemini-1.5-pro    generic-text   ok      1.1s  │ │
│ │ 12:11:54     OpenAI    gpt-4o-mini       generic-text   error   0.3s  │ │
│ │ 12:10:02     Anthropic claude-3-5-sonnet generic-text   ok      1.7s  │ │
│ │ …                                                                     │ │
│ │ [Prev]  1  2  3  …  [Next]                        [Purge…]             │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘
```

Row click opens Log Detail Drawer (see below). Purge opens a confirmation dialog.

Empty state: Providers table shows helpful callout “No keys configured. Click Manage to add a key.” Usage shows “No logs yet.”

---

### Org Settings → AI → Providers (/o/[orgSlug]/settings/ai/providers)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Settings: [Org Name]                                         [Back ▸]    │
│ Sidebar: Profile | Members | AI [active]                                 │
├───────────────────────────────────────────────────────────────────────────┤
│ AI Providers                                                              │
│ Manage provider API keys and allowed models for this organization.        │
│                                                                           │
│ Provider  Status       Default Model     Actions                           │
│ ────────────────────────────────────────────────────────────────────────   │
│ OpenAI    Not set      —                 [Manage]                          │
│ Gemini    Verified     gemini-1.5-pro    [Manage]                          │
│ Anthropic Invalid key  —                 [Manage]                          │
│                                                                           │
│ [!] A default model must be selected per provider before use.             │
└───────────────────────────────────────────────────────────────────────────┘
```

Manage opens the Provider Manage Dialog.

---

### Provider Manage Dialog (from Providers tables)

```
┌──────────────── Manage: Gemini ───────────────────────────────────────────┐
│ API Key                                                                  │
│ [ ******************************** ]  (never shown after save)           │
│ Buttons: [Verify]  [Save & Verify]  [Delete Provider]                    │
│ Status: ✔ Verified at 2025‑10‑18 12:12
│        ✖ Invalid (last attempt 2025‑10‑01)                                │
│                                                                          │
│ Models Allowlist                                                         │
│  Name               Label         Max Tokens   Default   Actions          │
│  ────────────────────────────────────────────────────────────────────    │
│  gemini-1.5-pro     Pro           2048         ●         [Set Default]   │
│  gemini-1.5-flash    Flash         1024         ○         [Set Default]   │
│                                                                          │
│ + Add Model                                                              │
│   Provider: Gemini (fixed)                                               │
│   Model Name [ gemini-1.5-flash ]   Label [ Flash ]                      │
│   Max Output Tokens [ 2048 ] (clamped to provider cap)                   │
│   [Add / Update]                                                         │
│                                                                          │
│ Footer: [Close]                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

Behaviors

- Verify: POST /providers/verify { provider, apiKey } → toast ok/error
- Save & Verify: POST /providers/upsert { provider, apiKey } → re‑list with status → toast
- Delete Provider: DELETE /providers/:provider → clears models/defaults; confirm dialog → toast
- Set Default: POST /models/set-default { provider, modelId } → only one default
- Add/Update Model: POST /models { provider, name, label?, maxOutputTokens } → clamped → toast
- Remove Model: DELETE /models/:id (guard if default → require reselection)

Empty states

- No key: top section shows warning banner: “No API key configured. Add key to enable models.”
- No models: models table shows “No models added. Add at least one and set default.”

---

### Org Settings → AI → Usage (/o/[orgSlug]/settings/ai/usage)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Settings: [Org Name] → AI → Usage                                        │
├───────────────────────────────────────────────────────────────────────────┤
│ Filters: Provider [All▼]  Model [All▼]  Feature [All▼]  Status [All▼]    │
│          Date Range [Last 7d▼]   Search [                ] (🔍)          │
│ Totals: Requests 1,284 | Tokens In 45,311 | Tokens Out 93,770 | Avg 1.2s │
│ ──────────────────────────────────────────────────────────────────────── │
│ Time           User              Provider  Model           Feature Status │
│ 2025‑10‑18…    alex@…           Gemini    gemini‑1.5‑pro  gen‑text ok     │
│ 2025‑10‑18…    mei@…            OpenAI    gpt‑4o‑mini     gen‑text error  │
│ …                                                                         │
│ [Prev]  1  2  3  …  [Next]                        [Purge older than…]    │
└───────────────────────────────────────────────────────────────────────────┘
```

Row click opens Log Detail Drawer. “Purge older than…” opens Purge Dialog.

---

### Member → My AI Usage (/o/[orgSlug]/ai/my-usage)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ My AI Usage (Org: [Org Name])                                            │
├───────────────────────────────────────────────────────────────────────────┤
│ Filters: Provider [All▼]  Model [All▼]  Feature [All▼]  Status [All▼]    │
│          Date Range [Last 7d▼]   Search [                ] (🔍)          │
│ Totals: Requests 42 | Tokens In 1,211 | Tokens Out 4,550 | Avg 1.0s      │
│ ──────────────────────────────────────────────────────────────────────── │
│ Time           Provider  Model             Feature     Status  Latency    │
│ 2025‑10‑18…    Gemini    gemini‑1.5‑pro    gen‑text    ok      1.1s      │
│ …                                                                         │
│ [Prev]  1  2  3  …  [Next]                                               │
└───────────────────────────────────────────────────────────────────────────┘
```

No purge button. Only the current user’s rows are shown.

---

### Log Detail Drawer (from Admin/Settings/My Usage tables)

```
┌──────────────────────────────── Log #AIG‑12345 (right drawer) ────────────┐
│ Summary                                                                   │
│ • When: 2025‑10‑18 12:12:31                                               │
│ • User: alex@example.com (id: …)                                          │
│ • Provider/Model: Gemini / gemini‑1.5‑pro                                 │
│ • Feature: generic‑text       • Status: ok       • Latency: 1.1s          │
│ • Tokens: in=134 out=276                                                     │
│ • Correlation ID: 9d4c…                                                     │
│                                                                             │
│ Input (sanitized, truncated)                                               │
│ ┌───────────────────────────────────────────────────────────────────────┐ │
│ | “Summarize this meeting transcript: …”                                | │
│ └───────────────────────────────────────────────────────────────────────┘ │
│ Output (sanitized, truncated)                                              │
│ ┌───────────────────────────────────────────────────────────────────────┐ │
│ | “Here’s a concise summary: …”                                         | │
│ └───────────────────────────────────────────────────────────────────────┘ │
│ Error (if any)                                                             │
│  code: AI_CONFIG_MISSING_API_KEY  message: “Gemini key missing for org.”  │
│                                                                             │
│ [Close]                                                                    │
└───────────────────────────────────────────────────────────────────────────┘
```

---

### Purge Logs Dialog

```
┌────────────── Purge Logs ───────────────┐
│ Remove logs older than [ 60 ] days.     │
│ This action is irreversible.            │
│                                         │
│ [Cancel]                 [Purge]        │
└──────────────────────────────────────────┘
```

---

## Key flows (sequence diagrams)

### A) Upsert provider key

```
User(Admin) → UI: Open Manage (Gemini)
UI → API: POST /providers/verify { provider, apiKey }
API → UI: 200 { verified: true }
UI: Enable Save
UI → API: POST /providers/upsert { provider, apiKey }
API: encrypt key, store, lastVerifiedAt=now, audit
API → UI: 200 { ok: true }
UI: toast.success("Gemini key saved")
```

Errors

- 400 invalid key → toast.error(“Invalid API key”)
- 429 (verify RL) → toast.error with Retry‑After

### B) Add model and set default

```
UI → API: POST /models { provider, name, label?, maxOutputTokens }
API: clamp tokens per provider cap; create/update; audit
API → UI: 200 { model }
UI: toast.success("Model added")
UI → API: POST /models/set-default { provider, modelId }
API: ensure single default per (org, provider); audit
API → UI: 200 { ok: true }
UI: toast.success("Default set")
```

Guard: DELETE /models/:id fails if default → prompt to reassign default first.

### C) Generate (SSE)

```
Client(Member) → API: POST /generate { feature, prompt, stream: true }
API: checkAndRecord RL; resolve config; startLog; call AI; stream SSE
SSE events: token, usage, error, done (echo x-correlation-id)
API: finishLog(tokens, latency, status)
Client: render streamed tokens; handle usage and done; show error toast if any
```

SSE event examples

- event: token data: { text: "…chunk…" }
- event: usage data: { tokensIn: 123, tokensOut: 456 }
- event: error data: { code: "AI_CONFIG_MISSING_API_KEY", message: "…" }
- event: done data: { ok: true }

Rate limit

- 429 Too Many Requests with Retry‑After seconds header; UI shows toast and suggests retry.

---

## States and edge cases

- Missing provider key → generation fails with AI_CONFIG_MISSING_API_KEY; link to Providers page.
- Stale verification (>7 days) → soft re‑verify on use; if invalid, return config error.
- No default model for provider → generation fails with AI_CONFIG_MISSING_DEFAULT_MODEL.
- Model tokens exceed provider cap → clamp in API; show info tooltip in UI.
- Logs redaction → emails, URLs, long IDs; truncate to AI_LOG_TRUNCATE_MAX_BYTES; never store API keys.
- CSRF required on state changes; Origin/Referer enforced.
- Edge runtime is never used for AI/DB; only Node runtime.

---

## UI notes and patterns

- Dialog from dropdown/context menu requires pointer events restore on close:
  See pattern in repo’s AGENTS.md “Critical UI Patterns → Dialog from Dropdown/ContextMenu”.
- Toasts via Sonner:
  - Success: toast.success("Saved successfully")
  - Error: toast.error("Failed to save")
- Select values: never empty string; use semantic value like "none" and map to null in logic.
- Provider API key input is masked and never re‑displayed after save.
- Pagination: standard page size (e.g., 25); show Prev/Next and numeric page links.
- Accessibility: buttons have discernible labels; dialogs trap focus; tables have header scope.

---

## Acceptance checklist (UX)

- Providers table shows status, lastVerifiedAt, default model, actions.
- Manage dialog supports: verify, save & verify, delete provider, add model, set default, remove model.
- Usage pages: filters, totals, paginated table, row detail drawer, purge dialog (admin only).
- My AI Usage shows only current user’s logs with same filters, no purge.
- Error and empty states are explicit and actionable.
- Streaming generation UI can handle token/usage/error/done SSE events.
