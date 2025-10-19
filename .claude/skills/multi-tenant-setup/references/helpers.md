# Server Helper Functions

Recommended helper functions for multi-tenant operations. These provide clean contracts for common operations.

## File Location

Create these helpers in `lib/organizations.ts` (or split into multiple files as needed).

## Organization Retrieval

### getOrgBySlug

Fetch organization by slug.

```typescript
export async function getOrgBySlug(
  slug: string
): Promise<Organization | null> {
  return await db.organization.findUnique({
    where: { slug },
    include: {
      memberships: {
        include: {
          user: {
            select: { id: true, email: true, name: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  })
}
```

**Usage:** Server layouts, API routes to validate org exists

### getUserOrganizations

Fetch all organizations for a user with their role.

```typescript
export async function getUserOrganizations(
  userId: string
): Promise<Array<{
  id: string
  name: string
  slug: string
  role: string
  createdAt: Date
  memberCount: number
}>> {
  const memberships = await db.membership.findMany({
    where: { userId },
    include: {
      organization: {
        include: {
          _count: {
            select: { memberships: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  })

  return memberships.map(m => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
    createdAt: m.createdAt,
    memberCount: m.organization._count.memberships
  }))
}
```

**Usage:** Org switcher, redirect logic, org listing

## Authorization Helpers

### isSuperadmin

Check if a user has superadmin role.

```typescript
export async function isSuperadmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true }
  })

  return user?.role === 'superadmin'
}
```

**Usage:** All authorization checks, bypass membership requirements

### getUserMembership

Get user's membership in an organization.

```typescript
export async function getUserMembership(
  userId: string,
  organizationId: string
): Promise<Membership | null> {
  return await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId
      }
    }
  })
}
```

**Usage:** Check if user has any access to org

### requireMembership

Require user has membership (any role) in organization. Throws if not found.

```typescript
export async function requireMembership(
  userId: string,
  organizationId: string
): Promise<Membership> {
  const membership = await getUserMembership(userId, organizationId)

  if (!membership) {
    throw new Error('Not a member of this organization')
  }

  return membership
}
```

**Usage:** Protected pages requiring any membership

### requireAdmin

Require user has admin role in organization. Throws if not admin.

```typescript
export async function requireAdmin(
  userId: string,
  organizationId: string
): Promise<Membership> {
  const membership = await requireMembership(userId, organizationId)

  if (membership.role !== 'admin') {
    throw new Error('Admin access required')
  }

  return membership
}
```

**Usage:** Org settings pages, member management

### requireAdminOrSuperadmin

Require user is either org admin or global superadmin. Returns membership or null (for superadmin).

```typescript
export async function requireAdminOrSuperadmin(
  userId: string,
  organizationId: string
): Promise<Membership | null> {
  // Check superadmin first
  const isSuper = await isSuperadmin(userId)
  if (isSuper) return null

  // Otherwise require admin membership
  return await requireAdmin(userId, organizationId)
}
```

**Usage:** API routes for org management, superadmin area

### isLastAdmin

Check if user is the last admin in an organization.

```typescript
export async function isLastAdmin(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const adminCount = await db.membership.count({
    where: {
      organizationId,
      role: 'admin'
    }
  })

  if (adminCount !== 1) return false

  const membership = await getUserMembership(userId, organizationId)
  return membership?.role === 'admin'
}
```

**Usage:** Member removal, role change validation

## Slug Helpers

### validateSlug

Validate slug format.

```typescript
export function validateSlug(slug: string): {
  valid: boolean
  error?: string
} {
  // 1-50 chars, lowercase alphanumeric plus hyphens
  // Cannot start/end with hyphen
  const slugRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

  if (!slug || slug.length < 1 || slug.length > 50) {
    return { valid: false, error: 'Slug must be 1-50 characters' }
  }

  if (!slugRegex.test(slug)) {
    return {
      valid: false,
      error: 'Slug must be lowercase alphanumeric with hyphens, cannot start/end with hyphen'
    }
  }

  return { valid: true }
}
```

### isReservedSlug

Check if slug is in reserved list.

```typescript
export function isReservedSlug(slug: string): boolean {
  const reserved = process.env.ORG_RESERVED_SLUGS?.split(',') || [
    'api', 'admin', 'login', 'signup', 'dashboard', 'settings',
    'o', 'org', 'organization', 'organizations', 'help', 'support',
    'docs', 'blog', 'about', 'contact', 'terms', 'privacy'
  ]

  return reserved.map(s => s.trim().toLowerCase()).includes(slug.toLowerCase())
}
```

