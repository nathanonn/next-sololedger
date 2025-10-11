# Authentication UX Flow and Wireframes

This document maps the authentication flows and presents ASCII wireframes for each screen/state, aligned with the implementation in the app.

## Flow map

- Entry: `/login`
  - Tab: Email OTP (default)
    - Step A: Enter email
      - POST `/api/auth/request-otp`
        - 200 { ok: true } → proceed to Step B (Enter code)
        - 400 { ok: false, requiresCaptcha: true } → show hCaptcha → resend with hcaptchaToken
        - Generic success message is shown regardless of allowlist to avoid enumeration.
    - Step B: Enter verification code
      - POST `/api/auth/verify-otp`
        - 200 { ok: true, redirect } → replace to `redirect` (safe internal path or /dashboard)
        - 400 { error } (invalid/expired) → show error; allow retry; token consumed at 5 attempts
  - Tab: Password (Dev)
    - Visible only when NODE_ENV=development and ENABLE_DEV_PASSWORD_SIGNIN=true
    - Enter email + password
      - POST `/api/auth/dev-signin`
        - 200 { ok: true, redirect } → replace to /dashboard
        - 404 when disabled; 401 on invalid credentials; allowlist enforced

- Protected area: `/dashboard`, `/settings/*`
  - Middleware validates JWT signature; redirects to `/login?next=...` if missing/invalid
  - Server components use `getCurrentUser()` to enforce sessionVersion check

- Profile: `/settings/profile`
  - Shows account info and session controls
  - Set Password (if none)
    - POST `/api/auth/profile/set-password` → rotates JWT and increments sessionVersion
  - Change Password (if exists)
    - POST `/api/auth/profile/change-password` → verifies current, rotates JWT, increments sessionVersion
  - Sign Out
    - POST `/api/auth/signout` → clears cookie; navigates to /login

Notes

- CSRF: All auth APIs validate Origin/Referer against APP_URL and optional ALLOWED_ORIGINS.
- Allowlist: All email-based entry points check against ALLOWED_EMAILS with generic responses.
- Rate limits: email 3/15m & 10/day; IP 5/15m; single-active OTP per email.
- hCaptcha: Required after ≥2 requests/15m for either email or IP (when configured). Client submits hcaptchaToken when prompted.

---

## Screens (ASCII)

### 1) Login: Email OTP (Step A: Enter email)

+-------------------------------------------+
| Welcome Back |
| Sign in to your account |
| |
| [ Tabs ] [ Email OTP ] [ Password (Dev) ]
| |
| Email |
| [ you@example.com ] |
| |
| [ Send verification code ] |
| |
| Tip: If allowed, you will receive an OTP |
+-------------------------------------------+

States

- Loading state on submit: button shows "Sending..."
- On success (200 ok): advance to Step B (enter code)
- On 400 with requiresCaptcha: render hCaptcha (see 1b)

### 1b) Login: Email OTP (Step A with hCaptcha)

+-------------------------------------------+
| Welcome Back |
| Sign in to your account |
| |
| [ Tabs ] [ Email OTP ] [ Password (Dev) ]
| |
| Email |
| [ you@example.com ] |
| |
| hCaptcha |
| [ Widget Container (site key) ] |
| - I'm human checkbox/interaction |
| |
| [ Verify and send code ] |
| |
| Error (if any): |
| "Captcha verification required/failed" |
+-------------------------------------------+

Behavior

- If server responds requiresCaptcha, mount widget and wait for token
- Resubmit request-otp with { hcaptchaToken }
- Keep widget visible if server still requires captcha

### 2) Login: Email OTP (Step B: Enter code)

+-------------------------------------------+
| Verify your code |
| Enter the 6-digit code sent to: |
| you@example.com |
| |
| [ _ ] [ _ ] [ _ ] [ _ ] [ _ ] [ _ ] |
| |
| [ Verify and sign in ] |
| [ Back to email ] |
| |
| Error (if any): |
| "Invalid or expired verification code" |
+-------------------------------------------+

Notes

- Button disabled until 6 digits entered
- On 5 failed attempts, token is consumed; user must request a new OTP

### 3) Login: Password (Dev)

+-------------------------------------------+
| Welcome Back |
| Development-only password sign-in |
| |
| [ Tabs ] [ Email OTP ] [ Password (Dev) ]
| |
| Email |
| [ you@example.com ] |
| |
| Password |
| [ *************** ] |
| |
| [ Sign in ] |
| |
| Error (if any): |
| "Invalid credentials" |
+-------------------------------------------+

Visibility

- Only when NODE_ENV=development and ENABLE_DEV_PASSWORD_SIGNIN=true

### 4) Profile: Account information and controls

+-------------------------------------------+
| Profile Settings |
| [ Back to Dashboard ] |
| |
| Account Information |
| - Email: user@example.com |
| - Role: user |
| - Email Verified: 2025-10-10 |
| |
| [ Set Password ] / [ Change Password ] |
| |
| Appearance |
| - Theme toggle [ Light | Dark ] |
| |
| Session |
| [ Sign Out ] |
+-------------------------------------------+

### 4a) Profile: Set Password

+-------------------------------------------+
| Set Password |
| |
| New Password |
| [ **************** ] |
| |
| [ Set Password ] |
| |
| Notes: Min 8 chars; strong per zxcvbn |
| Dev: SKIP_PASSWORD_VALIDATION=true (only |
| for set-password route) |
+-------------------------------------------+

### 4b) Profile: Change Password

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

### 5) Sign out

+-------------------------------------------+
| [ Signing out... ] → Redirect to /login |
+-------------------------------------------+

---

## Edge/middleware touchpoints

- Middleware (Edge) checks JWT and redirects unauthenticated users to `/login?next=...`.
- After successful sign-in, server returns a redirect path; UI calls `router.replace(redirect)`.
- Safe redirect: `next` must be an internal path starting with `/`; otherwise default to `/dashboard`.
