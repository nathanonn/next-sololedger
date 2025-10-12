# AI Text Generation Integration (Reusable for Next.js Apps)

This guide documents a portable, provider‑agnostic pattern for integrating AI text generation using AI SDK v5 in a Next.js App Router app. It is designed to be copied into any project with minimal adaptation and follows server‑first, secure practices: per‑user BYOK (bring your own key), AES‑256‑GCM encryption at rest, CSRF and rate limits, structured errors, correlation IDs, and comprehensive usage logging with retention/purge.

Scope notes

- Focus: generic text generation and management screens; exclude editor‑specific “copilot/command” flows.
- Providers: OpenAI, Google Gemini, Anthropic (extensible).
- Models: manually managed per user; default model and clamps by provider caps.
- Runtime: Node.js only for anything using DB/secrets. Do not use Edge for DB.

## Baseline and Principles

- Next.js App Router + React + TypeScript (strict)
- AI SDK v5 (provider‑agnostic) – server‑side only
- Prisma/Postgres for persistence
- Tailwind + Radix/Shadcn for UI (optional)
- Security: JWT auth, CSRF allowlist, per‑user/IP rate limits, encrypted secret storage

Success criteria

- Per‑user API keys (BYOK) encrypted at rest; validated before saving
- Server routes perform text generation; no client secrets or AI calls
- Config resolution supports defaults and resource overrides
- Structured, queryable usage logs with sanitized/truncated raw bodies
- Correlation IDs propagate across request, logs, and responses

## Environment and Secrets

Required env (suggested names; adapt as needed)

- DATABASE_URL – Postgres connection
- APP_ENCRYPTION_KEY – base64‑encoded 32 bytes (256‑bit) for AES‑GCM
- CSRF_ALLOWED_ORIGINS – comma‑separated list for Origin/Referer checks
- AI_RATE_LIMIT_PER_MIN_USER – e.g., 30
- AI_RATE_LIMIT_PER_MIN_IP – e.g., 60

Notes

- Store provider keys per user in DB, encrypted via APP_ENCRYPTION_KEY.
- Prefer Secrets Manager/Direnv locally; never check keys into source control.

## Data Model (portable sketch)

Keep schema names generic so you can port them across apps. The following expresses the intent without prescribing every column.

- User – your app’s user
- AiApiKey – per‑user provider key (provider, encryptedKey, lastVerifiedAt, defaultModelId?)
- AiModel – a model configured under a user+provider (name, label, maxOutputTokens, apiKeyId)
- AiFeaturePreference – per‑user defaults per feature (feature, provider, modelId, maxOutputTokens)
- DocumentAiPreference – optional per‑resource override (resourceId, feature, provider, modelId, maxOutputTokens)
- AiGenerationLog – request logs (userId, provider, model, feature, status, tokensIn/out, latencyMs, correlationId, rawInput/OutputTruncated, createdAt)
- UserAiSettings – preferences like default retentionDays, logsPageSize

Tip: Use provider caps to clamp maxOutputTokens; see “Provider caps and clamping”.

## Encryption (AES‑256‑GCM, BYOK at rest)

Contract

- Input: plaintext provider key
- Output: ciphertext with nonce and auth tag, base64 encoded
- Key material: APP_ENCRYPTION_KEY must be a base64‑encoded 32‑byte buffer

Implementation notes

- Keep a small helper with versioned envelopes for future rotation: { v: 1, iv, ct, tag }.
- Decrypt only on server in Node runtime and only when needed.
- Validate decrypted keys by doing a minimal provider call (see “Verify API keys”).

## Provider Abstraction (OpenAI, Gemini, Anthropic)

Goal: Given (userId, provider), return a resolver bound to the decrypted API key and AI SDK model accessors.

Responsibilities

- Fetch AiApiKey by (userId, provider)
- Decrypt the key
- Instantiate the provider’s AI SDK client
- Return a simple factory to resolve models

Pseudocode outline

- getProviderInstance(userId, provider): { model(name: string): Model }
- verifyProviderApiKey(provider, keyPlain): throws on invalid key

