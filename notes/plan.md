# Organization-wide AI Integration Plan

This plan adds organization-scoped AI configuration and usage to the app. Organization admins (and superadmins) can manage provider API keys and models in a secure, server-only setup using the Vercel AI SDK. All AI generation requests run on the server with org-wide rate limits and CSRF/auth guards. Usage is logged per-organization with correlation IDs, token usage, and latency, with retention/purge controls. Two new settings tabs—AI API Keys and AI Usage—will be available under organization settings (and mirrored in admin org pages) to manage providers and inspect activity.

---

## Decisions (confirmed)

- Providers: OpenAI, Google Gemini, Anthropic
- Who can generate: all organization members (when org has a configured key)
- Streaming: yes (alongside non-stream)
- Retention: default 30 days (org-customizable by admin/superadmin)
- Model UX: curated per-provider whitelist; clamping to provider caps
- Rate limits: 60/min per org, 120/min per IP (env tunable)
- Logs access: organization admins see all org logs (members do not see the Usage tab)
- Tabs/labels: "AI API Keys" at segment "ai-keys" and "AI Usage" at segment "ai-usage"
- Key verification: always verify before saving; reject invalid keys
- Keys: one key per provider per org (update to rotate)
- Token accounting: record provider-reported usage when available; otherwise null; always capture latency
- Feature namespace: start with "generic-text"
- Feature flag: AI_FEATURES_ENABLED to gate endpoints/UI
- Superadmin: can manage keys and view logs for all organizations

---

## Data model (Prisma)

Add the following models. Use string literal unions in TypeScript for providers.

1. OrganizationAiApiKey

- id (cuid)
- organizationId (FK → Organization.id)
- provider: "openai" | "gemini" | "anthropic"
- encryptedKey: string (AES-256-GCM envelope, base64-encoded)
- lastFour: string (last 4 chars of plaintext key for display)
- lastVerifiedAt: Date
- createdByUserId: string (FK → User.id)
- updatedByUserId: string (FK → User.id)
- createdAt: Date (default now)
- updatedAt: Date (updatedAt)
- Unique: (organizationId, provider)
- Indexes: (organizationId, provider), (organizationId, updatedAt)

2. OrganizationAiModel

- id (cuid)
- organizationId (FK)
- provider: same union as above
- name: string (e.g., "gpt-4o-mini")
- label: string (display label)
- maxOutputTokens: number
- isDefault: boolean (only one default per provider/org)
- apiKeyId: string (FK → OrganizationAiApiKey.id)
- Unique: (organizationId, provider, name)
- Invariant: at most one isDefault=true per (organizationId, provider)

3. AiGenerationLog

- id (cuid)
- organizationId (FK)
- userId (FK)
- provider: string
- model: string
- feature: string (e.g., "generic-text")
- status: "ok" | "error" | "canceled"
- tokensIn?: number
- tokensOut?: number
- latencyMs: number
- correlationId: string
- rawInputTruncated: string (sanitized + truncated)
- rawOutputTruncated: string (sanitized + truncated)
- errorCode?: string
- errorMessage?: string
- createdAt: Date (default now)
- Indexes: (organizationId, createdAt), (organizationId, provider, model, createdAt), (organizationId, correlationId)

4. OrganizationAiSettings

- id (cuid)
- organizationId (FK)
- retentionDays: number (default 30)
- perMinuteLimit?: number (nullable; override env)
- createdAt / updatedAt

Migration notes

- Maintain onDelete: Cascade for org-linked tables.
- Enforce single-default invariant via application logic (and optional DB constraint if supported).

---

## Environment & encryption

Env additions (to `lib/env.ts` and `.env.example`)

- APP_ENCRYPTION_KEY: base64-encoded 32 bytes (AES-256-GCM)
- AI_RATE_LIMIT_PER_MIN_ORG: default "60"
- AI_RATE_LIMIT_PER_MIN_IP: default "120"
- AI_ALLOWED_PROVIDERS: "openai,gemini,anthropic" (optional)
- AI_FEATURES_ENABLED: "true" | "false"

Encryption helper (`lib/secrets.ts`)

- encryptSecret(plaintext: string): string
- decryptSecret(ciphertext: string): string
- Envelope format: { v: 1, iv, ct, tag } base64 fields
- Validate that APP_ENCRYPTION_KEY decodes to 32 bytes on module init.

---

## Provider abstraction & caps

`lib/ai/providers.ts` (server-only, Node runtime)

- getOrgProviderClient(orgId, provider):
  - Fetch OrganizationAiApiKey by (orgId, provider); decrypt key
  - Return a handle exposing model(name) compatible with AI SDK v5
- verifyApiKey(provider, keyPlain):
  - OpenAI, Gemini, Anthropic: tiny generation/whoami call; throw on 4xx auth failure
- providerCaps: per-provider safe maximums for output tokens; used in clamping

Curated models

- Maintain a small curated list per provider (id, label, safe maxOutputTokens)
- Allow org admins to pick from this list; free-text model names intentionally disabled for v1

---

