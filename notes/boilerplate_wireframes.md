# Next.js SaaS Boilerplate — Wireframes & Flow Diagrams

This document contains text-based wireframes and ASCII flow diagrams for the boilerplate’s core flows. Use this alongside `notes/boilerplate_documentation.md` for detailed explanations and file-path references.

## Table of Contents

1. Auth: Email OTP Flow
2. JWT Session Rotation
3. Protected Routing (Edge Middleware)
4. Organization Lifecycle (Create / Update / Delete)
5. Invitations Lifecycle (Create / Resend / Revoke / Validate / Accept)
6. Tenant Selection (Default Org & Last-Org Cookie)
7. AI Configuration Resolution (Provider/Model/Token Limits)
8. AI Generate Flow (Streaming and Non-Streaming)
9. Dashboard Shell Layout (Desktop & Mobile)
10. Admin vs Member Access Summary
11. CSRF Validation Path
12. OTP & Invitation Rate Limiting

---

## 1. Auth: Email OTP Flow

```
User               UI (Login)            API (request-otp)           Email/Console        API (verify-otp)        Auth Helpers/JWT
 |                     |                         |                         |                     |                         |
 | Enter email --------> Validate (Zod) -------->| CSRF check             |                     |                         |
 |                     |                         | Allowlist & Signup     |                     |                         |
 |                     |                         | Rate-limit (email/IP)  |                     |                         |
 |                     |                         | Optional hCaptcha      |                     |                         |
 |                     |                         | Create OTP (bcrypt) ---+--> Send via Resend  |                         |
 |                     |                         | Return generic OK      |     (prod) or log   |                         |
 | Receive code        |                         |                         |     (dev)           |                         |
 | Enter 6-digit code -> Validate (Zod) -------->| CSRF check             |                     |                         |
 |                     |                         | Verify OTP (attempts)  |                     |                         |
 |                     |                         | JIT upsert user        |                     | sign JWTs (access/refresh)
 |                     |                         |                         |                     | set HTTP-only cookies   |
 | Redirect to next <----------------------------------------- Safe redirect (internal only) -------------------------------->
```

Notes:

- Single active token per email; failed attempts increment and may consume the token.
- Superadmins bypass allowlist and signup restrictions.
- Cookies: `__access` (short), `__session` (long; rotates).

---

## 2. JWT Session Rotation

```
Browser                         Edge Middleware                      Refresh Endpoint (Node)               DB / Auth Helpers
	 |                                     |                                        |                                    |
	 | Request protected path  ------------> Check access token signature ---------> if missing/invalid: rewrite --------->|
	 |                                     |                                        | verify refresh JWT                  |
	 |                                     |                                        | load user, check sessionVersion     |
	 |                                     |                                        | issue new access + refresh cookies  |
	 |                                     |<------------------------- redirect/next --------------------------------------|
	 |<------------------------- proceed with new access token -------------------------------------------------------------|
```

Notes:

- Edge validates signature only; full checks (sessionVersion, permissions) happen server-side.
- Rotation updates both cookies to prevent fixation and stale tokens.

---

## 3. Protected Routing (Edge Middleware)

```
Request URL
	|
	+--> Always-accessible? (/_next, /favicon.ico, /assets) ----> allow
	|
	+--> Public path? (/, /login, /invite, /api/auth/*) ---------> allow
	|
	+--> Protected? (/o/, /onboarding, /admin) ------------------>
				 |
				 +--> access cookie present & signature valid? --------> allow + set security headers
				 |
				 +--> refresh cookie present? --------------------------> rewrite to /api/auth/refresh?next=...
				 |
				 +--> else --------------------------------------------> redirect to /login?next=...
```

Notes:

- Security headers added on successful pass-through.
- Middleware only checks signatures (no DB access).

---

## 4. Organization Lifecycle (Create / Update / Delete)

```
User/Admin UI  -->  POST /api/orgs        --> Validate (name, optional slug)
									 (create)
										 |--> Enforce ORG_CREATION_ENABLED / LIMIT (superadmin bypass)
										 |--> Validate slug (format, uniqueness, reserved list)
										 |--> Create org + admin membership for creator
										 |--> Set defaultOrganizationId if first org
										 |--> Audit "org_create" -> Return org

PATCH /api/orgs/[slug]  --> Validate fields (name, slug*)
	|--> Require admin (slug change: superadmin)
	|--> Apply updates + Audit "org_updated"

DELETE /api/orgs/[slug] --> Superadmin-only (default)
	|--> Cascade memberships/invitations/logs as modeled
	|--> Clear users’ defaultOrganizationId if needed
	|--> Audit "org_deleted"
```

---

## 5. Invitations Lifecycle (Create / Resend / Revoke / Validate / Accept)

