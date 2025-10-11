How this app implements **email OTP authentication** (primary) with **Resend**, an **allowlist of emails**, **dev-only password sign-in** (behind strict toggles), JWT sessions in **HTTP-only cookies**, CSRF origin checks, and a **profile page** to set/change passwords.

## 0) Dependencies & Installation

### Runtime Dependencies

- ✅ `@prisma/client@latest` — Database ORM client
- ✅ `bcrypt@latest` — Password hashing
- ✅ `jose@latest` — JWT signing/verification (ESM)
- ✅ `resend@latest` — Email sending
- ✅ `zod@latest` — Schema validation
- ✅ `@zxcvbn-ts/core@latest` — Password strength checker
- ✅ `@zxcvbn-ts/language-common@latest` — Password dictionary
- ✅ `@zxcvbn-ts/language-en@latest` — English language support
  Note: We currently render email HTML/text inline (no `@react-email/render` used).

### Dev Dependencies

- ✅ `prisma@latest` — DB migrations & codegen
- ✅ `@types/bcrypt@latest` — TypeScript types for bcrypt

### Install commands (choose your package manager)

```bash
# npm
npm i @prisma/client bcrypt jose resend zod @zxcvbn-ts/core @zxcvbn-ts/language-common @zxcvbn-ts/language-en
npm i -D prisma @types/bcrypt
```

### Post-install checklist

- Run Prisma client generation after any schema change:

  ```bash
  npx prisma generate
  ```

  (Recommended `package.json` snippet)

  ```json
  {
    "scripts": {
      "postinstall": "prisma generate"
    }
  }
  ```

- TypeScript config: ensure compatibility for bcrypt types and ESM libs:
  - `"esModuleInterop": true`
  - `"moduleResolution": "Bundler"` (or `"NodeNext"`) to play nicely with `jose` (ESM)

- Node toolchain for `bcrypt`: native module build may require platform build tools (ensure a standard Node toolchain is available in CI and local dev).

---

## 1. Environment & Config

**Required env vars**

- `RESEND_API_KEY`, `RESEND_EMAIL_DOMAIN`, `RESEND_FROM_EMAIL`
- `ALLOWED_EMAILS` (comma-separated exact emails; normalized lowercase compare)
- `ENABLE_DEV_PASSWORD_SIGNIN` (`"true"` enables dev password sign-in; requires NODE_ENV=development)
- `JWT_SECRET` (≥32 chars), `JWT_COOKIE_NAME` (default `__session`)
- `APP_URL` (used for CSRF origin allowlist)
- `HCAPTCHA_SITE_KEY`, `HCAPTCHA_SECRET_KEY` (optional; enables CAPTCHA gating during high-frequency OTP requests)
- `ALLOWED_ORIGINS` (optional, comma-separated hostnames or URLs for additional allowed origins in CSRF checks)
- **Tunables:** `OTP_EXP_MINUTES` (default 10), `OTP_LENGTH` (min 4, max 8, default 6), `BCRYPT_ROUNDS` (min 10, max 15, default 12)

Dev-only helper:

- `SKIP_PASSWORD_VALIDATION` (`"true"` in development to bypass strength checks in set-password route only; not applied to change-password)

**Guards & defaults**

- Dev password sign-in only if `NODE_ENV === 'development'` and `ENABLE_DEV_PASSWORD_SIGNIN === "true"`.
- Cookie: `httpOnly`, `secure` in production, `sameSite="strict"`, `path="/"`, `maxAge=14d`.
- JWT: HS256; claims `{ sub, email, role, tokenVersion }`, expiry **14 days**.

---

## 2. Database Model (Prisma / Postgres)

**User**: `id`, `email (unique)`, `name?`, `passwordHash?`, `emailVerifiedAt?`, `role` (default `"user"`), `sessionVersion` (default 1), timestamps
**OtpToken**: `id`, `email`, `otpHash (bcrypt)`, `expiresAt`, `consumedAt?`, `attempts` (default 0), `createdAt`
**OtpRequest**: `id`, `email`, `ip?`, `requestedAt`
**AuditLog**: `id`, `action`, `userId?`, `email?`, `ip?`, `metadata?`, `createdAt`

