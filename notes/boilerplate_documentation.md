# Next.js SaaS Boilerplate — Comprehensive Documentation

This document is the authoritative, developer-focused manual for the boilerplate in this repository. It explains the architecture, configuration, security guardrails, data models, routes, UI patterns, multi-tenant model, and AI features. It favors description over code; file paths are referenced for implementation details.

## Table of Contents

1. Introduction
2. Non-goals and Red Lines
3. Architecture Overview
4. Project Structure (with file references)
5. Environment Configuration (grouped by feature)
6. Authentication System
7. Multi-tenant Organizations
8. Dashboard Shell & UI Patterns
9. AI Features
10. Database & Prisma Models
11. Middleware & Security
12. Admin Area
13. Scripts & Operations
14. Developer Experience & Conventions
15. Testing (Scope & Surfaces)
16. Customization Recipes (Safe Changes)
17. Security Model & Threat Considerations
18. Deployment Notes
19. Troubleshooting
20. Versioning & Changelog Strategy
21. FAQs
22. Glossary

---

## 1. Introduction

This boilerplate provides a production-minded starting point for building a multi-tenant SaaS with Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui (Lucide icons), Prisma with local PostgreSQL 15 (pgvector enabled), and optional AI features via the Vercel AI SDK. Core capabilities include Email OTP authentication with JWT sessions and rotation, a resizable dashboard shell, organization-based tenancy with invitations and role-based permissions, and per-organization AI provider configuration, curated models, and usage analytics.

Who this is for: engineers who want a secure, server-first baseline with strong defaults and guardrails, plus clear patterns for scaling features without compromising isolation or operability.

How to use this doc: read end-to-end on first pass. When implementing, jump to the relevant section and follow the file-path references.

---

## 2. Non-goals and Red Lines

- Do not use the Edge runtime for database operations (DB/secrets must run on Node runtime routes or server components).
- Do not expose secrets or AI calls to the client; all AI operations happen server-side only.
- Do not add icon libraries other than Lucide.
- Do not use managed/cloud databases; use local/self-hosted PostgreSQL 15. pgvector should be enabled in the database.

These are reinforced throughout the codebase and documentation to reduce accidental violations.

---

## 3. Architecture Overview

- Server-first design: default to Server Components; introduce Client Components only when needed (hooks, event handlers, browser APIs).
- Authentication: primary email OTP; optional dev-only password sign-in. JWT access + refresh tokens are stored in HTTP-only cookies. Access tokens are short-lived; refresh tokens are long-lived with rotation. Session invalidation uses a server-side session version.
- Security: CSRF protection via Origin/Referer validation; per-email and per-IP rate limiting on OTP; optional hCaptcha gating; audit logs for security-sensitive actions.
- Tenancy: organizations as the isolation boundary. Users can belong to multiple organizations; roles are per-organization (member/admin) and orthogonal to the global superadmin role.
- UI shell: resizable, two-level navigation with persistence, responsive mobile drawer.
- AI: provider abstraction via Vercel AI SDK, per-organization encrypted API keys, curated model lists with token clamping, per-org and per-IP rate limits, and usage logging with retention.
- Edge vs Node: Edge middleware verifies JWT signature only (no DB access). Node runtime routes perform DB operations and full authorization checks.

For text-based sequence and flow diagrams (OTP, JWT rotation, invitation lifecycle, AI config resolution, protected routing), see `notes/boilerplate_wireframes.md`.

---

## 4. Project Structure (with file references)

- App Router and pages
  - `app/(public)/login/page.tsx` (Login UX: Email OTP + dev-only password tab)
  - `app/o/[orgSlug]/...` (Tenant routes for dashboards/settings)
  - `app/admin/...` (Admin area for global operations)
  - `app/api/auth/*` (Auth API routes — Node runtime)
  - `app/api/orgs/*` (Organization, members, invitations, AI — Node runtime)
- Libraries and helpers
  - `lib/env.ts` (Environment validation and defaults using Zod)
  - `lib/db.ts` (Prisma client singleton)
  - `lib/auth.ts` (OTP generation/verification, password hashing, audit logging)
  - `lib/auth-helpers.ts` (getCurrentUser, token refresh, safe redirects, client IP extraction)
  - `lib/jwt.ts` (JWT signing/verification, cookies; Node)
  - `lib/jwt-edge.ts` (Access JWT signature check; Edge)
  - `lib/csrf.ts` (Origin/Referer CSRF validation)
  - `lib/rate-limit.ts` (Rate limiting helpers for OTP)
  - `lib/validators.ts` (Zod schemas, password strength policy)
  - `lib/utils.ts` (Generic utilities)
  - `lib/ai/providers.ts` (Provider abstraction, curated models, token clamping, key verification)
  - `lib/ai/config.ts` (Configuration resolution for provider/model/tokens per org)
  - `lib/ai/rate-limit.ts` (Per-org and per-IP AI rate limits)
