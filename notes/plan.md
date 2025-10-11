We’ll implement a secure, server-first auth stack with email OTP (Resend) plus dev password in development, JWT access (≈1h) + refresh (≈14d) cookies with rotation, CSRF origin checks, rate limiting, allowlist enforcement, optional hCaptcha gating via env, and full audit logging. Protected routes are guarded by Edge middleware which cooperates with a Node refresh endpoint to keep sessions seamless. The dashboard shell will reuse your [sidebar.tsx] inside a resizable PanelGroup with mobile sheet, persisted per-user width/collapse, and a minimal profile menu. All DB work runs in Node runtime against your local Postgres.

What we’ll build

1. Dependencies and environment

- Install:
  - Runtime: @prisma/client, jose, bcrypt, resend, zod, @zxcvbn-ts/core, @zxcvbn-ts/language-common, @zxcvbn-ts/language-en
  - Dev: prisma, @types/bcrypt
- TS config: ensure "moduleResolution": "Bundler" (or "NodeNext"), "esModuleInterop": true.
- [.env.example] (placeholders only):
  - DATABASE_URL=postgresql://pi:password@localhost:5432/nextboilerplate
  - APP_URL=[http://localhost:3000]
  - JWT_SECRET=changeme_32+chars
  - JWT_ACCESS_COOKIE_NAME=\_\_access
  - JWT_REFRESH_COOKIE_NAME=\_\_session
  - ALLOWED_EMAILS= # you’ll fill this
  - RESEND_API_KEY=
  - RESEND_EMAIL_DOMAIN=
  - RESEND_FROM_EMAIL=[no-reply@example.com]
  - ENABLE_DEV_PASSWORD_SIGNIN=true
  - HCAPTCHA_ENABLED=false
  - HCAPTCHA_SITE_KEY=
  - HCAPTCHA_SECRET_KEY=
  - OTP_EXP_MINUTES=10
  - OTP_LENGTH=6
  - BCRYPT_ROUNDS=12

1. Prisma schema and DB

- Models:
  - User(id, email unique lowercase, name?, passwordHash?, emailVerifiedAt?, role default "user", sessionVersion int default 1, createdAt/updatedAt)
  - OtpToken(id, email lowercase, otpHash, expiresAt, consumedAt?, attempts default 0, createdAt)
  - OtpRequest(id, email, ip?, requestedAt)
  - AuditLog(id, action, userId?, email?, ip?, metadata Json?, createdAt)
- Enable pgvector once:
  - CREATE EXTENSION IF NOT EXISTS vector;
- Migrations and prisma generate; reuse a single Prisma client instance.

1. Server libraries (typed, functional)

- lib/jwt.ts (Node):
  - signAccessJwt({ sub, email, role, tokenVersion }, ~1h), signRefreshJwt({ sub, tokenVersion }, ~14d)
  - verifyAccessJwt, verifyRefreshJwt
  - setAccessCookie, setRefreshCookie, clearAuthCookies
  - Cookie flags: HttpOnly, Secure in prod, SameSite=Strict, Path=/; names from env.
- lib/jwt-edge.ts (Edge):
  - verifyAccessJwtSignatureOnly(token) for middleware (no DB).
- lib/csrf.ts:
  - isRequestOriginValid(req, APP_URL, ALLOWED_ORIGINS, dev localhost).
- lib/rate-limit.ts:
  - Enforce per-email (3/15m & 10/day) and per-IP (5/15m) via OtpRequest.
- lib/email.ts:
  - sendOtpEmail({ to, code, expiresAt }) via Resend.
- lib/auth.ts:
  - normalizeEmail; hashPassword/comparePassword; generateOtpCode/hashOtp; OTP verify/consume; JIT user upsert; audit(event, metadata).
- lib/auth-helpers.ts:
  - getCurrentUser(): access cookie → verify → load user → check sessionVersion.
  - refreshFromRefreshToken(req): verify refresh, compare sessionVersion, rotate cookies.
  - safeRedirect(next): allow only internal, else /dashboard.

1. API routes (Node runtime for DB touching)

- POST /api/auth/request-otp
  - CSRF; zod { email, next? }; allowlist; rate-limit; if HCAPTCHA_ENABLED and threshold hit → require/verify; single-active token (consume old); send email; audit; return { ok: true } or { ok: false, requiresCaptcha: true }.
- POST /api/auth/verify-otp
  - CSRF; zod { email, code, next? }; allowlist; find latest valid token; bcrypt compare; attempts increment/consume; JIT user upsert; issue access+refresh JWTs; set cookies; audit; return { ok: true, redirect }.
- POST /api/auth/dev-signin (dev only)
  - CSRF; zod { email, password, next? }; allowlist; bcrypt compare; set cookies; audit; 404 if disabled or not dev.
- POST /api/auth/signout
  - CSRF; clear cookies; audit if token valid; { ok: true }.
- POST /api/auth/profile/set-password
  - Auth; CSRF; zod { newPassword }; zxcvbn unless SKIP flag; hash; update; sessionVersion++; rotate cookies; audit password_set.
- POST /api/auth/profile/change-password
  - Auth; CSRF; zod { currentPassword, newPassword }; verify current; hash; sessionVersion++; rotate; audit success/failure.
- GET /api/auth/refresh
  - Verify refresh; check sessionVersion; rotate cookies; audit token_refresh; 302 to ?next= or 204 for XHR fetches.

1. Middleware (Edge) + refresh cooperation

- Public: /, /login, /api/auth/\*, /\_next, /favicon.ico, /assets.
- Protected: /dashboard, /settings.
- Behavior:
  - If valid access token → continue.
  - Else if refresh present → rewrite to /api/auth/refresh?next=<original>.
  - Else → redirect to /login?next=<original>.
- Security headers set centrally:
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: SAMEORIGIN
  - X-XSS-Protection: 1; mode=block
  - Referrer-Policy: strict-origin-when-cross-origin

1. Pages and layouts

- app/(public)/login/page.tsx:
  - Email OTP tab (default): Step A email (POST request-otp; conditionally shows hCaptcha when server requires and HCAPTCHA_ENABLED=true) → Step B 6-digit code (POST verify-otp → redirect).
  - Dev Password tab (render only in dev + env flag): email+password → POST dev-signin → redirect.
- [layout.tsx] (Server):
  - getCurrentUser(); fetch sections/pages; render `<DashboardShell userId userEmail sections pages>{children}</DashboardShell>`.
- app/(protected)/dashboard/page.tsx:
  - Example protected page content.
- app/(protected)/settings/profile/page.tsx:
  - Account info, set/change password forms, Sign out button.

1. Dashboard shell implementation

- components/features/dashboard/dashboard-shell.tsx (Client):
  - PanelGroup layout with resizable sidebar; Persist width/collapse in localStorage:
    - app.v1.sidebar.width:_userId_,_app_.*v*1._sidebar_._collapsed_:{userId}
      userId,app.v1.sidebar.collapsed:
  - Mobile: left Sheet for sidebar; closes on navigation.
  - Top bar: mobile menu button, spacer/title, right-side actions placeholder.
  - Shortcuts: Cmd/Ctrl+K, Cmd/Ctrl+Shift+N blocked in inputs.
  - Ensure pointer-events cleanup after menus open dialogs.
- [sidebar.tsx] (Client):
  - Build on [sidebar.tsx] primitives; two-level nav; active styles via usePathname; collapsed tooltips; profile menu (Profile, Sign out).

1. Security details (per rules_mini.md)

- CSRF origin checks; Zod validation for all inputs; rate limiting; audit logging.
- Cookie flags: HttpOnly; Secure (prod); SameSite=Strict; Path=/.
- JWT payloads: access = { sub, email, role, tokenVersion, exp ~1h }, refresh = { sub, tokenVersion, exp ~14d }.
- Session invalidation: compare tokenVersion with sessionVersion.

1. Manual QA (tests later)

- OTP flows (happy/invalid/expired), allowlist gate, CSRF rejection, cookie rotation (middleware rewrite path), unauthenticated redirect, password set/change (rotation + sessionVersion bump), sidebar persist/mobile sheet/profile signout, hCaptcha gating when enabled.
- Dev convenience: log OTP code to server logs in development only.
