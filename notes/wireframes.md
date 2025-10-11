# UX Flow Map and ASCII Wireframes (Auth + Dashboard Shell)

This document turns the plan into a concrete UX flow map and screen-by-screen ASCII wireframes. It covers the email OTP login (with optional dev password), protected routing with access/refresh cookies, and the reusable dashboard shell using the existing sidebar component inside a resizable PanelGroup. Use this as the single source of truth for page content and interaction states.

---

## Flow map

- Entry: `/login`

  - Tab: Email OTP (default)
    - Step A: Enter email → POST `/api/auth/request-otp`
      - 200 { ok: true } → proceed to Step B (enter code)
      - 400 { ok: false, requiresCaptcha: true } AND `HCAPTCHA_ENABLED=true` → render hCaptcha, resubmit with `hcaptchaToken`
    - Step B: Enter code → POST `/api/auth/verify-otp`
      - 200 { ok: true, redirect } → `router.replace(redirect)` (internal or `/dashboard`)
      - 400 { error } → show error; allow retry (token consumed after 5 attempts)
  - Tab: Password (Dev only)
    - Visible when `NODE_ENV=development` and `ENABLE_DEV_PASSWORD_SIGNIN=true`
    - Enter email + password → POST `/api/auth/dev-signin`
      - 200 { ok: true, redirect } → `/dashboard`
      - 404 when disabled; 401 on invalid; allowlist enforced

- Protected area: `/dashboard`, `/settings/*`

  - Edge middleware checks access JWT (signature only)
    - If valid → continue
    - Else if refresh cookie present → rewrite to `/api/auth/refresh?next=...` (Node runtime rotates tokens); continue
    - Else → redirect to `/login?next=...`
  - Server layout (`app/(protected)/layout.tsx`) validates session via `getCurrentUser()` (compares tokenVersion to DB `sessionVersion`), fetches `sections` and `pages`, and renders the client `DashboardShell`.

- Profile: `/settings/profile`
  - Set Password (if none) → POST `/api/auth/profile/set-password` (zxcvbn unless SKIP flag); increments `sessionVersion`; rotates cookies
  - Change Password → POST `/api/auth/profile/change-password`; verifies current; increments `sessionVersion`; rotates cookies
  - Sign Out → POST `/api/auth/signout` → navigate to `/login`

Notes

- CSRF: All auth endpoints validate Origin/Referer against `APP_URL` (+ dev localhost variants and optional `ALLOWED_ORIGINS`).
- Allowlist: All entry points enforce `ALLOWED_EMAILS` (comma-separated, lowercase). Until you fill it, OTP and dev sign-in are blocked.
- Cookies: Access (~1h) + Refresh (~14d), HttpOnly, `SameSite=Strict`, `Secure` in prod, names from env: `JWT_ACCESS_COOKIE_NAME` and `JWT_REFRESH_COOKIE_NAME`.
- Dev DX: OTP code is logged to server console in development only.

---

## Screens (ASCII)

### 1) Login: Email OTP (Step A — Enter email)

+-------------------------------------------+
| Welcome Back |
| Sign in to your account |
| |
| [ Tabs ] [ Email OTP ] [ Password (Dev) ]
| |
| Email |
| [ you@example.com_______________________ ]|
| |
| [ Send verification code ] |
| |
| Tip: If your email is allowed, |
| you'll receive a 6-digit code. |
+-------------------------------------------+

States

- Loading: button shows "Sending..."
- Success (200 ok): advance to Step B
- If `{ requiresCaptcha: true }` AND `HCAPTCHA_ENABLED=true`: show hCaptcha (see 1b)

### 1b) Login: Email OTP (Step A with hCaptcha)

+-------------------------------------------+
| Welcome Back |
| Sign in to your account |
| |
| [ Tabs ] [ Email OTP ] [ Password (Dev) ]
| |
| Email |
| [ you@example.com_______________________ ]|
| |
| hCaptcha |
| [ Widget (site key) ] |
| |
| [ Verify and send code ] |
| |
| Error (if any): |
| "Captcha verification required/failed" |
+-------------------------------------------+

Behavior

- Render the widget only when the server signals `requiresCaptcha`
- Resubmit `/api/auth/request-otp` including `{ hcaptchaToken }`
- Keep the widget visible if server still requires captcha

### 2) Login: Email OTP (Step B — Enter code)

+-------------------------------------------+
| Verify your code |
| Enter the 6-digit code sent to: |
| you@example.com |
| |
| [ _ ] [ _ ] [ _ ] [ _ ] [ _ ] [ _ ] |
| |
| [ Verify and sign in ] [ Back ] |
| |
| Error (if any): |
| "Invalid or expired verification code" |
+-------------------------------------------+

Notes

- Button disabled until 6 digits entered
- On ≥5 failed attempts, the OTP is consumed; request a new code

### 3) Login: Password (Dev only)

+-------------------------------------------+
| Welcome Back (Development) |
| Password sign-in (dev only) |
| |
| [ Tabs ] [ Email OTP ] [ Password (Dev) ]
| |
| Email |
| [ you@example.com_______________________ ]|
| |
| Password |
| [ ***************_______________________ ]|
| |
| [ Sign in ] |
| |
| Error (if any): |
| "Invalid credentials" |
+-------------------------------------------+

Visibility

- Render this tab only when `NODE_ENV=development` and `ENABLE_DEV_PASSWORD_SIGNIN=true`

### 4) Dashboard: Desktop — Expanded Sidebar

