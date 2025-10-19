# Security Checklist and Best Practices

Critical security requirements and guardrails for multi-tenant implementation.

## Authentication & Authorization

### Session Requirements

- ✅ All org routes require valid JWT session
- ✅ Middleware verifies JWT signature only (no DB lookup)
- ✅ Server layouts/components verify membership or superadmin
- ✅ Derive organizationId from request path (slug), never client input
- ✅ Superadmin bypasses membership checks but logs all actions

### Role-Based Access

**Member:**
- ✅ Read org content
- ✅ Update own profile
- ❌ Manage org settings
- ❌ Manage members/invitations

**Admin:**
- ✅ All member permissions
- ✅ Manage org name (slug immutable)
- ✅ Manage members (view, change role, remove)
- ✅ Manage invitations (create, revoke)
- ❌ Delete organization

**Superadmin:**
- ✅ Global read/write access to all orgs
- ✅ Bypass membership checks
- ✅ Bypass creation limits and allowlist
- ✅ Delete organizations
- ✅ View/edit any org in /admin area

## CSRF Protection

### All Mutating Routes

**Required:** Validate Origin or Referer header matches allowed origins.

```typescript
import { validateCsrf } from '@/lib/csrf'

export async function POST(req: Request) {
  // CSRF check BEFORE reading body
  const csrfValid = validateCsrf(req)
  if (!csrfValid) {
    return new Response('Invalid request origin', { status: 403 })
  }

  const body = await req.json()
  // ... handle request
}
```

**Applies to:**
- ✅ POST /api/orgs (create org)
- ✅ PATCH /api/orgs/[slug] (update org)
- ✅ DELETE /api/orgs/[slug] (delete org)
- ✅ PATCH /api/orgs/[slug]/members/[id] (update member)
- ✅ DELETE /api/orgs/[slug]/members/[id] (remove member)
- ✅ POST /api/orgs/[slug]/invitations (create invite)
- ✅ DELETE /api/orgs/[slug]/invitations/[id] (revoke invite)
- ✅ POST /api/orgs/invitations/accept (accept invite)

## Rate Limiting

### Invitation Creation

**Per Organization:**
- Limit: `INVITES_PER_ORG_PER_DAY` invites per 24 hours
- Scope: organizationId
- Check: Count invitations created in last 24 hours

**Per IP Address:**
- Limit: `INVITES_PER_IP_15M` invites per 15 minutes
- Scope: IP address
- Check: Count invitations created in last 15 minutes

**Implementation:**

```typescript
// Check org limit
const orgInviteCount = await db.invitation.count({
  where: {
    organizationId,
    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  }
})

if (orgInviteCount >= parseInt(process.env.INVITES_PER_ORG_PER_DAY || '50')) {
  return new Response(
    JSON.stringify({
      error: 'Organization invite limit reached. Try again tomorrow.',
      code: 'RATE_LIMIT_EXCEEDED'
    }),
    { status: 429, headers: { 'Retry-After': '86400' } }
  )
}

// Check IP limit
const ipInviteCount = await db.invitation.count({
  where: {
    invitedBy: { /* match IP via relation or separate tracking */ },
    createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }
  }
})

if (ipInviteCount >= parseInt(process.env.INVITES_PER_IP_15M || '5')) {
  return new Response(
    JSON.stringify({
      error: 'Too many invites from your IP. Try again in 15 minutes.',
      code: 'RATE_LIMIT_EXCEEDED'
    }),
    { status: 429, headers: { 'Retry-After': '900' } }
  )
}
```

### Organization Creation

**Per User:**
- Limit: `ORG_CREATION_LIMIT` orgs per user
- Bypass: Superadmin
- Check: Count orgs created by user

```typescript
const userOrgCount = await db.organization.count({
  where: { createdById: userId }
})

const isSuper = await isSuperadmin(userId)

if (!isSuper && userOrgCount >= parseInt(process.env.ORG_CREATION_LIMIT || '3')) {
  return new Response(
    JSON.stringify({
      error: 'Organization creation limit reached.',
      code: 'ORG_LIMIT_REACHED'
    }),
    { status: 403 }
  )
}
```

## Data Isolation

### Query Scoping

**Critical:** All queries for tenant data MUST include organizationId.

```typescript
// ❌ Bad - no scoping
const projects = await db.project.findMany()

// ✅ Good - scoped by org
const projects = await db.project.findMany({
  where: scopeTenant({}, organizationId)
})

// ✅ Good - scoped with filters
const activeProjects = await db.project.findMany({
  where: scopeTenant({ status: 'active' }, organizationId)
})
```

### Organization ID Source

**Always derive from request path:**

```typescript
// ✅ API route - from path params
export async function GET(
  req: Request,
  { params }: { params: { orgSlug: string } }
) {
  const orgId = await getOrgIdFromSlug(params.orgSlug)
  if (!orgId) return new Response('Not found', { status: 404 })

  // Use orgId for scoping
}

// ✅ Server component - from page params
export default async function Page({
  params
}: {
  params: { orgSlug: string }
}) {
  const org = await getOrgBySlug(params.orgSlug)
  if (!org) notFound()

  // Use org.id for scoping
}
```

**Never trust client input:**

```typescript
// ❌ Bad - client can manipulate
const body = await req.json()
const { organizationId } = body  // Don't trust this!

// ✅ Good - derive from authenticated context
const orgId = await getOrgIdFromSlug(params.orgSlug)
const user = await getCurrentUser()
await requireMembership(user.id, orgId)  // Verify access
```

## Business Rule Enforcement

### Last Admin Protection

**Rule:** Cannot remove or demote the final admin in an organization.

**Implementation:**

