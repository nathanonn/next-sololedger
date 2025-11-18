MCP-Ready Personal API Keys – Implementation Plan

This plan introduces a secure personal API key feature that plugs into the existing JWT auth system with minimal changes. Users will create org-scoped keys from a user-level "API Access" screen. The MCP server will use these keys to obtain short-lived JWT access tokens via a dedicated exchange endpoint, then call existing APIs with full CRUD capabilities. Keys are stored hashed, identifiable via a short prefix, and include metadata (org, scopes, expiry). API-key-issued tokens will be tagged with `auth_method: "api_key"` and subject to stricter rate limiting on the exchange endpoint.

---

## 1. Data model & Prisma changes

1.1 **Add `ApiKey` model**

- Add a new model in `prisma/schema.prisma`:
  - `id` (cuid/uuid)
  - `userId` (FK → `User`)
  - `organizationId` (FK → `Organization`)
  - `name` (string, for human-readable label)
  - `prefix` (string, e.g. first 6–8 chars of key, unique per user or globally)
  - `secretHash` (string, hashed API key)
  - `scopes` (string[] or json, but we will initially use “full user parity” and keep this ready for MCP-specific uses)
  - `expiresAt` (nullable `DateTime`)
  - `lastUsedAt` (nullable `DateTime`)
  - `createdAt`, `updatedAt`
  - `revokedAt` (nullable `DateTime`)
- Ensure appropriate indexes:
  - `@@index([userId])`
  - `@@index([organizationId])`
  - `@@index([prefix])`
- Migration: - Add new migration with `npx prisma migrate dev`.

  1.2 **Optionally extend `AuditLog`**

- If you have an `AuditLog` model:
  - Ensure it can store events like `"api_key_created"`, `"api_key_revoked"`, `"api_key_exchanged"`.
  - Add optional `apiKeyId` or a generic `meta` JSON field if not already present.

---

## 2. API key generation & storage helpers

2.1 **Create `lib/api-keys.ts`**

- Implement helper functions: - `generateApiKey(): { fullKey: string; prefix: string }` - Generate a long random key (e.g. 32–40 bytes, base58/base32/hex, with `slk_` prefix). - Extract `prefix` from the first N chars after `slk_`. - `hashApiKey(fullKey: string): string` - Use a strong password hashing function (e.g. `bcrypt` with existing bcrypt setup) or `scrypt/argon2` as appropriate. - `createApiKey(userId, organizationId, name, scopes, expiresAt?): Promise<{ apiKey: ApiKey; fullKey: string }>` - Generate key + prefix. - Hash key. - Create `ApiKey` row with `secretHash`, `prefix`, etc. - `findActiveApiKeyByFullKey(fullKey: string): Promise<ApiKey | null>` - Derive prefix from full key. - Lookup by prefix, then verify `secretHash` (bcrypt compare). - Check `revokedAt === null` and `expiresAt` is either null or in the future. - `revokeApiKey(apiKeyId: string): Promise<void>` - Set `revokedAt` and maybe `lastUsedAt`. - `updateApiKeyScopesAndExpiry(apiKeyId, scopes, expiresAt): Promise<ApiKey>` - `listApiKeysForUser(userId: string, organizationId?: string): Promise<ApiKey[]>` - Return metadata only (never secret).

  2.2 **Integrate with audit logging**

- In each helper (`createApiKey`, `revokeApiKey`, `updateApiKeyScopesAndExpiry`, and exchanges later), emit an audit log entry using existing helpers.

---

## 3. JWT integration for API key exchanges

3.1 **Extend JWT payload types**

- In `lib/jwt.ts` and/or `lib/auth.ts`: - Extend the JWT payload type to optionally include: - `auth_method: "password" | "otp" | "api_key"` (or at least `"api_key"` vs default). - `apiKeyId?: string` (for traceability if needed). - Ensure token generation helpers accept an options object that can set `auth_method` and `apiKeyId`.

  3.2 **Add helper to create JWT from `ApiKey`**

- In `lib/auth-helpers.ts` or `lib/auth.ts`: - Add a function: - `createAccessTokenFromApiKey(apiKey: ApiKey, user: User): Promise<string>` - Construct payload with: - user identifier (consistent with existing access tokens). - org id (from `apiKey.organizationId`). - `auth_method: "api_key"`. - `apiKeyId: apiKey.id`. - Use existing JWT signing helper (and TTL consistent with access tokens, or optionally shorter for api_key tokens). - Decide whether to also issue a refresh token for API keys: - To minimize complexity, v1 can issue access token only and let MCP re-exchange periodically.

  3.3 **Ensure existing `getCurrentUser`/auth helpers accept `auth_method`**

- Review `lib/auth.ts` / any `getCurrentUser` helpers:
  - Ensure they dont break if `auth_method` is `"api_key"`.
  - Optionally log/auth differentiate if necessary.

---

## 4. API routes: management & exchange endpoints

4.1 **Management endpoint base: `app/api/auth/api-keys`**

