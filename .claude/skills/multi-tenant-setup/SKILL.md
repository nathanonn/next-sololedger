---
name: multi-tenant-setup
description: This skill should be used when setting up production-ready multi-tenant support with Organizations, Memberships, Invitations, and Superadmin role in a Next.js App Router application. Use this skill when implementing tenant isolation, role-based permissions, invitation flows, or converting a single-tenant app to multi-tenant. Includes complete schema, API routes, helpers, security guardrails, and UI patterns for reusable multi-tenant architecture.
---

# Multi-Tenant Support Setup

Set up a complete, production-ready multi-tenant architecture with Organizations, Memberships, Invitations, and global Superadmin role. This skill implements path-based tenant routing (`/o/[orgSlug]/...`), secure invitation flows, last admin protection, and comprehensive audit logging.

## Purpose

Transform a Next.js App Router application into a multi-tenant system where:

- Users can belong to multiple organizations with role-based permissions
- Organizations are isolated with slug-based routing and data scoping
- Admins manage members and send email invitations
- Superadmins operate globally across all organizations
- All tenant data is strictly isolated by `organizationId`
- Security guardrails prevent orphaning organizations

## When to Use This Skill

Invoke this skill when:

- "Add multi-tenant support to my Next.js app"
- "Implement organizations with admin and member roles"
- "Set up invitation system for organizations"
- "Add superadmin role with global access"
- "Convert my single-tenant app to multi-tenant"
- "Implement team/workspace functionality"

## Architecture Overview

**Tenant Routing:** Path-based `/o/[orgSlug]/...`

**Roles:**
- **Global:** `superadmin` (full operator access across all orgs)
- **Organization:** `admin` (manage members, invitations, org settings), `member` (standard access)

**Key Features:**
- Slug-based org identification (kebab-case, reserved list, unique)
- Invitation system with bcrypt-hashed tokens and expiry
- Last admin protection (cannot demote/remove last admin)
- Default org + last_org cookie for UX
- Rate limiting on invitations (per-org/day, per-IP/15m)
- Comprehensive audit logging
- Data isolation via `organizationId` foreign key

## Implementation Workflow

### Step 1: Review Architecture Documents

Before implementing, review the complete multi-tenant architecture:

1. **Read `references/schema.md`** for database models and Prisma schema
2. **Read `references/helpers.md`** for server-only helper functions
3. **Read `references/api_endpoints.md`** for API route contracts
4. **Read `references/security_checklist.md`** for security requirements

These references contain detailed implementation patterns that align with the existing codebase authentication system.

### Step 2: Environment Configuration

1. **Read `assets/env_additions.txt`** for all required environment variables
2. Add the environment variables to the project's `.env` file
3. Update `lib/env.ts` to validate the new multi-tenant variables with Zod:

```typescript
// Add to lib/env.ts
export const env = z.object({
  // ... existing vars

  // Multi-tenant
  ORG_CREATION_ENABLED: z.string().transform(v => v === 'true'),
  ORG_CREATION_LIMIT: z.string().transform(v => parseInt(v, 10)).default('5'),
  ORG_RESERVED_SLUGS: z.string().default('o,api,dashboard,settings,login,invite,onboarding,_next,assets,auth,public'),
  LAST_ORG_COOKIE_NAME: z.string().default('__last_org'),
  INVITE_EXP_MINUTES: z.string().transform(v => parseInt(v, 10)).default('10080'),
  INVITES_PER_ORG_PER_DAY: z.string().transform(v => parseInt(v, 10)).default('50'),
  INVITES_PER_IP_15M: z.string().transform(v => parseInt(v, 10)).default('5'),
}).parse(process.env)
```

### Step 3: Database Schema Migration

1. **Copy schema from `references/schema.md`** and add models to `prisma/schema.prisma`:
   - `Organization` model (with slug, name, creator)
   - `Membership` model (userId, organizationId, role)
   - `Invitation` model (email, tokenHash, expiry, org)
   - Update `User` model with `role`, `defaultOrganizationId`, and relations
   - Update `AuditLog` model with `organizationId` field

2. Generate Prisma client and migrate:

```bash
npx prisma generate
npx prisma migrate dev --name add_multi_tenant_support
```

3. Verify schema in Prisma Studio:

```bash
npx prisma studio
```

### Step 4: Implement Server-Only Helpers

Create `lib/multi-tenant/` directory and implement all helper functions from `references/helpers.md`:

**Required helper files:**
- `lib/multi-tenant/slugs.ts` - Slug validation, generation, reserved list
- `lib/multi-tenant/permissions.ts` - Permission checking (membership, admin, superadmin, last admin)
- `lib/multi-tenant/scoping.ts` - Tenant data scoping (`scopeTenant` helper)
- `lib/multi-tenant/invitations.ts` - Token generation/validation, rate limiting, IP extraction
- `lib/multi-tenant/organizations.ts` - Org creation permissions, user org lists

**Critical implementation notes:**
- All helpers are server-only (never imported into client components)
- Use bcrypt for invitation token hashing (never store plain tokens)
- Enforce reserved slugs via environment configuration
- Superadmin bypasses membership checks but queries are still scoped explicitly

### Step 5: Implement API Routes

Implement all API endpoints following the contracts in `references/api_endpoints.md`:

**Organization endpoints:**
- `app/api/orgs/route.ts` - GET (list user's orgs), POST (create org)
- `app/api/orgs/[orgSlug]/route.ts` - GET (fetch org), PATCH (update), DELETE (superadmin only)

**Member endpoints:**
- `app/api/orgs/[orgSlug]/members/route.ts` - GET (list members with pagination)
- `app/api/orgs/[orgSlug]/members/[userId]/route.ts` - PATCH (change role), DELETE (remove member)

**Invitation endpoints:**
- `app/api/orgs/[orgSlug]/invitations/route.ts` - GET (list pending), POST (create invite)
- `app/api/orgs/[orgSlug]/invitations/[id]/route.ts` - DELETE (revoke)
- `app/api/orgs/[orgSlug]/invitations/[id]/resend/route.ts` - POST (resend with new token)
- `app/api/orgs/invitations/validate/route.ts` - GET (public, validate token)
- `app/api/orgs/invitations/accept/route.ts` - POST (accept invitation)

**Implementation requirements:**
- All routes: `export const runtime = "nodejs"` (Node runtime for DB access)
- All mutating routes: CSRF validation via `validateCSRF(req)` from `lib/csrf.ts`
- All routes: JWT authentication via `getCurrentUser()` from `lib/auth-helpers.ts`
- All actions: Audit logging to `AuditLog` model

**Reference `references/api_endpoints.md`** for complete implementation templates with error handling, validation, and security checks.

### Step 6: Implement UI Components and Screens

**Org Switcher (Top Bar):**
- Create `components/features/org-switcher.tsx` as a combobox (shadcn/ui)
- Show current org, allow typedown search, switch on select
- Set `LAST_ORG_COOKIE_NAME` cookie on switch
- Redirect to `/o/[orgSlug]/...` on selection
- Include in desktop top bar and mobile drawer

**Org Picker/List:**
- Create `app/(protected)/organizations/page.tsx`
- List user's orgs with actions: [Go to], [Set default], [Leave]
- Show [Create organization] button if `ORG_CREATION_ENABLED`
- Implement create org modal (name + optional slug)
- Handle leave confirmation with last admin check
- Empty state: "No organizations" with CTA

**Org Settings - General Tab:**
- Create `app/(protected)/o/[orgSlug]/settings/organization/page.tsx`
- Name edit form (admin or superadmin)
- Slug field (read-only for admin, editable for superadmin)
- Danger Zone: Delete button (superadmin only)
- Delete confirmation modal: type org name to confirm

**Org Settings - Members Tab:**
- Members table with pagination (10, 20, 50 per page)
- Columns: Name, Email, Role, Joined, Actions
- Actions: [Edit] (modal: change name/role), [Remove] (confirmation)
- [Invite Member] button → modal (email, name?, role, sendEmail?)
- Pending Invitations section: table with [Resend], [Revoke] actions
- Mobile: horizontal scroll, sticky header, row menu for actions

**Accept Invitation (Public):**
- Create `app/(public)/invite/page.tsx`
- Extract token from query params: `/invite?token=...`
- Validate token via `GET /api/orgs/invitations/validate`
- Show org name, role, expiry
- Handle states: valid, expired, revoked, email mismatch, already member
- Require user to be signed in
- [Accept] button → POST to `/api/orgs/invitations/accept`
- Redirect to org on success

**Superadmin Screens:**
- `app/(protected)/admin/organizations/page.tsx` - All orgs table
  - Columns: Name, Slug, Members, Created, Updated
  - Actions: [View] (jump to org), [Edit] (change name/slug)
  - Search by name/slug, pagination
- `app/(protected)/admin/users/page.tsx` - All users table
  - Columns: Email, Name, Role, Orgs (count), Created
  - Action: [View] (show user details)
  - Search by email/name, pagination

### Step 7: Update Landing and Routing Logic

**Protected Layout:**
- Update `app/(protected)/layout.tsx` to resolve org from `[orgSlug]` param
- Fetch org server-side, verify user has membership (or is superadmin)
- Pass org context to `DashboardShell` as props
- Return 404 if org not found or no access

**Root Landing Logic:**
- Create or update `app/page.tsx` for authenticated root access
- Check `LAST_ORG_COOKIE_NAME` cookie → redirect to that org if user has access
- Else check `user.defaultOrganizationId` → redirect if exists
- Else redirect to org picker (`/organizations`)

**Middleware:**
- Update `middleware.ts` to allow public `/invite` route (no auth required)
- Keep existing JWT signature validation for protected routes

### Step 8: Seed Superadmin

1. **Copy `scripts/seed-superadmin.ts`** to project root `scripts/` directory
2. Ensure `tsx` is installed: `npm install -D tsx`
3. Run the seed script:

```bash
tsx scripts/seed-superadmin.ts
```

4. Follow prompts to create or promote a superadmin user
5. Verify the user has `role: "superadmin"` in database
6. Add superadmin email to `ALLOWED_EMAILS` in `.env`

**Security note:** Restrict access to this script in production; consider deleting or securing after initial setup.

### Step 9: Security Audit

Use `references/security_checklist.md` to verify all security requirements:

**Critical checks:**
- [ ] All API routes use `runtime = "nodejs"`
- [ ] All mutating endpoints validate CSRF
- [ ] All tenant data queries use `scopeTenant()` helper
- [ ] Last admin protection enforced (cannot demote/remove)
- [ ] Invitation tokens are bcrypt hashed (never plain text)
- [ ] Rate limits enforced (per-org/day, per-IP/15m)
- [ ] Audit logging complete for all key actions
- [ ] Reserved slugs enforced
- [ ] Cookies are httpOnly + secure (production)

### Step 10: Testing and Validation

**Reference `assets/migration_checklist.md`** for comprehensive testing checklist covering:

- Edge cases (last admin, expired invites, slug collisions)
- Rate limiting (org/day, IP/15m)
- Permission enforcement (admin, member, superadmin)
- Invitation flows (email match, already member, revoked)
- Org lifecycle (create, update, delete, cascades)
- Cookie persistence (last_org, defaultOrganizationId fallback)

**Quick validation flows:**
1. User creates org → becomes admin → invites member
2. Member accepts invite → joins org → appears in members list
3. Admin changes member role → audit logged
4. Admin tries to remove last admin → blocked
5. Superadmin deletes org → cascades memberships → clears defaultOrganizationId
6. User switches orgs → last_org cookie updated

## Bundled Resources Reference

**Scripts:**
- `scripts/seed-superadmin.ts` - Interactive script to create/promote superadmin user

**References (load as needed):**
- `references/schema.md` - Complete Prisma schema with indexes and relations
- `references/helpers.md` - All server-only helper functions with usage examples
- `references/api_endpoints.md` - API route contracts, request/response formats, implementation templates
- `references/security_checklist.md` - Comprehensive security requirements and edge case testing

**Assets (use in output):**
- `assets/env_additions.txt` - All environment variables with descriptions
- `assets/migration_checklist.md` - Step-by-step implementation checklist (16 phases)

## Key Patterns and Best Practices

**Server-First Approach:**
- All DB queries and permission checks happen server-side
- Client components receive props only (no direct DB access)
- API routes use Node runtime, never Edge (for DB access)

**Data Isolation:**
- Every tenant-owned table has `organizationId` foreign key
- Use `scopeTenant(where, orgId)` helper to enforce scoping
- Never query tenant data without explicit `organizationId` filter
- Superadmin queries are still explicitly scoped (no implicit global access)

**Permission Enforcement:**
- Use helper functions: `requireMembership()`, `requireAdmin()`, `requireAdminOrSuperadmin()`
- Check `isLastAdmin()` before any demote/remove operation
- Superadmin bypasses membership checks but not data scoping

**Invitation Security:**
- Generate 32-byte random hex tokens
- Store only bcrypt hash (12 rounds)
- Compare tokens with `bcrypt.compareSync()` on validation
- Expire after `INVITE_EXP_MINUTES` (default 7 days)
- Require authenticated user with matching email to accept

**Audit Logging:**
- Log all org lifecycle events: `org_created`, `org_updated`, `org_deleted`
- Log all member events: `member_invited`, `member_role_changed`, `member_removed`
- Log invitation events: `invite_accepted`, `invite_revoked`, `invite_resend`
- Include metadata: userId, email, IP, organizationId, deltas

**Error Handling:**
- Generic messages for auth failures (don't leak info)
- Never expose token values or internal IDs in errors
- Return structured JSON errors with safe user-facing messages
- Log internal errors for debugging (without secrets)

## Variants and Extensions

**Subdomain Routing:**
To use `{slug}.yourapp.com` instead of `/o/[orgSlug]`:
- Configure wildcard DNS
- Update CSRF validation for multi-domain
- Adjust cookie partitioning strategy

**Owner Role:**
Add immutable owner per org:
- Add `ownerId` to Organization model
- Implement transfer protocol
- Update last-owner logic (supersedes last-admin)

**Soft Delete:**
Mark orgs as deleted instead of hard delete:
- Add `deletedAt` to Organization model
- Filter out deleted orgs in queries
- Allow restore within retention window

**Billing Integration:**
Gate org creation with plan limits:
- Add `planId` to Organization or User
- Check plan limits in `canCreateOrganization()`
- Allow admins to manage billing

## Troubleshooting

**"Slug already taken" error:**
- Check if slug is in reserved list (`ORG_RESERVED_SLUGS`)
- Verify slug uniqueness in database
- Use `generateUniqueSlug()` to auto-generate

**"Cannot remove last admin" error:**
- Verify admin count with `isLastAdmin()` helper
- Promote another member to admin first
- Or use superadmin to delete entire org

**Rate limit errors (429):**
- Check `INVITES_PER_ORG_PER_DAY` and `INVITES_PER_IP_15M` limits
- Review audit logs for invitation creation timestamps
- Adjust limits in environment if needed

**Invitation email mismatch:**
- User must sign in with the exact email from invitation
- Check email normalization (lowercase, trim)
- Provide "Sign out" CTA if wrong user is signed in

**Org not found after creation:**
- Verify `defaultOrganizationId` was set on User
- Check `LAST_ORG_COOKIE_NAME` cookie exists
- Ensure org switcher queries user's memberships

## Success Criteria

Multi-tenant support is complete when:

- [ ] Users can create and join multiple organizations
- [ ] Admins can invite members and manage roles
- [ ] Invitations work end-to-end (send, validate, accept)
- [ ] Last admin cannot be demoted or removed
- [ ] Superadmin can access and manage all orgs
- [ ] Org switcher works on desktop and mobile
- [ ] All tenant data is scoped by `organizationId`
- [ ] Security checklist is fully validated
- [ ] Audit logs capture all key actions
- [ ] All edge cases are tested and handled

---

This skill provides a complete, portable multi-tenant architecture that can be reused across Next.js App Router applications. It emphasizes security, strict data isolation, ergonomic UX, and comprehensive audit trails.
