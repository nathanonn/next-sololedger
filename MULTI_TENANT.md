# Multi-Tenant Implementation Guide

## Overview

This Next.js boilerplate now includes **complete multi-tenant support** with Organizations, Memberships, and Invitations. Users can create multiple organizations, invite team members, and manage access with role-based permissions.

## Features ✨

### Core Functionality
- ✅ **Organizations**: Create and manage multiple workspaces
- ✅ **Memberships**: User-organization relationships with roles (admin/member)
- ✅ **Invitations**: Email-based invitations with expiry and rate limiting
- ✅ **Role-Based Access**: Admin vs Member vs Superadmin permissions
- ✅ **Superadmin Role**: Global access to all organizations without membership
- ✅ **Organization Creation Policies**: Configurable limits and toggles
- ✅ **Organization Switcher**: Easy navigation between organizations
- ✅ **Data Isolation**: Strict tenant boundaries with org-scoped routing
- ✅ **Audit Logging**: Track all organization-related actions
- ✅ **Last Organization**: Cookie-based memory of last visited org

### Security Features
- **Slug Validation**: Immutable, globally unique slugs with reserved word blocking
- **Rate Limiting**: Per-org and per-IP limits for invitations
- **Last Admin Protection**: Cannot remove or demote the last admin
- **CSRF Protection**: All mutations protected
- **JWT-Based Auth**: Secure session management
- **Email Verification**: Invitations require matching email addresses

## Database Schema

### Models

```prisma
Organization {
  id, name, slug (unique), createdById, memberships[], invitations[]
}

Membership {
  id, userId, organizationId, role (admin|member)
  @@unique([userId, organizationId])
}

Invitation {
  id, organizationId, email, role, tokenHash, expiresAt,
  invitedById, acceptedAt, revokedAt
}
```

### Relationships
- User → Memberships → Organizations (many-to-many)
- User.defaultOrganizationId → Organization (for quick access)
- Invitation: one active invite per (org, email) via partial unique index

## Routing Structure

### Organization-Scoped URLs
All protected content is under `/o/[orgSlug]/`:

```
/o/[orgSlug]/dashboard           # Organization dashboard
/o/[orgSlug]/settings/profile    # User profile settings
/o/[orgSlug]/settings/organization  # Org settings (admin only)
/o/[orgSlug]/settings/members    # Member management (admin only)
```

### Public Routes
```
/login                           # Authentication
/invite?token=...               # Accept invitation
/onboarding/create-organization # First-time org creation
```

### Root Redirect Logic
When a user visits `/` or `/dashboard`:
1. Check `__last_org` cookie → redirect to that org (superadmins can access any org)
2. Check `defaultOrganizationId` → redirect to that org
3. Check first membership → redirect to that org
4. For superadmins: check for any org in system
5. No orgs & can create → redirect to `/onboarding/create-organization`
6. No orgs & cannot create → redirect with notice

## Roles & Permissions

### Member Role
- View organization content
- Access own profile settings
- Cannot access organization settings or members

### Admin Role
- All Member permissions
- Access organization settings
- Manage members (invite, change roles, remove)
- Manage invitations (send, resend, revoke)
- Cannot remove or demote last admin

### Superadmin Role
- **Global access** to all organizations without membership
- All Admin permissions across all organizations
- Can create organizations bypassing `ORG_CREATION_ENABLED` and limits
- Bypasses email allowlist restrictions
- Bypasses signup restrictions
- Created via seed script: `npx tsx scripts/seed-superadmin.ts`

**Security Note**: Only grant superadmin role to trusted system administrators.

## Feature Toggles

### Authentication Toggles
- **AUTH_ALLOWLIST_ENABLED** (default: true)
  - When `false`: Any email can sign up
  - When `true`: Only emails in `ALLOWED_EMAILS` can sign up
  - Superadmins bypass this restriction

- **AUTH_SIGNUP_ENABLED** (default: true)
  - When `false`: Only existing users can sign in
  - When `true`: New users can create accounts
  - Superadmins bypass this restriction

### Organization Creation Policies
- **ORG_CREATION_ENABLED** (default: false)
  - When `false`: Only superadmins can create organizations
  - When `true`: Regular users can create organizations (subject to limit)

- **ORG_CREATION_LIMIT** (default: 1)
  - Maximum number of organizations a user can create
  - Superadmins bypass this limit

## API Endpoints

### Organization Management
```typescript
GET  /api/orgs                      // List user's organizations
POST /api/orgs                      // Create organization
PATCH /api/orgs/[orgSlug]          // Update organization (admin only)
```

### Member Management
```typescript
GET  /api/orgs/[orgSlug]/members              // List members
PATCH /api/orgs/[orgSlug]/members/[userId]   // Update role (admin only)
DELETE /api/orgs/[orgSlug]/members/[userId]  // Remove member (admin only)
```