Notes

- Use @ai-sdk/openai, @ai-sdk/google, and Anthropic adapter or HTTP client compatible with AI SDK v5. Keep this module server‑only.

## Provider Caps and Clamping

Maintain a tiny map per provider with safe maximums (output tokens, input tokens if needed). When computing effective maxOutputTokens for a request, clamp:

- effectiveMax = min(requestedMax, featureDefaultMax, modelMax, providerCapMax)

If the requested value exceeds caps, return a structured error (see next section) or silently clamp with a warning log, depending on your policy.

## Config Resolution and Typed Errors

Entry point: requireUserAiConfigForFeature(userId, feature, options?)

- Inputs
  - userId: string
  - feature: enum (e.g., ‘generic‑text’, ‘summary’, …)
  - options.resourceId?: string (resource override)
  - options.requestedMaxOutputTokens?: number
- Outputs
  - provider: ‘openai’ | ‘gemini’ | ‘anthropic’
  - model: { id, name, label, maxOutputTokens }
  - maxOutputTokens: number (clamped)

AiConfigError (structured)

- code: one of
  - AI_CONFIG_MISSING_API_KEY
  - AI_CONFIG_FEATURE_DISABLED
  - AI_CONFIG_MODEL_NOT_ALLOWED
  - AI_CONFIG_TOKEN_LIMIT_EXCEEDED
  - AI_CONFIG_PROVIDER_UNAVAILABLE
- message: human‑readable
- httpStatus: map to 400/403/422/429/503 as appropriate

## Verify API Keys (server‑only)

When saving or updating a user’s provider key, ping the provider with a minimal generation or “whoami” call. If it fails (4xx auth), reject and don’t store the key.

- OpenAI: small completion with a tiny prompt
- Gemini: small generateContent with a trivial input
- Anthropic: minimal Messages or Complete call

Attach lastVerifiedAt on success; refresh it periodically on use or via background job.

## Security Guardrails

- Runtime: export const runtime = "nodejs" for any route touching DB/secrets
- CSRF: Require Origin/Referer to match an allowlist on state‑changing routes (POST/PUT/PATCH/DELETE)
- AuthZ: Ensure the authenticated user owns any AiApiKey/AiModel they mutate/read
- Rate limits: per‑user and per‑IP (env configured); return 429 with Retry‑After
- No client‑side AI calls or secrets; everything flows through server endpoints

## Correlation IDs and Observability

- Ingest x‑correlation‑id from the request if present; otherwise generate one
- Include it in logs and echo in the response header
- Capture latency (start/finish timestamps) and token usage from provider responses

## Logging Design (AiGenerationLog)

Record for each request

- userId, provider, model, feature, status (ok|error|canceled)
- tokensIn, tokensOut (if available), latencyMs
- correlationId
- rawInputTruncated, rawOutputTruncated (sanitize PII/secrets; truncate e.g., 8–16 KB)
- errorCode/errorMessage on failure

Retention and purge

- Keep per‑user retentionDays (default in UserAiSettings)
- Provide an API to delete logs older than N days for a user

## HTTP Contracts (portable)

All examples assume JSON requests and responses, Node runtime, CSRF checks, and JWT authentication.

1. POST /api/ai/generate

- Purpose: generic text generation for a feature
- Request
  - headers: x‑correlation‑id? string
  - body: { feature: string; prompt: string; resourceId?: string; maxOutputTokens?: number; stream?: boolean }
- Response (non‑stream)
  - status: 200
  - headers: x‑correlation‑id
  - body: { text: string; provider: string; model: string; usage?: { inputTokens?: number; outputTokens?: number }; latencyMs: number }
- Response (stream)
  - text/event‑stream or streaming JSON with deltas; still echo x‑correlation‑id
- Errors: AiConfigError mapped to status; 429 for rate limit; 401/403 for auth/CSRF

2. GET /api/ai/models