---

## 3. Allowed Emails Gate

Checked before OTP issuance and dev password sign-in. Exact match against `ALLOWED_EMAILS` (normalized lowercase). Endpoints return generic responses to avoid enumeration.

---

## 4. OTP Policy

Numeric code (`OTP_LENGTH`, default 6), **expires in `OTP_EXP_MINUTES`** (default 10), stored as **bcrypt hash**. Single active token per email: requesting a new OTP consumes existing unconsumed tokens. Verification consumes the token on success. Failed attempts increment `attempts`; at ≥5 attempts, the token is consumed/invalidated.

Rate limits (enforced via `OtpRequest`):

- Per email: 3 per 15 minutes, 10 per 24 hours
- Per IP: 5 per 15 minutes

CAPTCHA gating (if `HCAPTCHA_*` configured): after ≥2 requests in 15 minutes for either the email or IP, server requires an hCaptcha token. When missing/invalid, endpoint responds with `{ ok: false, requiresCaptcha: true }`. The current UI does not display hCaptcha yet; plan to pass `hcaptchaToken` to `/api/auth/request-otp`.

---

## 5. Email Sending (Resend)

Sends from `RESEND_FROM_EMAIL`, subject includes the code. Both HTML and plain-text bodies include the code and expiry.

---

## 6. Route Handlers (API Endpoints)

- `POST /api/auth/request-otp` → CSRF origin check; validate; allowlist gate; rate-limit + optional hCaptcha; single-active OTP; send email; audit `otp_request`. Returns generic success message.
- `POST /api/auth/verify-otp` → CSRF origin check; validate; allowlist gate; verify latest unconsumed, unexpired OTP; consume on success; JIT user upsert (verifies email); issue JWT; audit success/failure. Redirect: uses `next` if internal, else `/dashboard`.
- `POST /api/auth/dev-signin` (dev-only) → returns 404 unless dev and flag enabled; CSRF check; validate; allowlist gate; bcrypt compare; issue JWT; audit success/failure.
- `POST /api/auth/signout` → CSRF check; clear cookie always; when token valid, audit `signout` with decoded claims.
- `POST /api/auth/profile/set-password` → CSRF check; auth required; optional dev-only `SKIP_PASSWORD_VALIDATION`; bcrypt hash; increment `sessionVersion` and rotate JWT; audit `password_set`.
- `POST /api/auth/profile/change-password` → CSRF check; auth required; verify current password; bcrypt new; increment `sessionVersion` and rotate JWT; audit success/failure.

Bodies validated with **Zod**; UI uses `fetch` with JSON.

CSRF protection: All routes call `isRequestOriginValid` which validates Origin/Referer against `APP_URL` and optional `ALLOWED_ORIGINS`.

---

## 7. JWT Sessions

HS256 with `JWT_SECRET`; cookie name from `JWT_COOKIE_NAME`; expiry 14 days; cookie flags: `HttpOnly`, `Secure` (prod), `SameSite=Strict`, `Path=/`.

Payload: `{ sub, email, role, tokenVersion }`.

Global invalidation: `tokenVersion` is compared to `User.sessionVersion` in server helpers. Password set/change increments `sessionVersion`, and affected routes rotate the JWT immediately.

---

## 8. Middleware Protection

`middleware.ts` (Edge) protects `/dashboard` and `/settings`. Public allowlist includes `/`, `/login`, `/api/auth/*`, `/_next`, `/favicon.ico`, `/assets`. Middleware verifies the JWT signature using `jwt-edge.ts`; it does not check DB `sessionVersion` (Edge cannot access DB). Deeper checks occur in protected server pages via `getCurrentUser()`.

---

## 9. UI Pages & Flows

