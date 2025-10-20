# Multi‑Tenant Support (Reusable for Next.js Apps)

This document outlines a portable multi‑tenant architecture you can copy into any Next.js App Router app. It mirrors the patterns implemented in this repository and focuses on Organizations, Memberships, Invitations, and a global Superadmin role.

Scope and choices (current doc defaults)

- Tenant routing: path segment per tenant → /o/[orgSlug]/...
- Tenant identifier: human‑readable unique slug (kebab‑case, reserved words list)
- Roles in org: two roles → admin, member
- Superadmin: global operator with visibility and control across all orgs
- Org creation: toggle + per‑user limit; superadmin bypass
- Invitations: email‑bound hashed tokens with expiry; per‑org/day and per‑IP/15m rate limits
- Last admin protection: cannot demote/remove last admin
- Default org: auto‑set on first create/join; remembered with last_org cookie
- Data isolation: single database, orgId foreign key on tenant‑owned tables
- Global listings: superadmin‑only
- Reserved slugs: configurable via env
- Token hashing: bcrypt for invitation token storage
- UI: protected server layouts render tenant context; superadmin can access any org

You can adopt these as‑is or swap variants (subdomains, owner role, soft delete) — see Variants.

## Baseline & Principles

- Next.js App Router (server‑first) + React + TypeScript (strict)
- Prisma + Postgres (single DB, orgId column per tenant table)
- Auth: JWT sessions in HTTP‑only cookies; Edge middleware for signature check only
- Security: CSRF origin checks on mutating routes; rate limits; audit logging
- Server‑only boundaries: DB/secrets on Node runtime routes and server components

Success criteria

- Users can belong to many orgs; org‑scoped permissions enforced everywhere
- Admins manage members and invitations; cannot orphan an org by removing last admin
- Superadmins operate globally (support/ops), with strong audit trails
- Tenant data is always scoped by organizationId in queries

## Data Model (Prisma sketch)

Portable schema intent (names mirrored from this repo):

- User: id, email, role ("user" | "superadmin"), defaultOrganizationId?, sessionVersion …
- Organization: id, name, slug, createdById …
- Membership: id, userId, organizationId, role ("admin" | "member")
- Invitation: id, organizationId, email, name?, role, tokenHash, expiresAt, invitedById, acceptedAt?, revokedAt?
- AuditLog: id, action, userId?, email?, ip?, organizationId?, metadata, createdAt

Notes

- Use orgId foreign key on all tenant‑owned tables to enforce isolation. Prefer a small helper to attach organizationId to queries (see Helpers).
- Keep User.role separate from Membership.role — global vs tenant permissions are orthogonal.

## Environment & Configuration

Portable env names (all present in this repo) — adapt as needed:

- Core: APP_URL, DATABASE_URL, NODE_ENV
- JWT: JWT_SECRET (≥32 chars), JWT_ACCESS_COOKIE_NAME, JWT_REFRESH_COOKIE_NAME
- CSRF: ALLOWED_ORIGINS (optional; allowlist in addition to APP_URL)
- Multi‑tenant toggles
  - ORG_CREATION_ENABLED ("true"|"false")
  - ORG_CREATION_LIMIT (number; per user; superadmin bypasses)
  - ORG_RESERVED_SLUGS (comma list; default includes: o, api, dashboard, settings, login, invite, onboarding, \_next, assets, auth, public)
  - LAST_ORG_COOKIE_NAME (default "\_\_last_org")
- Invitations
  - INVITE_EXP_MINUTES (expiry; default 7 days)
  - INVITES_PER_ORG_PER_DAY
  - INVITES_PER_IP_15M

Tip: Validate env at boot with Zod and surface clear errors (see `lib/env.ts`).

## URL Design and Routing

- Path pattern: /o/[orgSlug]/…
- Slugs: kebab‑case [a‑z0‑9-], length ≤ 50, no leading/trailing hyphen; reserved list enforced; uniqueness guaranteed.
- Server layouts: extract [orgSlug], resolve org context on the server, and pass serializable props to client shells.