- UI components and features
  - `components/features/dashboard/*` (Dashboard shell, sidebar, layout patterns)
  - `components/features/organization/*` (Org admin UI: general, members, invitations, AI tabs)
  - `components/features/ai/*` (AI keys management, models, usage analytics)
  - `components/ui/*` (shadcn/ui components — Lucide icons only)
- Database
  - `prisma/schema.prisma` (User, OtpToken, OtpRequest, AuditLog, Organization, Membership, Invitation, AI models)
- Middleware
  - `middleware.ts` (Edge middleware: protected paths, JWT signature validation, token refresh rewrite)

---

## 5. Environment Configuration (grouped by feature)

All variables are validated in `lib/env.ts`. Defaults and constraints are enforced at boot; violations are printed with clear messages.

- Core
  - `NODE_ENV` (development | production | test; default development)
  - `APP_URL` (absolute URL for the app; used for CSRF allowlist)
  - `DATABASE_URL` (connection string to local/self-hosted Postgres 15)
- JWT
  - `JWT_SECRET` (must be at least 32 characters)
  - `JWT_ACCESS_COOKIE_NAME` (default `__access`)
  - `JWT_REFRESH_COOKIE_NAME` (default `__session`)
- Authentication toggles and parameters
  - `AUTH_ALLOWLIST_ENABLED` (default true; requires `ALLOWED_EMAILS` when true)
  - `AUTH_SIGNUP_ENABLED` (default true)
  - `ALLOWED_EMAILS` (comma-separated; normalized lowercase comparison)
  - `ENABLE_DEV_PASSWORD_SIGNIN` (default false; requires development mode)
  - hCaptcha (optional): `HCAPTCHA_ENABLED` (default false), `HCAPTCHA_SITE_KEY`, `HCAPTCHA_SECRET_KEY`
  - Tunables: `OTP_EXP_MINUTES` (default 10), `OTP_LENGTH` (min 4, max 8, default 6), `BCRYPT_ROUNDS` (min 10, max 15, default 12)
  - Dev helper: `SKIP_PASSWORD_VALIDATION` (default false; dev-only; applies to set-password route)
- Multi-tenant
  - `ORG_CREATION_ENABLED` (default false)
  - `ORG_CREATION_LIMIT` (default 1)
  - `INVITE_EXP_MINUTES` (default 10080 — 7 days)
  - `INVITES_PER_ORG_PER_DAY` (default 20)
  - `INVITES_PER_IP_15M` (default 5)
  - `ORG_RESERVED_SLUGS` (default includes: o, api, dashboard, settings, login, invite, onboarding, \_next, assets, auth, public)
  - `LAST_ORG_COOKIE_NAME` (default `__last_org`)
- AI features
  - `AI_FEATURES_ENABLED` (default false; requires `APP_ENCRYPTION_KEY` when true)
  - `APP_ENCRYPTION_KEY` (base64-encoded 32 bytes; required if AI is enabled)
  - `AI_RATE_LIMIT_PER_MIN_ORG` (default 60)
  - `AI_RATE_LIMIT_PER_MIN_IP` (default 120)
  - `AI_ALLOWED_PROVIDERS` (default `openai,gemini,anthropic`)
- Seed/ops
  - `SEED_EMAIL` (used by seed scripts)

Constraints and cross-feature dependencies:

- When `AUTH_ALLOWLIST_ENABLED` is true, `ALLOWED_EMAILS` must be provided.
- When `AI_FEATURES_ENABLED` is true, `APP_ENCRYPTION_KEY` must be provided.

---

## 6. Authentication System

Overview: primary Email OTP, optional dev-only password signin, JWT access/refresh session management, CSRF validation, rate limiting, optional hCaptcha gating, and audit logging.

Key behaviors:

- Email OTP
  - Numeric OTP with configurable length and expiry.
  - Bcrypt-hashed OTP stored server-side; single active token per email; failed attempts increment and eventually consume the token.
  - Rate limits per email (15 minutes and daily) and per IP (15 minutes). Optional hCaptcha gating after threshold.
  - Allowlist gate (optional) and signup toggle (optional). Superadmins bypass allowlist and signup restrictions.
