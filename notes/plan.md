Implement Organizations, Memberships, and Invitations with strict org-scoped data and server-side guards. Move protected app under /o/[orgSlug]/..., resolve org context from the path, add an org switcher, and provide admin member/invite management. Backfill creates a default org per existing user (admin). Invitations bypass allowlist, are expiring, require signed-in user with matching email, and enforce rate limits. Slugs are immutable, user-chosen at creation, globally unique, and auto-suggested.

Plan

1) Database (Prisma)
- New models:
  - Organization: id, name, slug (unique, immutable), createdById→User, createdAt, updatedAt.
  - Membership: id, userId→User, organizationId→Organization, role ("admin" | "member"), createdAt, @@unique([userId, organizationId]).
  - Invitation: id, organizationId, email, role, tokenHash, expiresAt, invitedById→User, acceptedAt?, revokedAt?, createdAt.
  - AuditLog: add optional organizationId→Organization (indexed) for org actions.
  - User: add defaultOrganizationId→Organization (nullable, indexed).
- DB constraints and indexes:
  - Organization.slug: unique, kebab-case, <=50 chars, not in reserved list from env.
  - Invitation: one active invite per (organizationId, email) via partial unique index (acceptedAt IS NULL AND revokedAt IS NULL). Implement with raw SQL migration.
  - Add composite indexes on tenant tables: e.g., @@index([organizationId, createdAt]).
- ENV:
  - INVITE_EXP_MINUTES=10080 (7 days), INVITES_PER_ORG_PER_DAY=20, INVITES_PER_IP_15M=5.
  - ORG_RESERVED_SLUGS="o,api,dashboard,settings,login,invite,_next,assets" (extendable).
  - LAST_ORG_COOKIE_NAME="__last_org" (httpOnly, SameSite=Strict, Secure in prod, maxAge 30d).

2) Slug and onboarding
- Slug policy: immutable, user-provided at creation (checked for uniqueness and reserved words). Format: kebab-case, <=50 chars.
- New-user onboarding: force “Create organization” step after OTP and before entering app.
  - Prefill name: "{UserName}’s workspace"; slug: "{username}-workspace"; if taken, append "-{randomAlphaNum}".
- Existing users backfill: same naming; on collision, append "-{randomAlphaNum}".

3) Routing and org context
- Move protected pages under /o/[orgSlug]/...
  - /o/[org]/dashboard, /o/[org]/settings/{profile,organization,members}, etc.
- Root redirects: “/”, “/dashboard”, “/settings/*” → resolve last_org cookie → defaultOrganizationId → first membership → /o/[slug]/dashboard.
- middleware.ts: treat /o/ as protected (signature-only JWT check). Authorization occurs server-side (Node runtime).
- Server helpers (Node):
  - getOrgBySlug(slug), getUserMembership(userId, orgId), getCurrentUserAndOrg(pathname) → { user, org, membership }.
  - requireMembership(orgId) and requireAdmin(orgId), with last-admin guard.
  - scopeTenant(where, orgId) helper to enforce orgId filters in queries.
- Prisma guardrail: production extension/middleware that asserts orgId is present for tenant models’ reads/writes.

4) Backend APIs (Node runtime, CSRF + audit + rate limits)
- Org management:
  - POST /api/orgs { name, slug? } → validate, create org, add creator as admin, set defaultOrganizationId if unset; audit org_create.
  - GET /api/orgs → list user orgs with role.
- Members (admin only):
  - GET /api/orgs/[orgSlug]/members
  - PATCH /api/orgs/[orgSlug]/members/[userId] { role } (block last admin demotion); audit member_role_changed.
  - DELETE /api/orgs/[orgSlug]/members/[userId] (allow self-leave unless last admin); audit member_removed.
- Invitations (admin only):
  - POST /api/orgs/[orgSlug]/invitations { email, role } (bypass allowlist; enforce org/day and IP/15m limits); audit member_invited.
  - POST /api/orgs/[orgSlug]/invitations/[id]/resend (rotate token); audit invite_resend.
  - DELETE /api/orgs/[orgSlug]/invitations/[id] (revoke); audit invite_revoked.
  - POST /api/orgs/invitations/accept { token } (requires session; email must match; create membership if missing; consume invite); audit invite_accepted.

5) Invitations flow
- Token: random string; store bcrypt tokenHash; expiresAt = now + INVITE_EXP_MINUTES.
- Email (Resend) link: /invite?token=...; if not signed in, redirect to /login?next=/invite?token=...
- Accept: verify token (hash/expiry/not revoked), ensure session email matches invite email, create membership, mark acceptedAt.

6) Backfill migration (existing users)
- For each user without any membership:
  - Create Organization named "{UserName}’s workspace" with unique slug per rules.
  - Create Membership as admin.
  - Set User.defaultOrganizationId.
- Idempotent; skip users who already have memberships.

7) Data isolation and security
- All tenant queries must include organizationId; enforce via helpers and Prisma guard.
- Add organizationId to AuditLog for org actions.
- Prevent removing/demoting last admin; block self-leave if sole admin.
- Invitations bypass ALLOWED_EMAILS (OTP allowlist remains for open signup).
- Reserved slugs enforced via ORG_RESERVED_SLUGS.

8) UI/UX
- DashboardShell (components/features/dashboard/dashboard-shell.tsx): add org switcher in profile dropdown. Opens Command dialog listing orgs (searchable) with actions: Create org, Manage members.
- Pages:
  - /o/[org]/dashboard (move existing dashboard content)
  - /o/[org]/settings/organization: rename name (slug immutable), optional logo/theme later.
  - /o/[org]/settings/members: list members (role badges), change role, remove, invite form; pending invites list with resend/revoke.
  - /invite: accept screen (calls accept API; handles expired/invalid).
- Redirects: ensure old routes map to /o/[org]/ equivalents using last_org/defaultOrganizationId.

9) Testing
- Backfill correctness and initial redirects.
- Membership/role enforcement across pages and APIs (403 for non-members).
- Invitation lifecycle: create/resend/revoke/accept, expiry, wrong-email rejection.
- Rate limits on invites (org/day, IP/15m).
- Data isolation (no cross-org access) and AuditLog entries with organizationId.
- UI switcher behavior and deep-linking.

Decisions captured from you
- Org context: /o/[orgSlug]/... (explicit, SSR-friendly).
- Slugs: globally unique, immutable; user-chosen; for existing users auto-generated; collision handled by appending random alphanum.
- Onboarding: force “Create organization” step after OTP.
- Invitations: DB partial unique index accepted; emails bypass allowlist; basic email templates.
- Guardrails: add Prisma extension to assert orgId filters in prod; last_org cookie is httpOnly; reserved slugs list from env; rate limits via env.

Next steps (phased)
- Phase 1: Prisma schema + migrations (+ partial index SQL), helpers (org resolve/guards), backfill script.
- Phase 2: Routing move to /o/[org]/..., root redirects, update ProtectedLayout to resolve org context, adjust DashboardShell props.
- Phase 3: API endpoints (orgs, members, invitations) with CSRF/rate-limit/audit.
- Phase 4: UI (org switcher, members/invites pages, invite accept page), email templates.
- Phase 5: Hardening (Prisma guard, last-admin protections), tests.