```
Admin UI --> POST /api/orgs/[slug]/invitations
	|--> CSRF, auth (admin), rate limit (org/day, IP/15m)
	|--> Generate token (store bcrypt hash), expiry
	|--> Optional send email, Audit "member_invited"

GET /api/orgs/[slug]/invitations --> list pending invites

POST /api/orgs/[slug]/invitations/[id]/resend
	|--> New token + expiry, rate limit, Audit "invite_resend"

DELETE /api/orgs/[slug]/invitations/[id]
	|--> Revoke (set revokedAt), Audit "invite_revoked"

Invited user flow:
	Validate link --> GET /api/orgs/invitations/validate?token=...
									|--> Return org + invite info if valid
	Accept invite --> POST /api/orgs/invitations/accept { token }
									|--> Must be authenticated and email must match invitation
									|--> Create membership (role), mark accepted, set default org if first
									|--> Audit "invite_accepted"
```

Notes:

- Guard against demoting/removing last admin in member management.
- Invitations are email-bound; token is hashed in DB.

---

## 6. Tenant Selection (Default Org & Last-Org Cookie)

```
On sign-in / landing:
	1) Check LAST_ORG_COOKIE_NAME (e.g., "__last_org"). If slug valid & accessible -> route to /o/[slug]
	2) Else, check User.defaultOrganizationId -> route to that org
	3) Else, show onboarding/picker (create/join), respecting ORG_CREATION_ENABLED
```

Notes:

- Keep selection server-side where possible; client shell receives the resolved context.

---

## 7. AI Configuration Resolution (Provider/Model/Token Limits)

```
Input: { orgId, feature, provider?, modelName?, requestedMaxOutputTokens? }

Decision tree:
	A) provider & modelName provided?
		 - Validate model is curated for provider
		 - Ensure org has API key for provider
		 - Clamp output tokens to model/provider caps
		 - Use as-is

	B) modelName only?
		 - Find org’s configured model by name (implies provider)
		 - Validate still curated
		 - Clamp tokens

	C) provider only?
		 - Use org’s default model for that provider
		 - Clamp tokens

	D) neither provided
		 - Use org’s default model (any provider)
		 - Clamp tokens

On failure: throw typed config errors (missing key, model not allowed, no default model, token limit exceeded).
```

---

## 8. AI Generate Flow (Streaming and Non-Streaming)

```
Caller (tenant-scoped) --> POST /api/orgs/[slug]/ai/generate
	|--> CSRF, auth, membership check
	|--> Resolve provider/model/tokens (see section 7)
	|--> Rate limit (per org/IP)
	|--> Call provider via Vercel AI SDK (server-side only)
	|--> Log usage: tokens in/out, latency, provider, model, feature, correlationId
	|--> Return:
			 - Non-stream: { text, correlationId, tokensIn, tokensOut, latencyMs }
			 - Stream: SSE chunks with text deltas and final metadata
```

Notes:

- If no provider/model configured, return a configuration error with clear guidance.
- Inputs/outputs are sanitized and truncated in logs.

---

## 9. Dashboard Shell Layout (Desktop & Mobile)

```
Desktop (resizable)
+-----------------------------------------------------------------------------------+
| Sidebar (15–35% width, collapsible) |  Top Bar (profile, org switcher, etc.)     |
|  - Sections                          |--------------------------------------------|
|    - Pages                           |  Page content area                          |
|  - Persistence: localStorage         |  - Server data passed as props to shell     |
|  - Active highlighting               |  - Responsive content                       |
+-----------------------------------------------------------------------------------+

Mobile
+--------------------------------------+
| Top Bar (menu triggers Sheet)        |
+--------------------------------------+
| Sheet (Sidebar content)              |
+--------------------------------------+
| Page content                          |
+--------------------------------------+
```

Notes:

- Persistence keys are per user; shell manages responsive behavior.

---

## 10. Admin vs Member Access Summary

```
Global role: superadmin
	- Access any org without membership
	- Can create/delete orgs, change slugs (policy), manage members, configure AI
	- Bypasses allowlist/signup restrictions

Org roles:
	- admin: manage members/invitations/settings; cannot demote/remove last admin
	- member: standard org access within scoped features
```

---

## 11. CSRF Validation Path

```
Incoming request (mutating)
	|
	+--> Extract Origin or Referer --> Build allowlist: APP_URL (+ ALLOWED_ORIGINS; localhost in dev)
	|
	+--> Is request origin in allowlist?
				|--> Yes: allow
				|--> No: reject with CSRF error (generic message)
```

---

## 12. OTP & Invitation Rate Limiting

```
OTP (request-otp)
	- Per email: N per 15m; M per 24h (see env defaults)
	- Per IP: K per 15m (see env defaults)
	- Optional: hCaptcha gating after threshold

Invitations
	- Per organization per day: limited (see env)
	- Per IP per 15m: limited (see env)
```

Notes:

- Attach Retry-After when applicable; surface requiresCaptcha when gating is active.

---

End of wireframes.