- JWT Sessions
  - Access token: short-lived; verified at Edge for signature only.
  - Refresh token: long-lived; used to rotate both tokens at a server route. Session invalidation via user’s `sessionVersion`.
  - Cookies: HTTP-only; secure in production; strict same-site; path at root; default names `__access` and `__session`.
- Passwords (dev support)
  - Password can be set/changed on the profile page.
  - Dev-only password signin requires development mode and explicit enablement.
- CSRF
  - Mutating auth routes validate Origin/Referer against `APP_URL` and optional `ALLOWED_ORIGINS`; localhost variants permitted in development.
- Audit logging
  - Auth-sensitive events recorded with action, user/email, IP, organization (when relevant), and metadata.

Endpoints (descriptions; see files for details):

- `app/api/auth/request-otp/route.ts` (Request an OTP; checks allowlist/signup toggles; rate limits; optional hCaptcha; sends OTP via Resend in production; in development, OTP may be logged to console.)
- `app/api/auth/verify-otp/route.ts` (Verify OTP; JIT user upsert; issue JWT cookies; audit success/failure; safe redirect.)
- `app/api/auth/dev-signin/route.ts` (Development-only; allowlist check; password verification; issue cookies.)
- `app/api/auth/signout/route.ts` (Clear session cookies; audit on valid token.)
- `app/api/auth/refresh/route.ts` (Rotate access + refresh cookies from a valid refresh token; used by Edge middleware rewrite.)
- `app/api/auth/profile/set-password/route.ts` and `.../change-password/route.ts` (Authenticated; CSRF-protected; bcrypt; increment `sessionVersion`; rotate tokens.)

Implementation references:

- `lib/auth.ts` (OTP hashing and verification, password hashing, audit helper)
- `lib/auth-helpers.ts` (getCurrentUser, refresh rotation, safeRedirect, client IP extraction)
- `lib/jwt.ts` (sign/verify access & refresh, cookies)
- `lib/jwt-edge.ts` (signature-only access token verification)
- `lib/csrf.ts` (Origin/Referer validation)
- `lib/rate-limit.ts` (OTP request limits)
- `lib/validators.ts` (password strength policy)
- `middleware.ts` (Edge protection and refresh rewrite)

Operational notes:

- Access token expiry is short (about 1 hour); refresh token persists for about 14 days and rotates on use.
- Password changes increment `sessionVersion`, which invalidates all existing access/refresh tokens after rotation.
- Allowlist and signup toggles can be used to lock down access during private betas.

---

## 7. Multi-tenant Organizations

Overview: organizations are the tenant isolation boundary. Users may be members of multiple organizations. Roles are per-organization (`member` or `admin`). A global `superadmin` role grants operator privileges across all organizations.

Core policies:

- Organization creation
  - Controlled by toggles for enablement and per-user limits.
  - Superadmins bypass creation restrictions.
  - Slug rules apply (reserved words, uniqueness, format).
- Membership and roles
  - Admins can invite members, change roles, and manage org settings.
  - Cannot demote/remove the last admin; self-demotion/removal checks apply.
  - Superadmins can access and manage any organization without membership.
- Invitations
  - Email-bound with bcrypt-hashed tokens and expiry.
  - Rate limits: per-organization per day and per-IP per 15 minutes.
  - Accept requires authentication and matching email; creates membership with invited role.
- Default organization & last-org cookie
  - First joined/created org becomes user’s default.
  - Last visited org is stored in a cookie to improve navigation UX.

Endpoints (descriptions):

- `app/api/orgs/route.ts` (List and create organizations; creation enforces toggles and limits; superadmins can create regardless.)
- `app/api/orgs/[orgSlug]/route.ts` (Fetch, update, or delete organization; delete typically superadmin-only; slug changes gated.)
- `app/api/orgs/[orgSlug]/members/route.ts` and `.../members/[userId]/route.ts` (List members; update role/name; remove member; enforce last-admin protections.)
- `app/api/orgs/[orgSlug]/invitations/route.ts` and `.../invitations/[id]/route.ts` and `.../invitations/[id]/resend/route.ts` (Create/list/revoke/resend invitations; rate limits and audit.)
- `app/api/orgs/invitations/validate/route.ts` and `.../accept/route.ts` (Validate/accept invitation tokens.)

Implementation references:

- `lib/org-helpers.ts` (Organization and slug helpers, permissions; where present)
- `lib/invitation-helpers.ts` (Token generation/validation, rate limits; where present)
- `lib/env.ts` (Reserved slug list, invite tunables, creation toggles)
- `prisma/schema.prisma` (Organization, Membership, Invitation, AuditLog relations)

Operational notes:

- Reserved slugs prevent collisions with core routes.
- Superadmin access is powerful and must be granted sparingly and audited.
- Admin screens in the app reflect these rules and guardrails.

---

## 8. Dashboard Shell & UI Patterns

Overview: a responsive, resizable two-level navigation shell that adapts to desktop and mobile.

Key behaviors:

- Resizable sidebar with width bounds and collapsible icon-only state; persisted per user via localStorage.
- Two-level navigation (Sections → Pages) with active route highlighting.
- Mobile drawer (Sheet) renders full sidebar content.
- Server layouts fetch user + navigation on the server, then pass serializable props to a client `DashboardShell` for responsive behavior.

Critical UI conventions:

- Dialogs opened from dropdown/context menus must restore body pointer-events on close.
- Select items must not use empty string values; use semantic placeholders like "none" and convert to null in logic.
- Toast notifications use Sonner; a single Toaster is already mounted at the root.

Implementation references:

- `components/features/dashboard/dashboard-shell.tsx` (Shell behavior and persistence)
- `components/features/dashboard/sidebar.tsx` (Navigation)
- `components/ui/*` (shadcn/ui components; Lucide icons only)
- `app/(public)/login/page.tsx` and tenant/admin pages for usage patterns

---

## 9. AI Features

Overview: per-organization AI provider configuration using the Vercel AI SDK. API keys are stored encrypted; organizations select curated models per provider; generation requests are rate-limited and logged with token metrics and latency.

Core capabilities:

- Providers: OpenAI, Google Gemini, Anthropic (configurable allowlist).
- Curated models per provider with safe maximum output tokens and descriptive labels.
- API key management:
  - Add, verify (minimal test call), store encrypted, display last four, remove.
  - Models are configured per provider per organization; one model can be marked default.
- Generation:
  - Non-streaming and streaming text generation supported via server endpoints.
  - Configuration resolution rules select provider/model when not explicitly specified by the caller.
- Rate limits and retention:
  - Per-organization and per-IP per minute limits.
  - Usage logs with tokens in/out, latency, correlation ID, sanitized input/output, and errors.
  - Per-organization retention and optional per-minute override.

Endpoints (descriptions):

- `app/api/orgs/[orgSlug]/ai/keys/route.ts` (Add/verify/remove provider API keys for an org.)
- `app/api/orgs/[orgSlug]/ai/models/route.ts` and `.../models/[modelId]/default/route.ts` (List/add/remove models; set default.)
- `app/api/orgs/[orgSlug]/ai/generate/route.ts` (Generate text; supports provider/model selection, max output tokens, and streaming.)
- `app/api/orgs/[orgSlug]/ai/logs/route.ts` (List usage logs with filters.)

Implementation references:

- `lib/ai/providers.ts` (Provider clients, curated models, token clamping, verification)
- `lib/ai/config.ts` (Resolution logic: provider, model, token limits, defaults)
- `lib/ai/rate-limit.ts` (Per-org and per-IP generation limits)
- `components/features/ai/*` (Keys management, model curation, usage dashboards)
- `notes/ai-features-setup-guide.md` (Enablement steps and testing guidance)

Operational notes:

- AI features require `AI_FEATURES_ENABLED=true` and a valid `APP_ENCRYPTION_KEY`.
- Key verification uses minimal model prompts and provides helpful provider-specific error messages.
- Monitoring guidance is included in the Troubleshooting and Monitoring sections.

---

## 10. Database & Prisma Models

Models (high-level):

- User — identity and global role (`user` or `superadmin`), optional password hash, session versioning, default organization.
- OtpToken — bcrypt-hashed OTPs with expiry, attempts, and consumption tracking.
- OtpRequest — rate limiting for OTP issuance per email/IP.
- AuditLog — tracks auth and security events with metadata; can include organization context.
- Organization — tenant boundary: name, slug, creator; relations to memberships, invitations, logs, and AI settings.
- Membership — user-organization relationship with role (`admin` or `member`).
- Invitation — pending invites (email-bound) with token hash and expiry; audit upon actions.
- AI tables — per-org API keys (encrypted), curated models, usage logs, and settings with retention/limits.

Implementation references:

- `prisma/schema.prisma` (Full schema definitions and relations)
- `prisma/migrations/*` (Applied migrations)

---

## 11. Middleware & Security

- Edge middleware (`middleware.ts`) protects tenant and admin paths.
  - Always-accessible and public paths are whitelisted.
  - For protected paths, it checks the access token signature; on missing/invalid access token but present refresh token, it rewrites to the refresh endpoint.
  - Security headers are added on allowed responses.
- Full authorization happens on the server (Node runtime) via helpers that check `sessionVersion` against the database and enforce org permissions.
- CSRF checks occur in mutating server routes using Origin/Referer validation.

---

## 12. Admin Area

Overview: superadmin operator access across the system. Admin screens provide:

- Organizations overview and detail management.
- Member and invitation management per organization.
- AI provider keys and model curation for any organization.

Policy highlights:

- Superadmin can access any organization without membership.
- Deleting organizations and changing slugs are privileged actions (superadmin-only by default).
- All operations are audit-logged.

Implementation references:

- `app/admin/*` (Admin pages and tabs)
- `components/features/admin/*` (Dialogs, filters, actions)

---

## 13. Scripts & Operations

- Seeding users and superadmins
  - Seed scripts create initial users and optionally set superadmin role.
  - After seeding, ensure allowlist and toggles are configured as desired.
- Backfill and maintenance tasks
  - Scripts exist to backfill organizations, migrate settings, or update derived fields.

Implementation references:

- `scripts/seed-superadmin.ts` (Create/promote superadmin)
- `scripts/backfill-organizations.ts` (Batch org updates)
- `prisma/seed.ts` (General seed logic)

---

## 14. Developer Experience & Conventions

- TypeScript strict mode; avoid `any`; prefer `unknown` with type guards.
- No classes; functional patterns and plain objects.
- Naming: files/dirs in kebab-case; components PascalCase; functions camelCase; constants UPPER_SNAKE_CASE.
- Server vs client boundaries: keep server-only modules off the client; only add "use client" where necessary.
- ESLint configured; hot reload via Turbopack; shadcn/ui components live under `components/ui`.

---

## 15. Testing (Scope & Surfaces)

This section outlines what to test rather than how to test.

- Authentication flows: OTP request/verify happy paths and edge cases; allowlist/signup toggles; dev-password guards; CSRF rejections; JWT set/clear/rotation; sessionVersion invalidation.
- Middleware behavior: protected route redirects; refresh rewrite; public paths.
- Multi-tenant permissions: require membership/admin; superadmin bypass; last-admin protections; invitation accept constraints; slug rules.
- AI: API key verification outcomes; curated model constraints; provider/model defaults; rate limits; usage logs; retention behavior; error handling.
- Database: migrations applied; pgvector extension present; integrity of relations.

---

## 16. Customization Recipes (Safe Changes)

- JWT lifetimes and cookie names
  - Adjust access/refresh token expirations and cookie names in JWT helpers; keep short-lived access tokens and rotate refresh tokens.
- Rate limits
  - OTP and invite limits are configurable via environment; ensure client UX adapts to gating (e.g., hCaptcha) as thresholds are hit.
- Reserved slugs
  - Update `ORG_RESERVED_SLUGS` to suit your routes; validate carefully to avoid collisions.
- Tenant-owned tables
  - Add new tables with `organizationId` foreign keys; consistently scope queries by organization.
- Navigation
  - Add sections/pages in the dashboard shell; respect persistence keys and active highlighting rules.
- AI models
  - Extend curated model lists responsibly; maintain safe token caps; consider costs and provider changes.

---

## 17. Security Model & Threat Considerations

- Trust boundaries
  - Edge middleware verifies JWT signature only; Node runtime routes do DB operations and full authorization checks.
- CSRF strategy
  - Origin/Referer checks against `APP_URL` and optional `ALLOWED_ORIGINS`; dev allows localhost variants.
- Cookie security
  - HTTP-only, Secure in production, SameSite=Strict, Path=/; access and refresh cookie names are configurable.
- Error hygiene
  - Use generic error messages to avoid account/token enumeration.
- Abuse handling
  - Rate limits on OTP and invitations; AI per-org/IP limits; optional hCaptcha gating after thresholds.
- Audit trails
  - Key actions are recorded with user/email/IP/organization and metadata for later analysis.

---

## 18. Deployment Notes

- Platform
  - Suitable for generic Node hosting or platforms like Vercel. When deploying on Vercel, ensure all DB-bearing routes/components run on the Node runtime (not Edge). Edge middleware is fine for signature checks.
