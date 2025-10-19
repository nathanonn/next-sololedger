---
name: multi-tenant-setup
description: Set up production-ready multi-tenant support with Organizations, Memberships, Invitations, and Superadmin role in Next.js applications. Use when implementing tenant isolation, org-based access control, or SaaS architecture with multiple organizations per user.
---

# Multi-Tenant Setup

## Overview

This skill provides comprehensive guidance for implementing multi-tenant architecture in Next.js applications using the App Router. The implementation includes Organizations as tenant boundaries, role-based Memberships, email-based Invitations, and a global Superadmin role for platform management.

The multi-tenant system supports:
- Multiple organizations per user with role-based access (admin/member)
- Organization-scoped data isolation with security guardrails
- Email invitation workflow with token-based acceptance
- Superadmin role with global access and org management capabilities
- Path-based routing under `/o/[orgSlug]/*`
- Production security: CSRF protection, rate limiting, audit logging

## When to Use This Skill

Use this skill when implementing:
- SaaS applications requiring tenant isolation
- B2B platforms where users belong to multiple organizations
- Team collaboration tools with org-based workspaces
- Applications needing organization management with invitations
- Systems requiring superadmin oversight across all tenants

Trigger this skill when encountering requests like:
- "Add multi-tenant support to the application"
- "Implement organizations with memberships"
- "Set up tenant isolation for our SaaS product"
- "Add a superadmin role to manage all organizations"
- "Create organization invitation system"

## Implementation Workflow

This skill follows a six-phase sequential workflow. Complete each phase before moving to the next.

### Phase 1: Pre-Implementation Planning

Review existing codebase and prepare for multi-tenant implementation.

**Steps:**

1. **Verify Prerequisites**
   - Confirm PostgreSQL 15+ database is configured
   - Verify Prisma ORM is set up with working migrations
   - Ensure JWT authentication with sessions is implemented
   - Check CSRF protection helpers exist

2. **Review Reference Documentation**
   - Read `references/schema.md` to understand data model
   - Read `references/security_checklist.md` for security requirements
   - Review `references/api_endpoints.md` for API surface area
   - Scan `references/helpers.md` for required utility functions

3. **Plan Data Migration**
   - Back up database before proceeding
   - Review migration checklist in `assets/migration_checklist.md`
   - Identify any conflicts with existing User model fields
   - Plan downtime if running in production

4. **Configure Environment**
   - Copy environment variables from `assets/env_additions.txt` to `.env`
   - Set `ORG_CREATION_ENABLED` based on business policy (default: false)
   - Configure `ORG_CREATION_LIMIT` (default: 3 orgs per user)
   - Set `INVITE_EXP_MINUTES` (default: 10080 = 7 days)
   - Define `ORG_RESERVED_SLUGS` to prevent route collisions
   - Configure rate limits: `INVITES_PER_ORG_PER_DAY`, `INVITES_PER_IP_15M`

### Phase 2: Database Schema Migration

Implement database changes to support multi-tenant architecture.

**Steps:**

1. **Update Prisma Schema**
   - Open `prisma/schema.prisma`
   - Add `defaultOrganizationId` field to User model (see `references/schema.md`)
   - Add User relations: `memberships`, `createdOrganizations`, `sentInvitations`, `defaultOrganization`
   - Add index on User `defaultOrganizationId`
   - Copy Organization model from `references/schema.md`
   - Copy Membership model from `references/schema.md`
   - Copy Invitation model from `references/schema.md`
   - Update AuditLog model with `organizationId` field and relation