### Invitation Management
```typescript
GET  /api/orgs/[orgSlug]/invitations         // List pending invitations (admin only)
POST /api/orgs/[orgSlug]/invitations         // Send invitation (admin only)
POST /api/orgs/[orgSlug]/invitations/[id]/resend  // Resend invitation (admin only)
DELETE /api/orgs/[orgSlug]/invitations/[id]  // Revoke invitation (admin only)
POST /api/orgs/invitations/accept            // Accept invitation (requires auth)
```

## Server Helpers

Located in `lib/org-helpers.ts`:

```typescript
// Organization retrieval
getOrgBySlug(slug: string): Promise<Organization | null>

// Membership checks
getUserMembership(userId, orgId): Promise<Membership | null>
getCurrentUserAndOrg(pathname): Promise<{user, org, membership | null} | null>
  // Superadmins return membership=null with org access

// Superadmin checks
isSuperadmin(userId: string): Promise<boolean>

// Authorization guards
requireMembership(userId, orgId): Promise<Membership>
requireAdmin(userId, orgId): Promise<Membership>
requireAdminOrSuperadmin(userId, orgId): Promise<Membership | null>
  // Returns null for superadmins (no membership needed)
isLastAdmin(userId, orgId): Promise<boolean>

// Utility functions
getUserOrganizations(userId): Promise<Organization[]>
validateSlug(slug): {valid: boolean, error?: string}
isReservedSlug(slug): boolean
generateUniqueSlug(baseName): Promise<string>
scopeTenant(where, orgId): WhereInput  // Helper for scoped queries
```

## Environment Variables

Add to your `.env`:

```bash
# Authentication Feature Toggles
AUTH_ALLOWLIST_ENABLED=true           # Enable email allowlist (default: true)
AUTH_SIGNUP_ENABLED=true              # Enable new user signup (default: true)
ALLOWED_EMAILS="user@example.com"     # Required when allowlist enabled

# Organization Creation Policies
ORG_CREATION_ENABLED=false            # Allow users to create orgs (default: false)
ORG_CREATION_LIMIT=1                  # Max orgs per user (default: 1)

# Multi-tenant Configuration
INVITE_EXP_MINUTES=10080              # 7 days
INVITES_PER_ORG_PER_DAY=20
INVITES_PER_IP_15M=5
ORG_RESERVED_SLUGS="o,api,dashboard,settings,login,invite,onboarding,_next,assets,auth,public"
LAST_ORG_COOKIE_NAME="__last_org"

# Superadmin (for seed script)
SEED_EMAIL="admin@example.com"
```

## Usage Examples

### 1. Creating an Organization

**API Call:**
```typescript
const response = await fetch('/api/orgs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: "Acme Corp",
    slug: "acme-corp"  // Optional, auto-generated if not provided
  })
});
```

**Page:** `/onboarding/create-organization`

### 2. Inviting a Member

**API Call:**
```typescript
const response = await fetch('/api/orgs/acme-corp/invitations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: "user@example.com",
    role: "member"  // or "admin"
  })
});

// Response includes inviteUrl to send via email
const { invitation } = await response.json();
console.log(invitation.inviteUrl); // https://yourapp.com/invite?token=...
```

**Page:** `/o/[orgSlug]/settings/members`

### 3. Accepting an Invitation

Users click the invitation link, sign in (if needed), then:

```typescript
const response = await fetch('/api/orgs/invitations/accept', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: 'invitation-token' })
});
```

**Page:** `/invite?token=...`

### 4. Switching Organizations

The organization switcher is available in the sidebar user menu. The cookie name is configurable via `LAST_ORG_COOKIE_NAME` environment variable:

```typescript
// The cookie name is automatically plumbed from env.LAST_ORG_COOKIE_NAME
// through the component chain to ensure client/server consistency
// Default: __last_org
document.cookie = `${lastOrgCookieName}=new-org-slug; path=/; max-age=${30 * 24 * 60 * 60}`;
router.push(`/o/new-org-slug/dashboard`);
```

**Important**: The cookie name is read from the server environment and passed through to the client component to ensure the client writes to the same cookie that the server reads. This prevents issues where changing `LAST_ORG_COOKIE_NAME` would break organization switching.

### 5. Protected Routes with Org Context

```typescript
import { getCurrentUserAndOrg } from '@/lib/org-helpers';
import { redirect } from 'next/navigation';

export default async function OrgPage({ params }) {
  const context = await getCurrentUserAndOrg(pathname);

  if (!context) {
    redirect('/login');
  }

  const { user, org, membership } = context;

  // Check if admin
  if (membership.role !== 'admin') {
    return <div>Admin access required</div>;
  }

  return <div>Welcome to {org.name}!</div>;
}
```

### 6. Scoped Database Queries

Always include `organizationId` in queries:

```typescript
import { scopeTenant } from '@/lib/org-helpers';

// ❌ Bad - no tenant isolation
const items = await db.item.findMany({
  where: { status: 'active' }
});

// ✅ Good - tenant isolated
const items = await db.item.findMany({
  where: scopeTenant({ status: 'active' }, orgId)
});
```