- `/login`: Email OTP (default) + Dev Password tab (renders only when `NODE_ENV=development` and `ENABLE_DEV_PASSWORD_SIGNIN=true`). Shadcn + Zod forms. UI currently does not integrate hCaptcha; plan to add and pass `hcaptchaToken` to `/api/auth/request-otp` when server indicates `requiresCaptcha`.
- `/login`: Email OTP (default) + Dev Password tab (renders only when `NODE_ENV=development` and `ENABLE_DEV_PASSWORD_SIGNIN=true`). Shadcn + Zod forms.
  - hCaptcha UI notes: On submitting the email, if the API responds with `{ ok: false, requiresCaptcha: true }`, render an hCaptcha widget and collect a client token. Re-submit `POST /api/auth/request-otp` including `{ hcaptchaToken }`. If the API responds `{ ok: false, requiresCaptcha: true, error: "Invalid captcha" }`, keep the widget visible and allow retry. Pass the site key from the server (e.g., as a prop from the server page) using `HCAPTCHA_SITE_KEY`. Never expose `HCAPTCHA_SECRET_KEY` to the client.
- `/settings/profile`: Set password (if none) or Change password (if exists). Include “Sign out” button.

---

## 10. Password Policy & Security

Passwords: min 8 chars and must meet zxcvbn strength (score ≥ 3) on the server (`lib/validators.ts`). In development, `SKIP_PASSWORD_VALIDATION=true` bypasses this in the set-password route.

Hashing: `bcrypt` with `BCRYPT_ROUNDS` (default 12).

Other: emails normalized; generic errors to avoid enumeration; audit key events (see below).

---

## 11. Testing Checklist

OTP flows (happy/edge), allowlist gate, dev sign-in guards + 404 when disabled, CSRF rejections on bad origins, JWT set/clear and rotation on password set/change, middleware redirects and Edge limitation, profile flows (set/change), audit logging, email deliverability, hCaptcha gating behavior, rate limits.

---

## 12. File & Route Map (descriptive)

- `app/(public)/login/page.tsx`
- `app/(protected)/dashboard/page.tsx`
- `app/(protected)/settings/profile/page.tsx`
- `app/api/auth/request-otp/route.ts`
- `app/api/auth/verify-otp/route.ts`
- `app/api/auth/dev-signin/route.ts`
- `app/api/auth/signout/route.ts`
- `app/api/auth/profile/set-password/route.ts`
- `app/api/auth/profile/change-password/route.ts`
- `middleware.ts`
- `lib/jwt.ts`, `lib/jwt-edge.ts`, `lib/email.ts`, `lib/rate-limit.ts`, `lib/csrf.ts`, `lib/auth.ts`, `lib/auth-helpers.ts`
- `db/schema/*` — `User`, `OtpToken` (+ optional `OtpRequest`)

---

## CSRF Protection

The server validates the request Origin/Referer against an allowlist derived from `APP_URL`, common localhost variants (in development), and optional `ALLOWED_ORIGINS`. All auth routes reject when the origin is not allowed.

## Audit Logging

## hCaptcha UI integration (notes)

Minimal client flow for the OTP email step:

1. User enters email and submits.
2. Call `POST /api/auth/request-otp` with `{ email, next? }`.

- If response is `200 { ok: true }`: advance to the code entry step.
- If response is `400 { ok: false, requiresCaptcha: true }`: display hCaptcha and collect a token.

3. With a token, call `POST /api/auth/request-otp` again including `{ email, next?, hcaptchaToken }`.

- If success: advance to the code entry step.
- If `requiresCaptcha: true` persists with error: keep widget visible, show an error, let the user retry.

Implementation notes:

- Render the widget only when the server indicates `requiresCaptcha` to reduce friction for typical flows.
- Pass the public site key to the client via the login server page props; do not reference env directly in a client bundle.
- Reset/expire the widget token on reattempts if needed (per hCaptcha library docs).
- Keep responses generic in the UI, consistent with server behavior.

Auth endpoints write entries to `AuditLog` with action, user/email, IP, and optional metadata. Events include: `otp_request`, `otp_verify_success`, `otp_verify_failure` (reasons: `no_valid_token`, `invalid_code`, attempts count), `dev_signin_success`, `dev_signin_failure` (reasons: `email_not_allowed`, `user_not_found_or_no_password`, `invalid_password`), `password_set`, `password_change_success`, `password_change_failure` (reason: `invalid_current_password`), and `signout`.

---
