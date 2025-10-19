Here’s a focused implementation plan to support organization‑wide AI provider keys, org‑scoped usage logging, and admin/superadmin management. We’ll add Prisma models for encrypted org keys and model allowlists, Node‑runtime API routes that resolve org configuration and call the Vercel AI SDK server‑side (with SSE streaming), and UIs under each organization for admins plus a “My AI Usage” view for members (linked from the user menu). Superadmins will manage/view an org’s AI from an “AI” tab on Admin → Organizations → [org].

**Prisma Models**

- OrganizationAiProviderKey (one key per org+provider)
  - Columns: id, organizationId, provider ("openai" | "gemini" | "anthropic"), keyEnvelope JSON { v, iv, ct, tag }, lastVerifiedAt, createdById, createdAt, updatedAt.
  - Constraints: unique(organizationId,provider). Indexes: (organizationId,provider), (organizationId,lastVerifiedAt).
- OrganizationAiModel (org allowlist for models)
  - Columns: id, organizationId, provider, name, label, maxOutputTokens, isDefault boolean, createdById, timestamps.
  - Constraints: unique(organizationId,provider,name); partial unique one isDefault=true per (organizationId,provider).
- OrgAiFeaturePreference (org feature defaults; initial feature: "generic-text")
  - Columns: id, organizationId, feature, provider, modelId?, maxOutputTokens?.
  - Constraints: unique(organizationId,feature).
- AiGenerationLog (org‑scoped usage)
  - Columns: id, organizationId, userId, provider, model, feature, status ("ok" | "error" | "canceled"), tokensIn?, tokensOut?, latencyMs, correlationId, rawInputTruncated, rawOutputTruncated, errorCode?, errorMessage?, createdAt.
  - Indexes: (organizationId,createdAt desc), (organizationId,provider,model), (correlationId).
- AiRequestEvent (rate limit ledger; lightweight)
  - Columns: id, organizationId, userId, ip, createdAt.
  - Indexes: (userId,createdAt), (ip,createdAt), (organizationId,createdAt).

**Environment & Config**

- Add env to .env.example and validate in :
  lib/env.ts
  - APP_ENCRYPTION_KEY (base64, 32‑byte) for AES‑GCM.
  - AI_RL_PER_USER_PER_MIN=30, AI_RL_PER_IP_PER_MIN=60.
  - AI_LOG_TRUNCATE_MAX_BYTES=8192.
- Provider caps map in code (safe token limits per provider).
- No client exposure; Node runtime only.

**Server Libraries (Node‑only)**

- lib/crypto-secrets.ts
  - encryptSecret(plaintext) → envelope, decryptSecret(envelope) → plaintext (AES‑256‑GCM, versioned envelopes).
- lib/ai-providers.ts
  - getOrgProviderClient(orgId, provider) → loads key, decrypts, returns AI SDK client + model(name) helper.
  - verifyProviderApiKey(provider, keyPlain) → minimal call per provider to confirm validity.
- lib/ai-config.ts
  - requireOrgAiConfigForFeature(orgId, feature, opts?) → resolve provider/model/defaults, clamp maxOutputTokens, throw AiConfigError (AI*CONFIG*\*).
- lib/ai-logging.ts
  - startLog(meta) → logId; finishLog(logId, result|error); sanitize + truncate to AI_LOG_TRUNCATE_MAX_BYTES; store tokens/latency/correlationId.
- lib/ai-rate-limit.ts
  - checkAndRecord(orgId, userId, ip) enforcing 30/min per user & 60/min per IP; returns 429 + Retry‑After when exceeded.

**API Routes (Node runtime; CSRF + AuthZ + Rate Limits)**

- Base: /api/orgs/[orgSlug]/ai
- Providers
  - GET /providers/status → [{ provider, verified, lastVerifiedAt, defaultModel? }]; AuthZ: admin or superadmin.
  - POST /providers/verify → { provider, apiKey }; verify only; RL small (5/min/user).
  - POST /providers/upsert → verify then encrypt+persist; update lastVerifiedAt; AuditLog: ai_provider_upsert.
  - DELETE /providers/:provider → remove key + cascade unset defaults/models for that provider; AuditLog: ai_provider_delete.
- Models
  - GET /models → grouped by provider [{ id, name, label, maxOutputTokens, isDefault }]; AuthZ: admin/superadmin.
  - POST /models → add/update { provider, name, label?, maxOutputTokens } with clamping; AuditLog: ai_model_add.
  - POST /models/set-default → { provider, modelId } ensure single default; AuditLog: ai_model_set_default.
  - DELETE /models/:id → guard if default (require reselection); AuditLog: ai_model_remove.
