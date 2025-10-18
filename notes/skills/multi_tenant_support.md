# Multi‑Tenant Support (Reusable for Next.js App Router)

This guide documents a portable, production‑ready pattern for adding multi‑tenant Organizations, Memberships, and Invitations to any Next.js App Router app. It mirrors the implementation in this repo but is provider‑agnostic and easy to adapt.

## Overview

- Tenancy boundary: Organization (path‑based routing under `/o/[orgSlug]`)
- Users can belong to multiple organizations via Memberships
- Admins invite members via email tokens; invite acceptance requires sign‑in and matching email
- Roles: `member` and `admin` (org‑scoped) plus `superadmin` (global)
- Superadmin has global read/write access, can create/delete orgs, and bypasses allowlist/signup/creation limits
- Strong guardrails: CSRF checks, rate limits, slug validation, reserved words, last‑admin protection, audit logs

## Baseline and Principles

- Next.js App Router + React + TypeScript (strict)
- Server‑first: DB/secrets only in Node runtime API routes and server components
- JWT sessions in httpOnly cookies; short‑lived access + long‑lived refresh
- Security: CSRF Origin/Referer allowlist, audited mutations, conservative rate limits
- Portability: minimal assumptions; email provider optional (invite link can be copied in UI)

## Success Criteria

- Organization‑scoped URLs under `/o/[orgSlug]/*` with SSR membership checks
- Clean redirects from `/` → last org → default org → first membership → onboarding/denial
- Admin can manage org name, members, roles, and invitations; cannot remove/demote last admin
- Superadmin has a dedicated `/admin` area to view/edit any org and delete orgs when needed
- Data isolation: all reads/writes for tenant data scoped by `organizationId`

## Data Model (Prisma sketch)

Keep names generic so you can port this across apps.

```prisma
model Organization {
  id          String   @id @default(cuid())
  name        String   @db.VarChar(255)
  slug        String   @unique @db.VarChar(50)
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  createdBy   User           @relation(fields: [createdById], references: [id], onDelete: Restrict)
  memberships Membership[]
  invitations Invitation[]
  auditLogs   AuditLog[]
}

model Membership {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  role           String   @db.VarChar(20) // "admin" | "member"
  createdAt      DateTime @default(now())

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, organizationId])
}

model Invitation {
  id             String    @id @default(cuid())
  organizationId String
  email          String    @db.VarChar(255)
  name           String?   @db.VarChar(255)
  role           String    @db.VarChar(20) // "admin" | "member"
  tokenHash      String    @db.VarChar(255)
  expiresAt      DateTime
  invitedById    String
  acceptedAt     DateTime?
  revokedAt      DateTime?
  createdAt      DateTime  @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  invitedBy    User         @relation(fields: [invitedById], references: [id], onDelete: Restrict)

  @@index([organizationId, email])
  @@index([email, acceptedAt, revokedAt])
}
```

Notes

- Invitations: app enforces “one active (org,email)” at write time; you can add a partial unique index if your database supports it.
- User may have an optional `defaultOrganizationId` to speed up redirects.

## Environment & Toggles

Recommended env (names can be adjusted to match your app):

- ORG_CREATION_ENABLED: "false" | "true" — regular users can create orgs when true
- ORG_CREATION_LIMIT: integer — max orgs a user can create; superadmin bypasses
- INVITE_EXP_MINUTES: integer — invite expiry (e.g., 10080 for 7 days)
- INVITES_PER_ORG_PER_DAY: integer — org‑level invite cap
- INVITES_PER_IP_15M: integer — per‑IP burst cap for invite creation
- ORG_RESERVED_SLUGS: comma‑sep list — reserved words (e.g., o,api,dashboard,settings,login,...)
- LAST_ORG_COOKIE_NAME: string — cookie used to remember last visited org (e.g., "\_\_last_org")

Integration notes

- Respect your auth toggles (allowlist/signup) and treat superadmin as a bypass for those gates.
- All mutating routes must validate CSRF (Origin/Referer allowlist) before reading the body.

