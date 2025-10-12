# AI Features UX Flow and Wireframes

This document provides a reusable UX flow map and ASCII wireframes for two admin/user screens that support the AI integration:

- API Keys management (per‑user BYOK across providers)
- Usage Logs dashboard (filters, totals, raw inspector, purge)

It aligns with the implementation notes in `ai_features.md` and is portable to any Next.js App Router app.

## Flow map

- Entry: Settings → API Keys
  - Authenticate user → fetch current per‑provider key state and models
  - Actions: add/update/delete API key; verify on save; manage models; select default model

- Entry: Settings → Usage
  - Authenticate user → fetch paginated logs with filters and totals
  - Actions: filter by provider/model/feature/status/date; open detail; purge old logs

## Screen 1: API Keys Management

Goal: Let the user configure provider API keys and models. Keys are never shown in plaintext after save; verification occurs server‑side.

+-----------------------------------------------------------------------------------+
| Settings / API Keys |
+-----------------------------------------------------------------------------------+
| Provider | Status | Default Model | Actions |
|-----------------------------------------------------------------------------------|
| OpenAI | Verified ✓ | gpt-4o-mini | [Manage] |
| Google Gemini | Missing | — | [Manage] |
| Anthropic | Verified ✓ | claude-3-haiku | [Manage] |
+-----------------------------------------------------------------------------------+

Manage drawer/modal (per provider)

+------------------------------------------------------------+
| Manage: OpenAI |
|------------------------------------------------------------|
| API Key |
| [ sk-************************************** ] [ Verify ] |
| |
| Models |
| [ Add Model ] |
| ------------------------------------------------------ |
| | Name | Label | Max Out | Default | |
| | gpt-4o-mini | 4o Mini | 2048 | (•) | |
| | gpt-4o | 4o | 2048 | ( ) | |
| ------------------------------------------------------ |
| [ Set Default ] [ Remove Model ] |
| |
| Save [ Update ] Cancel |
+------------------------------------------------------------+

Notes

- Verify triggers a server call that pings the provider with a minimal generation.
- If Verify passes, persist encryptedKey and update lastVerifiedAt.
- Set Default marks one model as default for the provider; clamp Max Out to provider caps.
- Never show plaintext after initial entry; mask input on subsequent visits.

Edge cases

- Invalid key → show structured error; do not persist
- Rate limited → show retry UI with backoff messaging
- Model removal when selected as default → force user to pick another default first

## Screen 2: Usage Logs Dashboard

Goal: Provide observability and retention for AI requests without exposing sensitive data.

+-----------------------------------------------------------------------------------+
| Settings / Usage |
+-----------------------------------------------------------------------------------+
| Filters: [Provider v] [Model v] [Feature v] [Status v] [ Date Range v ] [ Search ] |
|------------------------------------------------------------------------------------|
| Totals: Requests: 1,248 | In: 98,420 tok | Out: 122,311 tok | Avg Lat: 842 ms |
|------------------------------------------------------------------------------------|
| Correlation ID | Time | Prov | Model | Feat | St |
|------------------------------------------------------------------------------------|
| 7f6a…9b | 2025-10-01 14:18 | OAI | gpt-4o-mini | gen | OK |
| 18cd…42 | 2025-10-01 13:57 | GEM | gemini-1.5 | sum | OK |
| b2aa…77 | 2025-10-01 13:51 | ANT | claude-3-h | gen | ER |
| ... |
+------------------------------------------------------------------------------------+
| [ Prev ] Page 1/42 [ Next ] [ Purge older than (30) days ] [Go] |
+------------------------------------------------------------------------------------+

Row detail inspector (drawer/modal)

+------------------------------------------------------------+
| Log: 7f6a…9b |
|------------------------------------------------------------|
| Meta |
| User: user@example.com |
| Provider: OpenAI | Model: gpt-4o-mini |
| Feature: generic-text | Status: OK | Latency: 612 ms |
| Tokens: in 132, out 289 |
| Correlation ID: 7f6a…9b |
| Time: 2025-10-01 14:18:22 |
|------------------------------------------------------------|
| Input (sanitized & truncated) |
| "Write a two-sentence summary of…" |
|------------------------------------------------------------|
| Output (sanitized & truncated) |
| "Here are two sentences …" |
|------------------------------------------------------------|
| Provider response meta (optional, safe fields only) |
| httpStatus: 200 | modelVersion: 2025-09-30 |
+------------------------------------------------------------+

Notes

- Search box filters by correlationId and free‑text across sanitized fields.
- Totals recompute per filter; pagination preserves filters.
- Purge action deletes logs older than N days (user‑scoped), confirming before execution.

Edge cases

- Large outputs → ensure truncation UI with a “copy visible” button only
- Error entries → show errorCode and errorMessage, plus provider error type if safe
- Canceled streams → status ‘canceled’, tokens may be partial; still record correlationId

## Interaction and Security Notes

- All mutations require CSRF‑validated requests with Origin/Referer checks
- Ownership enforced on all read/mutate endpoints
- Rate limiting applied to verify/save/purge operations
- Correlation ID echoed in responses and visible in the UI (copy button)

## Checklist (for implementation)

- [ ] API Keys table with per‑provider rows and Manage modal per provider
- [ ] Verify flow with server ping and error surfacing
- [ ] Models table with add/remove and default selection; caps clamping
- [ ] Usage logs data grid with filters, totals, pagination
- [ ] Row detail inspector with sanitized/truncated input/output
- [ ] Purge by retention days with confirmation and success feedback
- [ ] CSRF + rate limits; correlation ID shown and copyable

---

These wireframes intentionally avoid editor‑specific UX. They cover the minimal management and observability surfaces needed to safely operate AI text generation in any app.