- Generate (streaming and non‑stream)
  - POST /generate → { feature, prompt, resourceId?, maxOutputTokens?, stream?: boolean, correlationId? }.
  - Behavior: getCurrentUserAndOrg(path) → ai-rate-limit.checkAndRecord → requireOrgAiConfigForFeature → startLog → AI SDK call → finishLog → return; headers echo x-correlation-id.
  - AuthZ: any org member (12/a).
  - Streaming (17/a): SSE (text/event-stream) events: token, usage, error, done.
- Logs
  - GET /logs → filters { provider, model, feature, status, date range, correlationId, search }, pagination + totals { requests, tokensIn, tokensOut, avgLatencyMs }. AuthZ: admin/superadmin.
  - GET /logs/:id → sanitized detail view. AuthZ: admin/superadmin.
  - DELETE /logs/purge → { retentionDays? } (default 60 days per org; 16/b). AuditLog: ai_logs_purge.

**Admin Integration (3/b)**

- Under /admin/organizations/[orgSlug] add an “AI” tab:
  - Providers sub‑section: same provider status/verify/upsert/delete UI; superadmin has full manage rights (21/a).
  - Usage sub‑section: logs table with same filters/totals for that org.
  - Reuse org‑scoped APIs; superadmin bypasses membership requirement.

**UI In Organization**

- New settings section: /o/[orgSlug]/settings/ai
  - providers page:
    - Table: Provider, Status, Default Model, Actions [Manage].
    - Manage dialog: masked key input field (never re‑shown), Verify button, Models table (Add/Remove, Set Default), clamped maxOutputTokens. Toasts via Sonner; CSRF on mutations.
  - usage page (admin‑only):
    - Filters: Provider, Model, Feature, Status, Date Range, Search (correlationId/text).
    - Totals bar; paginated table; row detail drawer (sanitized input/output); “Purge older than N days” with confirm.
- Member “My Usage” (20/b)
  - Route: /o/[orgSlug]/ai/my-usage (outside settings so members can access).
  - Shows only the current user’s logs (filter by userId), same filters minus org‑wide actions; no purge.
  - Add menu link in DashboardShell user menu: “My AI Usage” → /o/${currentOrg.slug}/ai/my-usage.

**Provider Verification & Defaults**

- Providers supported at launch (1/a): OpenAI, Google Gemini, Anthropic.
- Verification (11/a): verify on save; re‑verify on use if lastVerifiedAt > 7 days (soft failure → return config error if invalid).
- No fallback when missing key (4/a): generation returns AI_CONFIG_MISSING_API_KEY with guidance link to Providers.
- Default provider per org must be explicitly set (14/a) via models/default; no implicit Gemini default.

**Security & Compliance**

- Node runtime for all AI routes; never Edge for DB/secrets.
- CSRF: Origin/Referer allowlist via existing  on state‑changing routes.
  lib/csrf.ts
- AuthZ: reuse requireAdminOrSuperadmin for manage/logs; membership for generate; superadmin bypass membership.
- Rate limits (9/a): 30/min per user, 60/min per IP; include Retry-After.
- Logging redaction (19/a): basic patterns (emails, URLs, obvious secrets, long numeric IDs); truncate to 8 KB fields; never store API keys.

**DX Notes (Files To Add/Touch; not editing now)**

- Prisma:  new models + indexes, migration.
  prisma/schema.prisma
- Env: .env.example,  schema additions.
  lib/env.ts
- Lib: , , , , .
  lib/crypto-secrets.ts
  lib/ai-providers.ts
  lib/ai-config.ts
  lib/ai-logging.ts
  lib/ai-rate-limit.ts
- API: app/api/orgs/[orgSlug]/ai/providers/_, .../models/_, , .../logs/\*.
  .../generate/route.ts
- UI: , , ; add user‑menu link in components/features/dashboard/\*.
  app/o/[orgSlug]/settings/ai/providers/page.tsx
  .../usage/page.tsx
  app/o/[orgSlug]/ai/my-usage/page.tsx
- Admin: add “AI” tab content under app/admin/organizations/[orgSlug]/\*.

**Testing Plan**

- Unit: crypto envelopes (roundtrip), provider verification adapters (mock SDK), config clamping, redaction+truncation, correlation ID propagation.
- API: providers upsert/verify/delete (CSRF/AuthZ/RL), models add/remove/default, generate (JSON+SSE; RL; logs written), logs filtering/purge.
- UI: providers manage flow, models default guard, usage filters and pagination, my‑usage visibility from user menu.
- Perf: index scans on logs by (organizationId,createdAt) and (organizationId,provider,model).

**Rollout Steps**

- Add env vars; npx prisma generate → npx prisma migrate dev --name org_ai_features.
- Seed optional OrgAiFeaturePreference for "generic-text" with no defaults selected (admin must choose).
- Deploy; superadmin validates Admin → Organizations → [org] → AI.
- Org admins add provider keys, add models, choose defaults; verify generation (JSON & SSE).
- Monitor logs and rate limits; tune caps/limits as needed.