## Routing & Redirect Logic

- Tenant scope lives under `/o/[orgSlug]/*`.
- Server layouts validate the session and membership (superadmin bypass) before rendering.
- Visiting `/` (or `/dashboard`) should run this redirect sequence:
  1. `__last_org` cookie → if org exists and user has access (or superadmin) → redirect
  2. `defaultOrganizationId` → redirect if accessible
  3. First membership by createdAt → redirect
  4. If superadmin: any org in system; else, continue
  5. If user can create orgs → `/onboarding/create-organization`
  6. Otherwise → show a denial screen with guidance

## Roles & Permissions

- member: read org content, update own profile
- admin: everything in member + manage organization settings, members, and invitations
- superadmin: global admin across all organizations; can create/delete orgs and bypass creation limits and auth gates
- Last admin protection: cannot remove or demote the final admin in an org

## Tenant Isolation Strategy

- Derive the active org from the request path on the server; never trust a client‑provided `organizationId`.
- Verify membership for the current user; superadmin bypasses.
- Scope reads/writes with `organizationId`:

```ts
// Minimal helper to scope Prisma queries
export function scopeTenant<T extends Record<string, unknown>>(
  where: T,
  orgId: string
) {
  return { ...where, organizationId: orgId } as T & { organizationId: string };
}
```

Considerations

- One database with an `organizationId` FK is the simplest, most portable default.
- Row‑Level Security or per‑tenant schemas are advanced options; include them only as an appendix if you adopt them.

## Slugs: Validation and Immutability

- Policy: slugs are immutable once created (safer links, better caching).
- Format: kebab‑case, 1–50 chars, lowercase alphanumeric plus hyphens; cannot start/end with `-`.
- Maintain a reserved list via env to avoid collisions with public routes.
- Generate unique slugs from the organization name; if taken/reserved, append a short random suffix.

## Invitations (Email Token Flow)

- Admins create invites with role and optional name.
- Token: 32‑byte random hex, stored as a bcrypt hash; plaintext token is only shown once in the invite URL.
- Expiry: configured via `INVITE_EXP_MINUTES`.
- Rate limits: per‑org/day and per‑IP/15m on creation.
- Acceptance: requires an authenticated session; invited email must match the signed‑in user’s email; creates membership and marks invite accepted; optional name applied if the user has no name.

Email delivery

- Keep provider‑agnostic. Provide an `EmailSender` abstraction and optionally wire Resend/SES/SMTP. Always support “copy invite link”.

## API Endpoints (Node runtime)

Organization management

```http
GET    /api/orgs                         # List orgs for user (superadmin sees all)
POST   /api/orgs                         # Create org (policy‑gated)
PATCH  /api/orgs/[orgSlug]               # Update org (admin or superadmin)
DELETE /api/orgs/[orgSlug]               # Delete org (superadmin only)
```

Member management

```http
GET    /api/orgs/[orgSlug]/members               # List members (admin/superadmin)
PATCH  /api/orgs/[orgSlug]/members/[userId]      # Update role/name (admin/superadmin; last‑admin safe)
DELETE /api/orgs/[orgSlug]/members/[userId]      # Remove member or self‑leave (last‑admin safe)
```

Invitation management

```http
GET    /api/orgs/[orgSlug]/invitations           # List pending invites (admin/superadmin)
POST   /api/orgs/[orgSlug]/invitations           # Create invite (rate‑limited; optional email send)
DELETE /api/orgs/[orgSlug]/invitations/[id]      # Revoke invite (admin/superadmin)
POST   /api/orgs/invitations/accept              # Accept invite (requires auth; email must match)
```

Security notes

- Export `runtime = "nodejs"` for all routes touching DB/secrets.
- Validate CSRF on every mutating route before reading the body.
- Return structured errors and record audit logs for all mutations.

## Server Helpers (portable contracts)

Recommended helpers to copy:

```ts
// Retrieval
getOrgBySlug(slug: string): Promise<Organization | null>
getUserMembership(userId: string, orgId: string): Promise<Membership | null>
getUserOrganizations(userId: string): Promise<Array<{ id; name; slug; role; createdAt }>>

// Authorization
isSuperadmin(userId: string): Promise<boolean>
requireMembership(userId: string, orgId: string): Promise<Membership>
requireAdmin(userId: string, orgId: string): Promise<Membership>
requireAdminOrSuperadmin(userId: string, orgId: string): Promise<Membership | null>
isLastAdmin(userId: string, orgId: string): Promise<boolean>

// Slugs
validateSlug(slug: string): { valid: boolean; error?: string }
isReservedSlug(slug: string): boolean
generateUniqueSlug(baseName: string): Promise<string>
```

## Admin Area (Superadmin)

- Add a protected `/admin` area restricted to superadmins:
  - Organizations list with search/sort/pagination
  - Organization detail: members with edit/remove, invite shortcut, delete organization
  - Use the same APIs as org admins; only deletion is superadmin‑only

## Org Switcher and Shell

- In your protected org layout (`/o/[orgSlug]/layout.tsx`), fetch user, org, and membership on the server and pass serializable props into a client shell.
- Provide an org switcher that lists accessible orgs; include “Create organization” only when policy allows or when superadmin.
- Remember last visited org in `LAST_ORG_COOKIE_NAME` to improve future redirects.

## Audit Logging (suggested catalog)

- org_create, org_updated, org_deleted
- member_invited, invite_revoked, invite_accepted
- member_role_changed, member_removed, member_left
- org_create_denied (policy blocks), plus generic error events as needed

## Rate Limits and CSRF

- Apply per‑email/IP caps for invitation creation; return 429 with a friendly message and Retry‑After if applicable.
- Validate CSRF on all POST/PATCH/DELETE; compare Origin/Referer to an allowlist.

## Porting Checklist (step‑by‑step)

1. Models
   - Add Organization, Membership, Invitation; consider `defaultOrganizationId` on User
   - Migrate and generate client
2. Environment
   - Add toggles for org creation, invite expiry/limits, reserved slugs, last‑org cookie
3. Helpers
   - Copy or re‑implement: org helpers (membership checks, last‑admin guard, slug helpers, scopeTenant)
   - Wire into your existing auth/session helpers
4. Middleware/Layouts
   - Keep JWT verification in middleware for routing; do org/membership checks server‑side in layouts
5. API routes (Node runtime)
   - Implement orgs, members, invitations, accept invite; add CSRF and audit logs
6. Pages/UI
   - Org layout under `/o/[orgSlug]` with a dashboard shell and settings pages
   - Org settings: name (slug read‑only), members (list/edit/remove), invitations (list/send/revoke)
   - Admin area: organizations list/detail; delete org
7. Email (optional)
   - Add an EmailSender abstraction; support copyable invite links regardless of provider state
8. Redirects
   - Implement root redirect chain and last‑org cookie updates on navigation
9. Seeding/Access
   - Seed a superadmin user for ops; document how to promote/demote in emergencies
10. Tests
    - Add unit tests for slug validation and scopeTenant
    - Add API tests for membership checks, last‑admin protection, invite accept edge cases

## Edge Cases to Validate

- Attempt to demote/remove the last admin → blocked with a clear error
- Invite for an existing member → blocked with 400
- Accept invite with a different signed‑in email → 403 with guidance
- Org creation disabled or limit reached → clear denial path + audit
- Reserved/taken slug on create/update → validation errors
- Superadmin browsing org w/o membership → allowed; role displayed as "superadmin"

## Optional Appendices

- Extending roles/permissions (policy‑based checks)
- Subdomain or custom domain per org (wildcard DNS + cookie/domain considerations)
- Row‑Level Security patterns with Prisma caveats

---

Build | Lint/Typecheck | Tests: PASS (docs‑only changes). If you later add code per this guide, run your usual build/test suites.