### generateUniqueSlug

Generate unique slug from organization name.

```typescript
export async function generateUniqueSlug(baseName: string): Promise<string> {
  // Convert to slug format
  let slug = baseName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/--+/g, '-')          // Collapse multiple hyphens
    .replace(/^-|-$/g, '')         // Remove leading/trailing hyphens
    .slice(0, 50)                  // Max 50 chars

  // Validate
  const validation = validateSlug(slug)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  // Check reserved
  if (isReservedSlug(slug)) {
    // Append random suffix
    slug = `${slug.slice(0, 44)}-${randomBytes(3).toString('hex')}`
  }

  // Check uniqueness
  let candidate = slug
  let attempt = 0

  while (attempt < 10) {
    const exists = await db.organization.findUnique({
      where: { slug: candidate },
      select: { id: true }
    })

    if (!exists) return candidate

    // Add random suffix
    const suffix = randomBytes(3).toString('hex')
    candidate = `${slug.slice(0, 44)}-${suffix}`
    attempt++
  }

  throw new Error('Failed to generate unique slug')
}
```

**Note:** Import `randomBytes` from `crypto`

## Tenant Scoping Helper

### scopeTenant

Scope Prisma queries by organizationId.

```typescript
export function scopeTenant<T extends Record<string, unknown>>(
  where: T,
  organizationId: string
): T & { organizationId: string } {
  return { ...where, organizationId }
}
```

**Usage:**

```typescript
// Scope all queries for tenant data
const projects = await db.project.findMany({
  where: scopeTenant({ status: 'active' }, currentOrgId)
})

const tasks = await db.task.findMany({
  where: scopeTenant({ assigneeId: userId }, currentOrgId)
})
```

**Critical:** Always derive `organizationId` from the server-side request path (via slug), never from client input.

## Organization ID from Request

### getOrgIdFromSlug

Extract organization ID from slug in request path. Use in API routes.

```typescript
export async function getOrgIdFromSlug(
  slug: string
): Promise<string | null> {
  const org = await db.organization.findUnique({
    where: { slug },
    select: { id: true }
  })

  return org?.id || null
}
```

**Usage in API route:**

```typescript
export async function GET(
  req: Request,
  { params }: { params: { orgSlug: string } }
) {
  const orgId = await getOrgIdFromSlug(params.orgSlug)
  if (!orgId) {
    return new Response('Organization not found', { status: 404 })
  }

  // Use orgId for scoping queries
  const data = await db.project.findMany({
    where: scopeTenant({}, orgId)
  })

  return Response.json({ data })
}
```

## Redirect Logic Helper

### getDefaultOrgForUser

Get the appropriate default organization for a user following the priority chain.

```typescript
export async function getDefaultOrgForUser(
  userId: string,
  lastOrgCookie?: string
): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      defaultOrganizationId: true,
      memberships: {
        include: { organization: true },
        orderBy: { createdAt: 'asc' },
        take: 1
      }
    }
  })

  if (!user) return null

  // 1. Last org cookie (if user has access)
  if (lastOrgCookie) {
    const lastOrg = await db.organization.findUnique({
      where: { slug: lastOrgCookie },
      select: { id: true }
    })

    if (lastOrg) {
      const hasAccess = user.role === 'superadmin' ||
        await getUserMembership(userId, lastOrg.id)

      if (hasAccess) return lastOrgCookie
    }
  }

  // 2. Default organization
  if (user.defaultOrganizationId) {
    const defaultOrg = await db.organization.findUnique({
      where: { id: user.defaultOrganizationId },
      select: { slug: true }
    })
    if (defaultOrg) return defaultOrg.slug
  }

  // 3. First membership
  if (user.memberships.length > 0) {
    return user.memberships[0].organization.slug
  }

  // 4. If superadmin, any org
  if (user.role === 'superadmin') {
    const anyOrg = await db.organization.findFirst({
      select: { slug: true },
      orderBy: { createdAt: 'asc' }
    })
    if (anyOrg) return anyOrg.slug
  }

  return null
}
```

**Usage:** Root redirect in `/` or `/dashboard` page