+-----------------------------------------------------------------------------------+
| AppName | Actions |
| Top Bar (border) |
| [☰] (md:hidden) [ Page Title / Breadcrumb ] [ Button ] |
|-----------------------------------------------------------------------------------|
| Sidebar (resizable) | Content Area (scrolls) |
|----------------------------------------------- |---------------------------------|
| [AppName] [ < > ] (collapse) | [ Page content ] |
| [ Search / ⌘K ] | |
| | |
| Sections | |
| - [🏠] Main | |
| - [•] Dashboard (active) | |
| - [ ] Profile | |
| | |
|-----------------------------------------------|----------------------------------|
| [👤] user@example.com [▼] (Profile | Sign out) |
+-----------------------------------------------------------------------------------+

Notes

- Drag the vertical handle to resize (min/max enforced)
- Collapse button toggles icon-only mode; persist per user
- Active item uses a filled background style

### 5) Dashboard: Desktop — Collapsed (Icon-only) Sidebar

+-----------------------------------------------------------------------------------+
| AppName | Actions |
| Top Bar (border) |
| [☰] (md:hidden) [ Page Title / Breadcrumb ] [ Button ] |
|-----------------------------------------------------------------------------------|
| [≡] | Content Area (scrolls) |
|-----|----------------------------------------------------------------------------|
| [<] | [ Page content ] |
| [🔎]| |
| [🏠]| |
| [👤]| |
| ... | |
|-----|----------------------------------------------------------------------------|
| [🙂] | (Profile | Sign out) |
+-----------------------------------------------------------------------------------+

Notes

- Sidebar width ~56px; icons show tooltips on hover
- Optional badges render as tiny counters on icons

### 6) Dashboard: Mobile — Sidebar in Left Sheet/Drawer

+--------------------------------+ +---------------------------------------------+
| [☰] AppName | | Top Bar (border) |
|--------------------------------| | [☰] [ Spacer / Title ] [ Actions ] |
| [ Search / ⌘K ] | |---------------------------------------------|
| | | Content Area (scrolls) |
| Sections | | [ Page content ] |
| - [🏠] Main | | |
| - [ ] Dashboard | | |
| - [ ] Profile | | |
|--------------------------------| | |
| [🙂] user@example.com [▼] | | |
+--------------------------------+ +---------------------------------------------+

Behavior

- Tap a page; sheet closes and navigates
- Drawer mirrors the desktop sidebar content

### 7) Settings: Profile (Account)

+-------------------------------------------+
| Profile Settings |
| [ Back to Dashboard ] |
| |
| Account Information |
| - Email: user@example.com |
| - Role: user |
| - Email Verified: 2025-10-10 |
| |
| Password |
| [ Set Password ] / [ Change Password ] |
| |
| Session |
| [ Sign Out ] |
+-------------------------------------------+

### 7a) Settings: Set Password

+-------------------------------------------+
| Set Password |
| |
| New Password |
| [ **************** ] |
| |
| [ Set Password ] |
| |
| Notes: Min 8 chars; strong per zxcvbn |
+-------------------------------------------+

### 7b) Settings: Change Password

+-------------------------------------------+
| Change Password |
| |
| Current Password |
| [ **************** ] |
| |
| New Password |
| [ **************** ] |
| |
| [ Change Password ] |
| |
| Error (if any): |
| "Current password is incorrect" |
+-------------------------------------------+

### 8) Sign out

+-------------------------------------------+
| Signing out... → Redirect to /login |
+-------------------------------------------+

---

## Interaction & behavior notes

- Keyboard Shortcuts

  - ⌘K / Ctrl+K: open command palette (placeholder)
  - ⌘⇧N / Ctrl+Shift+N: open Quick Actions (placeholder)
  - Ignore shortcuts when focus is in inputs or editable content

- State Persistence (per user)

  - `app.v1.sidebar.width:{userId}` — sidebar width percent
  - `app.v1.sidebar.collapsed:{userId}` — collapsed state

- Security & Cookies

  - Access (~1h) + Refresh (~14d), HttpOnly, `SameSite=Strict`, `Secure` in prod, `Path=/`
  - Cookie names configurable via env: `JWT_ACCESS_COOKIE_NAME`, `JWT_REFRESH_COOKIE_NAME`

- CSRF & Allowlist

  - All auth routes validate Origin/Referer; allowlist restricts sign-in emails

- hCaptcha

  - Only rendered when server responds with `{ requiresCaptcha: true }` and `HCAPTCHA_ENABLED=true`

- Pointer-events cleanup
  - If a Dialog opens from a Dropdown/ContextMenu, on close ensure: `setTimeout(() => document.body.style.pointerEvents = "", 300)`

---

## Checklist (for implementation)

- [ ] Env and dependencies in place; Prisma configured for local Postgres
- [ ] Prisma models and migrations applied
- [ ] Server libs added: jwt, jwt-edge, csrf, rate-limit, email, auth, auth-helpers
- [ ] API routes implemented (request-otp, verify-otp, dev-signin, signout, set/change password, refresh)
- [ ] Middleware protects `/dashboard` and `/settings` and cooperates with refresh
- [ ] Login page (OTP + Dev tab) matches wireframes and states
- [ ] Protected server layout fetches `user`, `sections`, `pages` and renders `DashboardShell`
- [ ] Dashboard shell with resizable/collapsible sidebar and mobile drawer
- [ ] Profile page with set/change password and sign out
- [ ] CSRF, allowlist, rate limits, audit logging in place
- [ ] Keyboard shortcuts guarded; pointer-events cleanup verified