- Purpose: list user’s configured models grouped by provider
- Response: { providers: Array<{ provider: string; models: Array<{ id; name; label; isDefault?: boolean; maxOutputTokens }> }> }

3. POST /api/ai/api‑keys

- Actions: upsert key for provider; verify before save; set default model; add/remove models
- Security: CSRF, ownership checks, rate limits
- Notes: encryptedKey at rest; never return plaintext

4. GET /api/ai/logs

- Filters: provider, model, feature, status, date range, correlationId, pagination
- Response: { items: AiGenerationLog[]; totals: { requests, tokensIn, tokensOut, avgLatencyMs } }

5. GET /api/ai/logs/:id

- Purpose: inspect a single log entry in detail (sanitized raw bodies)

6. DELETE /api/ai/logs/purge

- Purpose: delete logs older than retentionDays for the user
- Body: { retentionDays?: number } – if omitted, use user’s default

7. POST /api/ai/feature‑preferences and /api/ai/document‑preferences

- Purpose: set per‑user feature defaults and per‑resource overrides
- Behavior: clamp maxOutputTokens to provider caps; validate ownership and model membership

## Server Wrappers around AI SDK v5

Wrap the SDK to centralize logging, correlation IDs, and sanitization.

- generateTextWithLogging(params)
  - Inputs: { userId, feature, provider, modelName, prompt, maxOutputTokens?, correlationId? }
  - Behavior: log start → call AI SDK generate → log finish; on error, log error and rethrow
- streamTextWithLogging(params)
  - Same but streaming; push events and record final summary when stream ends/cancels

Pseudocode sketch

- Resolve config via requireUserAiConfigForFeature
- Get provider instance and model
- Build AI SDK call (e.g., generateText({ model, prompt, maxTokens }))
- Record usage/latency from SDK response
- Return structured result and echo x‑correlation‑id

## Rate Limiting

- Per‑user and per‑IP buckets; throttle POST /api/ai/\* routes
- Propagate 429 with a Retry‑After header
- Expose limit metadata optionally in a response header for observability

## Error Handling Strategy

- Throw AiConfigError for configuration issues; map to 4xx
- For provider/network failures, map to 5xx and capture provider error type/code
- Never leak provider API keys in errors or logs

## Minimal End‑to‑End Flow

1. User saves provider key on /settings/api‑keys
   - Server verifies by tiny AI call; on success, encrypt+store and set lastVerifiedAt
2. User adds one or more models for that provider and sets a default
3. App calls POST /api/ai/generate with feature+prompt (+resourceId?)
   - Server resolves effective config and clamps tokens
   - AI SDK is invoked with decrypted key and model
   - Logs record input/output, usage, and latency with correlationId
4. User views /settings/usage to filter logs and totals; optionally purges old logs

## Checklist (copy into your project)

- [ ] APP_ENCRYPTION_KEY set (base64 32 bytes); CSRF_ALLOWED_ORIGINS configured
- [ ] DB tables for AiApiKey, AiModel, AiFeaturePreference, DocumentAiPreference, AiGenerationLog, UserAiSettings
- [ ] Provider abstraction implemented for OpenAI, Gemini, Anthropic
- [ ] Key verification on save; no secrets in client
- [ ] Feature/default and resource overrides; token clamping
- [ ] POST /api/ai/generate with logging wrappers and correlation IDs
- [ ] GET /api/ai/models, /api/ai/logs, /api/ai/logs/:id, DELETE /api/ai/logs/purge
- [ ] Rate limits per user/IP; CSRF checks; ownership validation

## Notes and Tips

- Start with manual model entries; you can later auto‑discover provider models if needed
- Keep log truncation generous enough for debugging but safe (e.g., 8–16 KB per side)
- If you add streaming, ensure partials are not over‑logged; record a compact transcript
- Consider a maintenance job to enforce retention and re‑verify stale keys periodically

---

This document is intentionally generic and mirrors robust patterns (BYOK, logging, CSRF, rate limits, structured errors) so you can adopt it in any Next.js App Router codebase using AI SDK v5.