## Config resolution & wrappers

`lib/ai/config.ts`

- requireOrgAiConfigForFeature({ orgId, feature, requestedMaxOutputTokens?, modelName? }) →
  - Resolve provider (must have verified key), default model, and clamp tokens by min(requested, model, provider cap)
  - Throws AiConfigError with codes:
    - AI_CONFIG_MISSING_API_KEY
    - AI_CONFIG_MODEL_NOT_ALLOWED
    - AI_CONFIG_TOKEN_LIMIT_EXCEEDED
    - AI_CONFIG_PROVIDER_UNAVAILABLE

`lib/ai/generate.ts`

- generateTextWithLogging and streamTextWithLogging
  - Inputs: { orgId, userId, feature, prompt, modelName?, maxOutputTokens?, correlationId? }
  - Behavior: log start → AI SDK call → log finish; on error, log error + code → rethrow
  - Sanitization: redact secrets, truncate inputs/outputs to ~8–16KB
  - Always record latency; record tokens when provider returns usage

---

## API routes (Node runtime, CSRF, authZ)

Base path: `/app/api/orgs/[orgSlug]/ai/`

1. keys (GET/POST/DELETE)

- GET: list providers with status (Verified/Missing) and default model
- POST: upsert key for provider
  - Verify key via tiny call → encrypt+store → lastVerifiedAt; audit log
- DELETE: remove key/provider (must handle dependent models)

2. models (GET/POST/DELETE/PATCH)

- GET: list org models grouped by provider
- POST: add a curated model; clamp and validate
- PATCH: set default model for provider (flip isDefault)
- DELETE: remove model (guard if it is default—require selecting another default first)

3. generate (POST)

- Accepts: { feature, prompt, modelName?, maxOutputTokens?, stream?, correlationId? }
- Rate limits: per org and per IP
- Calls wrapper; returns x-correlation-id header; supports non-stream and stream
- Authorization: any org member; logs userId + orgId

4. logs (GET list, GET detail, DELETE purge)

- GET: filters (provider, model, feature, status, date range, search), pagination, totals (requests, tokens in/out, avg latency)
- GET /logs/[id]: full sanitized record
- DELETE /logs/purge: deletes logs older than retentionDays (from OrganizationAiSettings or request body)

Security & runtime

- `export const runtime = "nodejs"` for all routes
- CSRF: `validateCsrf` for mutating routes (POST/PATCH/DELETE)
- AuthZ: `requireAdminOrSuperadmin` for keys/models/logs mutations and views; generate allowed for members

---

## Authorization & rate limiting

Authorization

- Org admins: manage keys, models, and view all org logs
- Org members: can call generate (no keys/models/logs management)
- Superadmins: full management across all organizations

Rate limiting

- Implement per-org (60/min) and per-IP (120/min) buckets
- Return 429 with Retry-After; expose optional limit headers for observability
- Allow per-org override via OrganizationAiSettings.perMinuteLimit

---

## UI: tabs and screens

Tabs

- Extend `OrganizationTabs` to include:
  - AI API Keys → `ai-keys`
  - AI Usage → `ai-usage`

Org-level pages

- `/o/[orgSlug]/settings/organization/(tabs)/ai-keys/page.tsx`
- `/o/[orgSlug]/settings/organization/(tabs)/ai-usage/page.tsx`

Admin pages (reuse components)

- `/admin/organizations/[orgSlug]/(tabs)/ai-keys/page.tsx`
- `/admin/organizations/[orgSlug]/(tabs)/ai-usage/page.tsx`

AI API Keys screen

- Provider table with status badge (Verified/Missing), default model, Manage button
- Manage modal per provider: masked key input, Verify, Save; curated models table; set default; remove model

AI Usage screen

- Filters: provider, model, feature, status, date range, search (correlationId/text)
- Totals: requests, tokens in/out, avg latency
- Paginated table; row detail drawer; purge control

---

## Testing

Unit

- `lib/secrets.ts`: encrypt/decrypt round-trips, error on bad key length
- Provider verification success/fail (mock AI SDK)
- Config clamping logic

API

- keys/models: verify/save/delete, default switching, invariants
- generate: non-stream + stream; CSRF; rate limit; error propagation; correlationId
- logs: list filters, totals, detail, purge; permissions

E2E (Playwright)

- Superadmin manages a target org (keys/models/logs)
- Org admin configures keys/models, triggers generation, inspects logs
- Org member triggers generation (no tab access)

---

## Rollout & docs

- Add AI_FEATURES_ENABLED to gate routes and UI
- Update README and `.env.example` for new env vars
- Optional seed to populate demo models and sample logs (no secrets)

---

## Acceptance criteria

- Org-scoped encrypted keys per provider (single active key) with verification
- Org member generation (stream + non-stream), server-only AI SDK usage
- Structured logs with correlation IDs, token usage, latency, sanitized bodies
- Admin-only tabs for AI Keys and AI Usage; superadmin across all orgs
- Retention/purge default 30 days, org/IP rate limits (60/120) with env overrides