- Add Node runtime export: `export const runtime = "nodejs"`.
- Implement RESTful handlers using existing patterns:

      **a. `GET /api/auth/api-keys`**
      - Authenticated via existing cookie-based auth middleware.
      - Optionally accept `orgSlug` if user is in multiple orgs.
      - Returns list of API keys (metadata only):
      	- `id`, `name`, `prefix`, `createdAt`, `lastUsedAt`, `expiresAt`, `revokedAt`, `organizationId`.

      **b. `POST /api/auth/api-keys`**
      - Authenticated via cookies.
      - Body: `{ name: string; organizationId or orgSlug; scopes?: string[]; expiresAt?: string }`.
      - Validate org membership.
      - Use `createApiKey` helper.
      - Respond with API key metadata + `fullKey` once.
      - Emit audit log: `"api_key_created"`.

      **c. `POST /api/auth/api-keys/:id/revoke`**
      - Authenticated via cookies.
      - Verify the key belongs to current user (and org).
      - Call `revokeApiKey`.
      - Audit log: `"api_key_revoked"`.

      **d. `PATCH /api/auth/api-keys/:id`**
      - Authenticated.
      - Allows updating `name`, `scopes`, `expiresAt`.
      - Audit log: `"api_key_updated"`.

  4.2 **Exchange endpoint: `POST /api/auth/api-key/exchange`**

- New route with `runtime = "nodejs"`.
- Request:
  - Header: `Authorization: ApiKey <fullKey>`.
- Steps: - Parse and validate header. - Use `findActiveApiKeyByFullKey` to retrieve `ApiKey`. - Load associated `User` and `Organization`. - Verify user and org are active; key not revoked/expired. - Create access token via `createAccessTokenFromApiKey(apiKey, user)`. - Optionally update `apiKey.lastUsedAt = now`. - Response: `{ accessToken: string, expiresIn: number, tokenType: "Bearer" }`. - Audit log: `"api_key_exchanged"`.

  4.3 **Rate limiting on exchange endpoint**

- Use existing `lib/rate-limit.ts` utilities:
  - Implement per-IP or per-prefix limit (e.g. 510 exchanges/min).
  - Use a separate bucket key like `"api_key_exchange"`.

---

## 5. Auth & middleware considerations

5.1 **HTTP Authorization support (Bearer)**

- Ensure existing API routes accept `Authorization: Bearer <accessToken>` in addition to cookies: - If not supported, add a shared helper `getAuthFromRequest(request)` that checks cookies first, then Bearer header.

  5.2 **Authorization logic unchanged**

- Keep per-endpoint authorization unchanged: - Use existing user/org membership and roles. - API-key-issued tokens simply populate the same user + org context.

  5.3 **Optional constraints for `auth_method = "api_key"`**

- Plan for later:
  - Sensitive endpoints (e.g. password change, OTP management) can reject/limit `auth_method: "api_key"`.

---

## 6. UX: "API Access" page for personal keys

6.1 **Route & shell integration**

- Under a user-level area (e.g. account/settings), add a new page:
  - Example: `app/(public)/account/api-access/page.tsx` or equivalent.
- Add navigation link: "API Access" or "Personal API Keys".

  6.2 **UI features**

- Use existing `shadcn/ui` + Tailwind patterns: - List of existing API keys: - Name, prefix, org, scopes, status (active / expired / revoked), created/last used. - Actions: - Create new key (form: `name`, org selector, optional expiry). - Revoke key. - Edit key (name, scopes, expiry). - After key creation: - Show full key once in a copyable input with a warning: "This key is shown only once. Store it securely."

  6.3 **Org selection UX**

- If user has multiple orgs:
  - Show dropdown listing orgs they belong to.
  - On keys list, show org column or group by org.
- If user has a single org:
  - Auto-select and hide selector.

---

## 7. Logging & audit behavior

7.1 **Audit key lifecycle**

- For each lifecycle action: - `createApiKey` → `"api_key_created"`. - `revokeApiKey` → `"api_key_revoked"`. - `updateApiKeyScopesAndExpiry` → `"api_key_updated"`. - exchange endpoint → `"api_key_exchanged"` with IP and user agent if available.

  7.2 **Tag downstream actions**

- If you log per-request actions, include `auth_method` and optionally `apiKeyId` or `viaApiKey` in metadata.

---

## 8. Security hardening

8.1 **Key generation & hashing**

- Use `crypto.randomBytes` for secure randomness (≥ 32 bytes).
- Hash with the same secure algorithm used for passwords (e.g. bcrypt with adequate cost).

  8.2 **Secret handling in logs**

- Never log the full API key or `secretHash`.
- Only log `id`, `prefix`, and metadata.

  8.3 **Expiry & revocation**

- Enforce expiry checks in `findActiveApiKeyByFullKey`.
- Ensure revoked keys can no longer be exchanged.

  8.4 **Access token TTL**

- Use existing access token TTL (short-lived).
- MCP re-exchanges as needed when tokens expire.

---

## 9. Testing strategy

9.1 **Automated tests (if test setup exists)**

- Tests for `lib/api-keys.ts`:
  - Key generation: uniqueness, prefix, hash validation.
  - `findActiveApiKeyByFullKey`: valid key, revoked, expired, wrong secret.
- Tests for exchange endpoint: - Valid API key → returns `accessToken` with `auth_method: "api_key"`. - Revoked/expired keys → 401/403. - Rate limit behavior.

  9.2 **Manual flows**

- Flow 1: create key for Org A via UI, exchange with `curl`, then call an existing endpoint with returned Bearer token.
- Flow 2: revoke key; verify exchange and subsequent access fail.
- Flow 3: create key with test expiry and ensure it is considered invalid.

---

## 10. Minimal MCP integration notes (for later)

- MCP server configuration per user/org:
  - API base URL.
  - Personal API key string.
- MCP workflow:
  - On startup or token expiry: call `/api/auth/api-key/exchange`.
  - Use `Authorization: Bearer <accessToken>` for all existing CRUD endpoints.