- Database
  - Use local or self-hosted PostgreSQL 15 (no managed cloud DB). You may connect a Vercel-hosted app to a self-hosted Postgres over a secure network.
- Environment
  - Provide the full set of environment variables; ensure `JWT_SECRET` length and AI encryption key requirements are met.
- Email delivery
  - Configure Resend credentials for production email; in development, OTPs may be logged to the console.

---

## 19. Troubleshooting

- Authentication
  - "Invalid origin" errors indicate CSRF policy mismatch; confirm `APP_URL` and any `ALLOWED_ORIGINS`.
  - OTP limits reached or gating required; back off and, if enabled, supply hCaptcha token.
  - Signup disabled with unknown email will be blocked unless superadmin.
  - Dev password signin is only available in development with the flag enabled.
- JWT & sessions
  - Frequent redirects may indicate expired access tokens without refresh; confirm refresh cookie is present and refresh endpoint accessible.
  - After password change, old sessions are invalidated by session version checks; reauthenticate.
- Multi-tenant
  - Slug collisions or reserved words cause validation errors; adjust naming.
  - Demoting/removing the last admin is blocked; add another admin first.
  - Invitation acceptance requires the authenticated user email to match the invite.
- AI
  - "AI features disabled" requires enabling flag and valid encryption key.
  - API key verification errors often stem from invalid keys, lack of quota, or provider rate limits.
  - Hitting org/IP rate limits yields 429 responses with Retry-After; wait and retry.
- Database
  - Ensure migrations are applied and pgvector is enabled. Verify connection string and connectivity.

See `notes/ai-features-setup-guide.md` for additional AI-specific troubleshooting and monitoring tips.

---

## 20. Versioning & Changelog Strategy

Maintain a concise "Versioning" note in this document and track detailed changes in repository changelogs and commit messages. For breaking changes (schema or runtime), include upgrade notes and migration steps near the top of the repository’s CHANGELOG.

---

## 21. FAQs

- Can I deploy on Vercel?
  - Yes, with Node runtime for DB operations and self-hosted PostgreSQL. Edge middleware can still handle signature checks.
- Can I use a managed cloud database?
  - No. This boilerplate’s guardrails require local/self-hosted PostgreSQL.
- Can I call AI providers from the client?
  - No. All AI calls are server-side only.
- Can I add other icon libraries?
  - No. Lucide-only for consistency and bundle hygiene.
- How do I restrict access during a private beta?
  - Use allowlist and signup toggles; superadmins bypass these gates.

---

## 22. Glossary

- Access Token — short-lived JWT for authenticated requests; verified at Edge for signature.
- Refresh Token — long-lived JWT stored in HTTP-only cookie; rotates access/refresh tokens.
- Session Version — integer on the user; when incremented, invalidates previous sessions on next rotation.
- Organization — tenant isolation boundary; referenced by slug in URLs.
- Member/Admin — per-organization roles defining standard and administrative permissions.
- Superadmin — global operator with access to all organizations and bypasses for allowlist/signup restrictions.
- Allowlist — set of emails permitted to sign up/sign in when enabled.
- CSRF — Cross-Site Request Forgery protection via Origin/Referer checks.
- Curated Models — vetted AI models per provider with known capabilities and safe token caps.
- Correlation ID — identifier attached to AI generation requests for tracing and analytics.

---

References (file paths with purpose):

- `lib/env.ts` (Zod environment validation and defaults)
- `lib/auth.ts` (OTP, password hashing, audit logging)
- `lib/auth-helpers.ts` (Current user, token refresh, safe redirects)
- `lib/jwt.ts` (JWT sign/verify, cookies; Node)
- `lib/jwt-edge.ts` (Edge signature validation)
- `lib/csrf.ts` (Origin/Referer validation)
- `lib/rate-limit.ts` (OTP rate limits)
- `lib/ai/providers.ts` (Provider abstraction, curated models, verification)
- `lib/ai/config.ts` (Org AI config resolution)
- `lib/ai/rate-limit.ts` (AI rate limits)
- `middleware.ts` (Edge route protection and refresh rewrite)
- `prisma/schema.prisma` (Database models and relations)
- `app/api/auth/*` (Authentication endpoints; Node runtime)
- `app/api/orgs/*` (Organizations, members, invitations, AI endpoints)
- `components/features/*` (Dashboard, organization admin, AI UIs)
- `notes/boilerplate_wireframes.md` (Text diagrams for key flows)