## Best Practices

### Security
1. **Always verify organizationId**: Never trust client-provided org IDs
2. **Use server helpers**: `requireMembership()`, `requireAdmin()` for authorization
3. **Scope all queries**: Use `scopeTenant()` for tenant-isolated queries
4. **Validate slugs**: Use `validateSlug()` and `isReservedSlug()`
5. **Rate limit invitations**: Already implemented, respect the limits

### UX
1. **Set last_org cookie**: When users switch orgs, persist their choice
2. **Redirect intelligently**: Use the root redirect logic for smooth navigation
3. **Show role badges**: Display admin/member status in UI
4. **Handle errors gracefully**: Show user-friendly messages for edge cases

### Data Modeling
If adding tenant-scoped models:

```prisma
model YourModel {
  id             String   @id @default(cuid())
  organizationId String   // Required for tenant isolation
  // ... your fields

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, createdAt])  // Composite index for performance
}
```

## Backfilling Existing Users

If you have existing users, run the backfill script:

```bash
npx tsx scripts/backfill-organizations.ts
```

This creates a default organization for each user without any memberships.

## Customization

### Adding More Roles

1. Update Prisma schema:
```prisma
model Membership {
  role String @db.VarChar(20) // admin | member | viewer
}
```

2. Update validation in API routes
3. Add role checks in server helpers
4. Update UI to show new roles

### Custom Permissions

Extend `requireAdmin()` pattern:

```typescript
export async function requirePermission(
  userId: string,
  orgId: string,
  permission: string
): Promise<Membership> {
  const membership = await requireMembership(userId, orgId);

  // Your permission logic here
  if (!hasPermission(membership.role, permission)) {
    throw new Error('Insufficient permissions');
  }

  return membership;
}
```

## Troubleshooting

### User Can't Access Organization
- Check membership exists: `db.membership.findUnique(...)`
- Verify slug is correct
- Check if user was removed from org

### Invitation Not Working
- Check token hasn't expired
- Verify email matches signed-in user
- Check invitation wasn't revoked
- Ensure rate limits not exceeded

### Can't Remove Last Admin
This is intentional! Promote another member to admin first:

```bash
PATCH /api/orgs/[orgSlug]/members/[userId]
{ "role": "admin" }
```

Then remove the other admin.

## Migration Checklist

- [x] Database schema updated
- [x] Migrations applied
- [x] Environment variables configured
- [x] Existing users backfilled
- [x] Routes updated to org-scoped URLs
- [x] Middleware configured
- [x] API endpoints tested
- [x] UI components integrated
- [x] Documentation updated

## Files Changed/Added

### Database & Helpers
- `prisma/schema.prisma` - Added Organization, Membership, Invitation models
- `prisma/migrations/[timestamp]_add_multi_tenant_support/` - Database migration
- `lib/org-helpers.ts` - Organization context and authorization helpers
- `lib/invitation-helpers.ts` - Invitation token and validation helpers
- `lib/env.ts` - Added multi-tenant environment variables
- `scripts/backfill-organizations.ts` - User backfill script

### Routing & Middleware
- `middleware.ts` - Added `/o/` and `/onboarding` protection
- `app/page.tsx` - Root redirect logic with cookie/default org
- `app/o/[orgSlug]/layout.tsx` - Org-scoped layout with membership verification
- `app/o/[orgSlug]/dashboard/page.tsx` - Organization dashboard

### API Routes
- `app/api/orgs/route.ts` - List/create organizations
- `app/api/orgs/[orgSlug]/route.ts` - Update organization
- `app/api/orgs/[orgSlug]/members/route.ts` - List members
- `app/api/orgs/[orgSlug]/members/[userId]/route.ts` - Update/remove members
- `app/api/orgs/[orgSlug]/invitations/route.ts` - List/create invitations
- `app/api/orgs/[orgSlug]/invitations/[id]/route.ts` - Revoke invitation
- `app/api/orgs/[orgSlug]/invitations/[id]/resend/route.ts` - Resend invitation
- `app/api/orgs/invitations/accept/route.ts` - Accept invitation

### UI Components
- `app/onboarding/create-organization/page.tsx` - Org creation onboarding
- `app/o/[orgSlug]/settings/organization/page.tsx` - Org settings
- `app/o/[orgSlug]/settings/members/page.tsx` - Member management
- `app/o/[orgSlug]/settings/profile/page.tsx` - User profile (org-scoped)
- `app/invite/page.tsx` - Invitation acceptance page
- `components/features/dashboard/dashboard-shell.tsx` - Added currentOrg prop
- `components/features/dashboard/sidebar.tsx` - Added org switcher

## Support

For issues or questions:
- Check this documentation first
- Review the plan at `notes/plan.md`
- Check wireframes at `notes/wireframes.md`
- Open an issue on GitHub

## License

Same as the parent project.