```typescript
// Before removing member
if (membership.role === 'admin') {
  const isLast = await isLastAdmin(userId, organizationId)
  if (isLast) {
    return new Response(
      JSON.stringify({
        error: 'Cannot remove the last admin. Promote another member first.',
        code: 'LAST_ADMIN_VIOLATION'
      }),
      { status: 400 }
    )
  }
}

// Before changing role from admin to member
if (currentRole === 'admin' && newRole === 'member') {
  const isLast = await isLastAdmin(userId, organizationId)
  if (isLast) {
    return new Response(
      JSON.stringify({
        error: 'Cannot demote the last admin. Promote another member first.',
        code: 'LAST_ADMIN_VIOLATION'
      }),
      { status: 400 }
    )
  }
}
```

### Invitation Constraints

**One Active Invite Per (Org, Email):**

```typescript
// Before creating invite
const existingInvite = await db.invitation.findFirst({
  where: {
    organizationId,
    email: email.toLowerCase(),
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { gt: new Date() }
  }
})

if (existingInvite) {
  return new Response(
    JSON.stringify({
      error: 'An active invitation already exists for this email.',
      code: 'ACTIVE_INVITE_EXISTS'
    }),
    { status: 400 }
  )
}
```

**Cannot Invite Existing Members:**

```typescript
const existingMember = await db.membership.findFirst({
  where: {
    organizationId,
    user: { email: email.toLowerCase() }
  }
})

if (existingMember) {
  return new Response(
    JSON.stringify({
      error: 'This user is already a member of this organization.',
      code: 'ALREADY_MEMBER'
    }),
    { status: 400 }
  )
}
```

### Invitation Acceptance

**Email Must Match:**

```typescript
const user = await getCurrentUser()
if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
  return new Response(
    JSON.stringify({
      error: 'This invitation was sent to a different email address.',
      code: 'EMAIL_MISMATCH'
    }),
    { status: 403 }
  )
}
```

**Validate State:**

```typescript
if (invitation.acceptedAt) {
  return new Response('Invitation already accepted', { status: 400 })
}

if (invitation.revokedAt) {
  return new Response('Invitation has been revoked', { status: 400 })
}

if (invitation.expiresAt < new Date()) {
  return new Response('Invitation has expired', { status: 400 })
}
```

## Slug Security

### Validation

```typescript
const validation = validateSlug(slug)
if (!validation.valid) {
  return new Response(
    JSON.stringify({ error: validation.error }),
    { status: 400 }
  )
}
```

### Reserved Words

```typescript
if (isReservedSlug(slug)) {
  return new Response(
    JSON.stringify({ error: 'This slug is reserved.' }),
    { status: 400 }
  )
}
```

### Immutability

```typescript
// Reject attempts to change slug
if (body.slug && body.slug !== org.slug) {
  return new Response(
    JSON.stringify({ error: 'Organization slug cannot be changed.' }),
    { status: 400 }
  )
}
```

## Audit Logging

### All Mutations Must Log

**Required fields:**
- action: Descriptive action name
- userId: Actor (if authenticated)
- email: Actor email (for correlation)
- ip: Request IP
- organizationId: Affected org (if applicable)
- metadata: Relevant details (JSON)

**Actions to log:**
- `org_created`, `org_updated`, `org_deleted`
- `member_invited`, `invite_revoked`, `invite_accepted`
- `member_role_changed`, `member_removed`, `member_left`
- `org_create_denied` (policy violation)

**Example:**

```typescript
await db.auditLog.create({
  data: {
    action: 'org_created',
    userId: user.id,
    email: user.email,
    ip: req.headers.get('x-forwarded-for') || 'unknown',
    organizationId: org.id,
    metadata: {
      orgName: org.name,
      orgSlug: org.slug
    }
  }
})
```

## Sensitive Data Handling

### Never Log

- ❌ Invitation tokens (plaintext)
- ❌ Password hashes
- ❌ API keys
- ❌ Session tokens

### Hash Sensitive Tokens

```typescript
import bcrypt from 'bcrypt'

// Generate invite token
const token = randomBytes(32).toString('hex')
const tokenHash = await bcrypt.hash(token, 12)

// Store only hash
await db.invitation.create({
  data: {
    // ... other fields
    tokenHash
  }
})

// Return plaintext only once
return Response.json({ inviteUrl: `${APP_URL}/invite?token=${token}` })
```

## Environment Security

### Required Validations

```typescript
import { z } from 'zod'

const envSchema = z.object({
  ORG_CREATION_ENABLED: z.enum(['true', 'false']).default('false'),
  ORG_CREATION_LIMIT: z.coerce.number().int().positive().default(3),
  INVITE_EXP_MINUTES: z.coerce.number().int().positive().default(10080),
  INVITES_PER_ORG_PER_DAY: z.coerce.number().int().positive().default(50),
  INVITES_PER_IP_15M: z.coerce.number().int().positive().default(5),
  ORG_RESERVED_SLUGS: z.string().optional(),
  LAST_ORG_COOKIE_NAME: z.string().default('__last_org')
})

export const env = envSchema.parse(process.env)
```

## Checklist for Code Review

- [ ] All API routes export `runtime = "nodejs"`
- [ ] All mutations validate CSRF
- [ ] All tenant queries use scopeTenant()
- [ ] Organization ID derived from path, not client input
- [ ] Membership/admin checks before sensitive operations
- [ ] Last admin protection on remove/demote
- [ ] Rate limits on invitation creation
- [ ] Invitation constraints enforced (no duplicates, no existing members)
- [ ] Email match validation on invite acceptance
- [ ] Slugs validated and reserved words blocked
- [ ] All mutations logged to AuditLog
- [ ] Sensitive tokens hashed (bcrypt)
- [ ] Superadmin bypasses enforced correctly
- [ ] Proper error messages (no internal details leaked)
- [ ] TypeScript types for all params/returns