Variant: subdomain tenants (https://{slug}.yourapp.com) require wildcard DNS, multi‑domain CSRF handling, and cookie partitioning — not covered here by default.

## Roles and Permissions

- Global: superadmin — full operator access; bypass membership checks.
- Organization: admin, member
  - member — read and standard actions within an org
  - admin — invite/remove members, change roles, edit org profile; cannot demote/remove the last admin

Permission helpers (names from this repo)

- requireMembership(userId, orgId)
- requireAdmin(userId, orgId)
- requireAdminOrSuperadmin(userId, orgId)
- isSuperadmin(userId)
- isLastAdmin(userId, orgId)

Recommendation: centralize these helpers to ensure consistent enforcement.

## Tenant Data Isolation

- Always scope queries by organizationId.
- Provide a small helper to enforce org scoping at the query callsite:
  - scopeTenant(where, orgId) → returns { ...where, organizationId: orgId }
- Avoid ad‑hoc where clauses; prefer standard composition via helpers.

## Invitations

- Email‑bound flow with secure tokens
  - Token: 32‑byte random hex; store bcrypt hash only; compare on accept/validate
  - Expiry: INVITE_EXP_MINUTES (default 10080 = 7 days)
  - Rate limits: per‑org/day and per‑IP/15m; audit invitations
- Accept constraints
  - User must be authenticated and email must match the invitation email
  - On accept: create membership with invited role, mark invitation accepted, set defaultOrganizationId if first org; optionally apply name from invite if user has no name
- Resend
  - Generate a new token + expiry; send email; audit "invite_resend"
- Revoke
  - Mark revokedAt; cannot accept thereafter

## Organization Lifecycle

- Create
  - Policy gates: ORG_CREATION_ENABLED + ORG_CREATION_LIMIT; superadmin bypass
  - Slug creation: client may propose slug; validate; else generate unique from name
  - On create: create org, admin membership for creator, set defaultOrganizationId if empty, audit "org_create"
- Update
  - Admin or superadmin; only superadmin may change slug by default
  - Validate name/slug; reserved list and uniqueness checks; audit "org_updated" with diffs
- Delete
  - Superadmin only (default); cascades memberships and invitations; clears users’ defaultOrganizationId; audit "org_deleted"
  - Optional: soft delete with retention (variant)

## Cookies and Default Tenant UX

- LAST_ORG_COOKIE_NAME (default "\_\_last_org"): remember last visited org to improve landing/navigation
- On sign‑in or root landing:
  1.  Use last_org cookie if valid
  2.  Else use User.defaultOrganizationId if present
  3.  Else org picker or onboarding

Keep this logic server‑side where possible; pass the chosen org context to the client shell.

## API Endpoints (portable contracts)

All routes: Node runtime (DB/secrets), JWT auth required, CSRF on mutating methods, JSON responses, audit key actions. The names mirror this repo for easy reuse.

1. GET /api/orgs

- Purpose: list organizations for current user; superadmin sees all
- Response: { organizations: Array<{ id, name, slug, role, createdAt, updatedAt }> }

2. POST /api/orgs

- Purpose: create organization
- Body: { name: string; slug?: string }
- Errors: 401 unauthorized; 403 creation disabled; 400 limit exceeded; 400 slug invalid/taken; 500
- Response: 201 { organization: { id, name, slug, createdAt } }

3. GET /api/orgs/[orgSlug]

- Purpose: fetch org details; requires admin or superadmin
- Response: { id, name, slug, createdAt, updatedAt }

4. PATCH /api/orgs/[orgSlug]

- Purpose: update org (name, and slug if allowed)
- Body: { name?: string; slug?: string }
- Errors: 403 if slug change and not superadmin; 400 validation; 404 not found; 500
- Response: { organization: { id, name, slug, updatedAt } }

5. DELETE /api/orgs/[orgSlug]

- Purpose: delete org (superadmin only)
- Response: { success: true }

6. GET /api/orgs/[orgSlug]/members

- Purpose: list members (paginated)
- Query: page=1, pageSize∈{10,20,50}, excludeSuperadmins?=true
- Response: { members: Array<{ id, email, name, role, joinedAt }>, total, adminCount, page, pageSize, totalPages }

7. PATCH /api/orgs/[orgSlug]/members/[userId]

- Purpose: change member role and/or name
- Body: { role?: "admin"|"member"; name?: string }
- Constraints: prevent self‑demotion if not superadmin; block demoting last admin; audit role changes
- Response: { success: true }

8. DELETE /api/orgs/[orgSlug]/members/[userId]

- Purpose: remove a member; users may leave themselves unless last admin; clear defaultOrganizationId if removed
- Response: { success: true }

9. GET /api/orgs/[orgSlug]/invitations

- Purpose: list pending invitations for org
- Response: { invitations: Array<{ id, email, name?, role, expiresAt, invitedBy, invitedByName?, createdAt }> }

10. POST /api/orgs/[orgSlug]/invitations

- Purpose: create an invitation
- Body: { email: string; role: "admin"|"member"; name?: string; sendEmail?: boolean }
- Rate limits: org/day and IP/15m; audit "member_invited"
- Response: 201 { invitation: { id, email, role, name?, expiresAt, inviteUrl, sent } }

11. DELETE /api/orgs/[orgSlug]/invitations/[id]

- Purpose: revoke invitation
- Response: { success: true }

12. POST /api/orgs/[orgSlug]/invitations/[id]/resend

- Purpose: resend an invitation (new token + expiry)
- Response: { invitation: { id, email, role, expiresAt, inviteUrl, sent } }

13. GET /api/orgs/invitations/validate?token=...

- Purpose: validate invitation token; optional membership status if authenticated
- Response: { valid: boolean; invitation?: { id, orgId, orgSlug, orgName, email, role, expiresAt }; alreadyMember?: boolean; userIsSuperadmin?: boolean }

14. POST /api/orgs/invitations/accept

- Purpose: accept invitation (must match signed‑in user email)
- Body: { token: string }
- Response: { message, organization: { id, name, slug } } | { message, alreadyMember: true, organization }

## Helpers (portable implementations)

Server‑only helpers you can transplant and adapt:

- Slug & org helpers
  - getOrgBySlug(slug) → Organization | null
  - generateUniqueSlug(name)
  - validateSlug(slug): { valid, error? }
  - isReservedSlug(slug): boolean
- Membership & permissions
  - getUserMembership(userId, orgId) → Membership | null
  - requireMembership / requireAdmin / requireAdminOrSuperadmin
  - isSuperadmin(userId): boolean
  - isLastAdmin(userId, orgId): boolean
- Tenant scoping
  - scopeTenant(where, orgId): appends organizationId
- Invitation helpers
  - generateInvitationToken(): { token, tokenHash }
  - verifyInvitationToken(token, tokenHash): boolean
  - validateInvitationToken(token): { valid, error?, invitation? }
  - checkOrgInviteRateLimit(orgId)
  - checkIpInviteRateLimit(ip)
  - getClientIp(request)

## Security Guardrails

- Runtime: export const runtime = "nodejs" on routes that touch DB/secrets (never Edge for DB)
- AuthZ: verify admin/superadmin for org management; normal users must be members to access tenant data
- CSRF: validate Origin/Referer on all mutating routes; maintain allowlist based on APP_URL (+ optional ALLOWED_ORIGINS)
- Rate limits: enforce conservative invite limits; attach Retry‑After where applicable
- Audit logging: record all key actions (org create/update/delete, member invite/role change/remove, invite accept/revoke/resend) with metadata and IP
- Error hygiene: generic copy for sensitive flows; never leak token values or internal IDs unnecessarily

## Admin vs Superadmin Matrix (summary)

- Admin (org‑scoped): manage members and invitations in their org; update org name; cannot change slug by default; cannot delete org; cannot demote/remove last admin; cannot self‑demote/remove if last admin.
- Superadmin (global): read/write across all orgs; can change slugs and delete orgs; bypass creation toggles/limits; membership not required; all actions audited.

## UI Placement and Patterns

- Protected server layouts resolve `currentOrg` and render a client `DashboardShell` with props like sections/pages/currentOrg
- Sidebar and top‑bar can include an org switcher; on switch, set LAST_ORG_COOKIE_NAME and route to /o/[orgSlug]/...
- Onboarding: if user has no orgs, show create/join; respect ORG_CREATION_ENABLED and surface helpful messaging

## Variants and Extensions

- Subdomain tenants: {slug}.yourapp.com — infra and cookie complexity; stricter CSRF strategy
- Owner role: add immutable owner per org with transfer protocol; last‑owner logic supersedes last‑admin logic
- Soft delete: mark org deletedAt and hide by default; allow restore within retention window
- Billing: gate org creation with plan limits; owners/admins manage plan; superadmin billing overrides
- SSO per tenant: store IdP config per org and enforce on login flows

## Testing & Edge Cases

- Invitation acceptance with mismatched email → 403
- Demote/remove last admin → 400 (guard)
- Self‑demotion/removal as admin (non‑superadmin) → 400 (guard)
- Slug collisions/reserved slugs → 400
- Org creation disabled/limit exceeded → 403/400
- Membership pagination & excludeSuperadmins flag
- Deleting org clears users’ defaultOrganizationId
- Remember last org via cookie; fallback to default org/picker

## Minimal Implementation Checklist

- [ ] Schema: Organization, Membership, Invitation, AuditLog; add organizationId to tenant tables
- [ ] Env: ORG_CREATION_ENABLED, ORG_CREATION_LIMIT, INVITE_EXP_MINUTES, INVITES_PER_ORG_PER_DAY, INVITES_PER_IP_15M, ORG_RESERVED_SLUGS, LAST_ORG_COOKIE_NAME
- [ ] Helpers: permissions, slugs, scoping, invitations, rate limits, IP extraction
- [ ] Routes: orgs CRUD, members, invitations, validate/accept; Node runtime + CSRF + audits
- [ ] Middleware: JWT signature guard; deeper auth in server components/routes
- [ ] UI: org switcher, members/invites/admin screens under /o/[orgSlug]
- [ ] Audits: all key actions with metadata, email/ip; structured and queryable
- [ ] Docs: onboarding flow, superadmin seed/management, reserved slugs, rate limits

## Superadmin Seeding & Operations

- Seed a superadmin via a script (e.g., `scripts/seed-superadmin.ts`) or promote an existing user by setting User.role = "superadmin".
- Limit access to this script; record an audit entry like "superadmin_seeded" or "superadmin_promoted" with context.
- UI: provide an Admin area where superadmins can search and jump into any org context quickly.

---

This document is intentionally generic and aligns with secure, server‑first patterns you can adopt across Next.js apps. It emphasizes simple roles, strict guards, strong audits, and ergonomic tenant routing so you can scale features without compromising isolation or operability.