2. **Generate and Run Migration**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name add_multi_tenant_support
   ```

3. **Verify Migration Success**
   - Open Prisma Studio: `npx prisma studio`
   - Confirm new tables exist: organizations, memberships, invitations
   - Verify all indexes were created
   - Check User model has new fields and relations

4. **Seed Superadmin User**
   - Install tsx if needed: `npm install -D tsx`
   - Run seed script: `npx tsx scripts/seed-superadmin.ts admin@example.com`
   - Verify superadmin user created with role='superadmin'
   - Test login with superadmin credentials

**Reference:** Follow `assets/migration_checklist.md` for detailed validation

### Phase 3: Server Helper Functions

Implement core helper functions for organization management and authorization.

**Steps:**

1. **Create Organization Helpers File**
   - Create `lib/organizations.ts`
   - Import Prisma client and necessary types

2. **Implement Retrieval Helpers**
   - Add `getOrgBySlug(slug)` - Fetch org with members
   - Add `getUserOrganizations(userId)` - List user's orgs with roles
   - Add `getUserMembership(userId, orgId)` - Get specific membership
   - Add `getOrgIdFromSlug(slug)` - Extract org ID from slug

3. **Implement Authorization Helpers**
   - Add `isSuperadmin(userId)` - Check superadmin role
   - Add `requireMembership(userId, orgId)` - Require any membership
   - Add `requireAdmin(userId, orgId)` - Require admin role
   - Add `requireAdminOrSuperadmin(userId, orgId)` - Admin or superadmin
   - Add `isLastAdmin(userId, orgId)` - Check last admin protection

4. **Implement Slug Helpers**
   - Add `validateSlug(slug)` - Format validation
   - Add `isReservedSlug(slug)` - Check reserved words
   - Add `generateUniqueSlug(baseName)` - Generate unique slug from name
   - Import `randomBytes` from `crypto` for slug generation

5. **Implement Tenant Scoping Helper**
   - Add `scopeTenant<T>(where, orgId)` - Scope Prisma queries

6. **Implement Redirect Helper**
   - Add `getDefaultOrgForUser(userId, lastOrgCookie?)` - Priority chain for redirects

**Reference:** See `references/helpers.md` for complete function signatures and implementations

### Phase 4: API Routes Implementation

Implement Node.js API routes for organization, member, and invitation management.

**Critical Requirements (All Routes):**
- Export `runtime = "nodejs"` for database access
- Validate CSRF on all mutating routes (POST/PATCH/DELETE)
- Return structured JSON errors
- Log all mutations to AuditLog
- Use TypeScript types for request/response

**Steps:**

1. **Organization Management Routes**

   Create `app/api/orgs/route.ts`:
   - `GET /api/orgs` - List orgs (user's memberships or all for superadmin)
   - `POST /api/orgs` - Create org (check policy, limits, generate slug)

   Create `app/api/orgs/[orgSlug]/route.ts`:
   - `PATCH /api/orgs/[orgSlug]` - Update org name (admin/superadmin only)
   - `DELETE /api/orgs/[orgSlug]` - Delete org (superadmin only)

2. **Member Management Routes**

   Create `app/api/orgs/[orgSlug]/members/route.ts`:
   - `GET /api/orgs/[orgSlug]/members` - List members (admin/superadmin)

   Create `app/api/orgs/[orgSlug]/members/[userId]/route.ts`:
   - `PATCH /api/orgs/[orgSlug]/members/[userId]` - Update role (last admin check)
   - `DELETE /api/orgs/[orgSlug]/members/[userId]` - Remove member (last admin check)

3. **Invitation Management Routes**

   Create `app/api/orgs/[orgSlug]/invitations/route.ts`:
   - `GET /api/orgs/[orgSlug]/invitations` - List pending invites
   - `POST /api/orgs/[orgSlug]/invitations` - Create invite (rate limited)

   Create `app/api/orgs/[orgSlug]/invitations/[id]/route.ts`:
   - `DELETE /api/orgs/[orgSlug]/invitations/[id]` - Revoke invite

   Create `app/api/orgs/invitations/accept/route.ts`:
   - `POST /api/orgs/invitations/accept` - Accept invite (email match required)

4. **Security Implementation**

   For each route:
   - Validate CSRF before reading request body (mutating routes only)
   - Check authentication and authorization (use helpers from Phase 3)
   - Enforce rate limits on invitation creation
   - Validate last admin protection on member operations
   - Scope all database queries by organizationId
   - Log mutations to AuditLog with full context

5. **Error Handling**

   Return structured errors:
   ```typescript
   {
     error: "Human-readable message",
     code: "ERROR_CODE",
     details: {}
   }
   ```

**Reference:** See `references/api_endpoints.md` for complete specifications and `references/security_checklist.md` for security requirements

### Phase 5: Protected Routes and Layouts

Implement organization-scoped pages and server layouts with membership verification.

**Steps:**

1. **Create Organization Layout**

   Create `app/(protected)/o/[orgSlug]/layout.tsx`:
   - Mark as async server component
   - Extract `orgSlug` from params
   - Fetch organization using `getOrgBySlug()`
   - Get current user from session
   - Verify membership or superadmin (use `requireAdminOrSuperadmin`)
   - Set `__last_org` cookie to remember last visited org
   - Pass org and membership data to client shell
   - Return 404 if org not found
   - Return 403 if no access

2. **Implement Root Redirect Logic**

   Update `app/(protected)/page.tsx` or `app/dashboard/page.tsx`:
   - Get current user from session
   - Get `__last_org` cookie value
   - Call `getDefaultOrgForUser(userId, lastOrgCookie)`
   - If slug returned: `redirect(/o/${slug}/dashboard)`
   - If null and can create org: `redirect(/onboarding/create-organization)`
   - Otherwise: Show org access denied screen with guidance

3. **Create Organization Settings Pages**

   Create `app/(protected)/o/[orgSlug]/settings/layout.tsx`:
   - Require admin or superadmin access
   - Render settings navigation tabs

   Create settings pages:
   - `app/(protected)/o/[orgSlug]/settings/general/page.tsx` - Org name, read-only slug
   - `app/(protected)/o/[orgSlug]/settings/members/page.tsx` - Member list with actions
   - `app/(protected)/o/[orgSlug]/settings/invitations/page.tsx` - Invite management

4. **Create Superadmin Area**

   Create `app/(protected)/admin/layout.tsx`:
   - Require superadmin role (use `isSuperadmin`)
   - Return 403 for non-superadmins

   Create admin pages:
   - `app/(protected)/admin/page.tsx` - Organizations list with search/pagination
   - `app/(protected)/admin/organizations/[orgSlug]/page.tsx` - Org detail with member management

**Security Requirements:**
- Always derive `organizationId` from path params (`orgSlug`), never client input
- Verify membership or superadmin in server components before rendering
- Scope all data queries by `organizationId` using `scopeTenant()`

### Phase 6: UI Components and Client Interactions

Implement client components for organization management features.

**Steps:**

1. **Organization Switcher Component**

   Create `components/features/organizations/org-switcher.tsx`:
   - Mark as `'use client'`
   - Display current organization name
   - List accessible organizations from server props
   - Include "Create organization" option (if policy allows or superadmin)
   - Navigate to `/o/[slug]/dashboard` on selection
   - Use shadcn/ui DropdownMenu or Select component

2. **Member Management Components**

   Create `components/features/organizations/member-list.tsx`:
   - Display members table with name, email, role, joined date
   - Add role change dialog (admin/member select)
   - Add remove member confirmation dialog
   - Implement last admin protection on client (show warning)
   - Use toast notifications for success/error (Sonner)

   Create `components/features/organizations/member-role-dialog.tsx`:
   - Role selection (admin/member)
   - Validate last admin protection before submit
   - Call PATCH `/api/orgs/[slug]/members/[userId]`
   - Show success toast and refresh member list

3. **Invitation Management Components**

   Create `components/features/organizations/invitation-list.tsx`:
   - Display pending invitations table
   - Add "Copy invite link" button for each invitation
   - Add "Send email" button (if email configured)
   - Add "Revoke" action with confirmation
   - Show expiry dates with visual indicator for expired

   Create `components/features/organizations/invite-member-dialog.tsx`:
   - Email input with validation
   - Optional name input
   - Role selection (admin/member)
   - Optional "Send email" checkbox
   - Call POST `/api/orgs/[slug]/invitations`
   - Display generated invite URL (copy to clipboard)
   - Handle rate limit errors (429) with clear message

4. **Invite Acceptance Page**

   Create `app/(public)/invite/page.tsx`:
   - Extract token from query params (`?token=...`)
   - If not authenticated: redirect to `/login?next=/invite?token=...`
   - Fetch invitation details (organization name, role)
   - Show acceptance UI with org info
   - On accept: POST to `/api/orgs/invitations/accept` with token
   - Handle errors: expired, email mismatch, already member
   - On success: redirect to `/o/[slug]/dashboard` with success toast

5. **Organization Creation Flow**

   Create `app/(protected)/onboarding/create-organization/page.tsx`:
   - Organization name input
   - Auto-preview generated slug
   - Check policy and limits before rendering
   - POST to `/api/orgs` on submit
   - Redirect to `/o/[slug]/dashboard` on success
   - Show policy denial message if creation disabled

6. **Superadmin Organization Management**

   Create `components/features/admin/organization-list.tsx`:
   - Search input for org name/slug
   - Sortable columns (name, members, created)
   - Pagination controls
   - Link to detail page for each org

   Create `components/features/admin/organization-detail.tsx`:
   - Organization info with edit option
   - Member list with inline edit/remove actions
   - Delete organization button (confirmation required)
   - Call DELETE `/api/orgs/[slug]` with audit logging

**UI Standards:**
- Use shadcn/ui components exclusively (Dialog, Button, Input, Select, Table)
- Use Sonner for all toast notifications (top-right position)
- Follow Dialog from Dropdown pattern (restore pointer events on close)
- Never use empty string for SelectItem values
- Validate inputs with Zod schemas
- Handle loading and error states

### Phase 7: Testing and Validation

Verify the multi-tenant implementation meets security and functional requirements.

**Steps:**

1. **Manual Testing Checklist**

   Test authentication and authorization:
   - [ ] Regular user can view only their organizations
   - [ ] Admin can manage org settings, members, invitations
   - [ ] Member cannot access admin-only features
   - [ ] Superadmin can access all organizations
   - [ ] Superadmin can delete organizations
   - [ ] Non-authenticated users redirected to login

2. **Security Testing**

   Test CSRF protection:
   - [ ] All mutating endpoints reject requests with invalid Origin
   - [ ] Requests from allowed origin succeed

   Test rate limiting:
   - [ ] Invitation creation respects per-org daily limit
   - [ ] Invitation creation respects per-IP 15-minute limit
   - [ ] 429 responses include Retry-After header

   Test tenant isolation:
   - [ ] Users cannot access data from organizations they don't belong to
   - [ ] API routes reject requests with manipulated organizationId in body
   - [ ] All queries properly scoped by organizationId

3. **Business Rule Testing**

   Test last admin protection:
   - [ ] Cannot remove last admin from organization
   - [ ] Cannot demote last admin to member
   - [ ] Error message explains requirement

   Test invitation constraints:
   - [ ] Cannot invite existing members
   - [ ] Cannot create duplicate active invitations
   - [ ] Expired invitations cannot be accepted
   - [ ] Revoked invitations cannot be accepted
   - [ ] Email mismatch prevents acceptance

   Test slug validation:
   - [ ] Reserved slugs rejected on org creation
   - [ ] Invalid slug formats rejected
   - [ ] Slug cannot be changed after creation
   - [ ] Unique slugs generated from duplicate names

4. **Data Validation**

   Check database integrity:
   - [ ] All foreign key constraints work correctly
   - [ ] Cascade deletes work (org deletion removes memberships/invitations)
   - [ ] Indexes exist on critical columns
   - [ ] Audit logs capture all mutations

5. **Type Safety**

   Verify TypeScript compilation:
   ```bash
   npx tsc --noEmit
   npm run build
   ```

   - [ ] No TypeScript errors
   - [ ] All helper functions properly typed
   - [ ] API routes have typed params

**Reference:** Use `references/security_checklist.md` for comprehensive validation

## Post-Implementation

After completing all phases:

1. **Documentation**
   - Document superadmin access procedures for team
   - Create runbook for promoting/demoting users
   - Document organization creation policy for users

2. **Monitoring**
   - Set up alerts for rate limit violations
   - Monitor audit logs for suspicious activity
   - Track organization creation rates

3. **Optimization**
   - Add database indexes if queries are slow
   - Consider caching for organization lookups
   - Review and adjust rate limits based on usage

## Resources

This skill includes comprehensive reference documentation and utility scripts:

### scripts/

- **seed-superadmin.ts** - Create or promote users to superadmin role. Run after migration to set up initial platform admin.

  ```bash
  npx tsx scripts/seed-superadmin.ts admin@example.com
  ```

### references/

- **schema.md** - Complete database schema documentation with field details, business rules, and migration strategy
- **api_endpoints.md** - Full API specification with request/response formats, validation rules, and error codes
- **helpers.md** - Server helper function contracts with complete implementations and usage examples
- **security_checklist.md** - Security requirements, CSRF protection, rate limiting, and validation rules

### assets/

- **env_additions.txt** - Environment variables to add to `.env` with descriptions and defaults
- **migration_checklist.md** - Step-by-step database migration checklist with rollback instructions

## Common Pitfalls

**Security:**
- ❌ Never trust `organizationId` from client input - always derive from path
- ❌ Never skip CSRF validation on mutating routes
- ❌ Never bypass membership checks except for superadmin
- ✅ Always scope tenant queries using `scopeTenant()`
- ✅ Always verify last admin before removing/demoting

**Implementation:**
- ❌ Don't forget to export `runtime = "nodejs"` in API routes
- ❌ Don't allow slug changes after creation (immutable)
- ❌ Don't forget to set `__last_org` cookie on navigation
- ✅ Always log mutations to AuditLog
- ✅ Always validate slugs against reserved words
- ✅ Always hash invitation tokens with bcrypt

**Performance:**
- Consider adding indexes on frequently queried fields
- Cache organization lookups for active users
- Paginate member lists for large organizations
