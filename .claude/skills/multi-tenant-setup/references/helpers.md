# Multi-Tenant Helper Functions

All helpers are server-only and should live in `lib/multi-tenant/` directory.

## Slug & Organization Helpers

### `lib/multi-tenant/slugs.ts`

```typescript
import db from '@/lib/db'

const DEFAULT_RESERVED_SLUGS = [
  'o', 'api', 'dashboard', 'settings', 'login', 'invite',
  'onboarding', '_next', 'assets', 'auth', 'public'
]

export function getReservedSlugs(): string[] {
  const envSlugs = process.env.ORG_RESERVED_SLUGS
  if (!envSlugs) return DEFAULT_RESERVED_SLUGS
  return envSlugs.split(',').map(s => s.trim().toLowerCase())
}

export function isReservedSlug(slug: string): boolean {
  return getReservedSlugs().includes(slug.toLowerCase())
}

export function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug) return { valid: false, error: 'Slug is required' }
  if (slug.length > 50) return { valid: false, error: 'Slug must be ≤50 characters' }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { valid: false, error: 'Slug must be lowercase alphanumeric with hyphens' }
  }
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { valid: false, error: 'Slug cannot start or end with hyphen' }
  }
  if (isReservedSlug(slug)) {
    return { valid: false, error: 'This slug is reserved' }
  }
  return { valid: true }
}

export async function getOrgBySlug(slug: string) {
  return await db.organization.findUnique({
    where: { slug }
  })
}

export async function generateUniqueSlug(name: string): Promise<string> {
  let baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)

  if (!baseSlug) baseSlug = 'org'

  let slug = baseSlug
  let counter = 1

  while (true) {
    const validation = validateSlug(slug)
    if (!validation.valid) {
      slug = `${baseSlug}-${counter++}`
      continue
    }

    const existing = await getOrgBySlug(slug)
    if (!existing) return slug

    slug = `${baseSlug}-${counter++}`
  }
}
```

## Permission Helpers

### `lib/multi-tenant/permissions.ts`

```typescript
import db from '@/lib/db'

export async function isSuperadmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true }
  })
  return user?.role === 'superadmin'
}

export async function getUserMembership(userId: string, orgId: string) {
  return await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: orgId
      }
    }
  })
}

export async function requireMembership(userId: string, orgId: string) {
  const membership = await getUserMembership(userId, orgId)
  if (!membership) {
    throw new Error('Not a member of this organization')
  }
  return membership
}

export async function requireAdmin(userId: string, orgId: string) {
  const membership = await requireMembership(userId, orgId)
  if (membership.role !== 'admin') {
    throw new Error('Admin access required')
  }
  return membership
}

export async function requireAdminOrSuperadmin(userId: string, orgId: string) {
  if (await isSuperadmin(userId)) {
    return { role: 'admin' as const } // Superadmin has implicit admin access
  }
  return await requireAdmin(userId, orgId)
}

export async function isLastAdmin(userId: string, orgId: string): Promise<boolean> {
  const adminCount = await db.membership.count({
    where: {
      organizationId: orgId,
      role: 'admin'
    }
  })

  if (adminCount !== 1) return false

  const membership = await getUserMembership(userId, orgId)
  return membership?.role === 'admin'
}
```

## Tenant Data Scoping Helper

### `lib/multi-tenant/scoping.ts`

```typescript
/**
 * Ensures all tenant data queries are scoped by organizationId
 *
 * Usage:
 *   const projects = await db.project.findMany({
 *     where: scopeTenant({ status: 'active' }, orgId)
 *   })
 */
export function scopeTenant<T extends Record<string, any>>(
  where: T,
  organizationId: string
): T & { organizationId: string } {
  return {
    ...where,
    organizationId
  }
}
```

## Invitation Helpers

### `lib/multi-tenant/invitations.ts`

```typescript
import { randomBytes } from 'crypto'
import bcrypt from 'bcrypt'
import db from '@/lib/db'

export function generateInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex')
  const tokenHash = bcrypt.hashSync(token, 12)
  return { token, tokenHash }
}

export function verifyInvitationToken(token: string, tokenHash: string): boolean {
  try {
    return bcrypt.compareSync(token, tokenHash)
  } catch {
    return false
  }
}

export async function validateInvitationToken(token: string): Promise<{
  valid: boolean
  error?: string
  invitation?: any
}> {
  if (!token) {
    return { valid: false, error: 'Token is required' }
  }

  const invitations = await db.invitation.findMany({
    where: {
      expiresAt: { gte: new Date() },
      acceptedAt: null,
      revokedAt: null
    },
    include: {
      organization: {
        select: { id: true, name: true, slug: true }
      }
    }
  })

  for (const inv of invitations) {
    if (verifyInvitationToken(token, inv.tokenHash)) {
      return { valid: true, invitation: inv }
    }
  }

  return { valid: false, error: 'Invalid or expired invitation' }
}

export async function checkOrgInviteRateLimit(orgId: string): Promise<boolean> {
  const limit = parseInt(process.env.INVITES_PER_ORG_PER_DAY || '50', 10)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const count = await db.invitation.count({
    where: {
      organizationId: orgId,
      createdAt: { gte: oneDayAgo }
    }
  })

  return count < limit
}

export async function checkIpInviteRateLimit(ip: string): Promise<boolean> {
  const limit = parseInt(process.env.INVITES_PER_IP_15M || '5', 10)
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000)

  const count = await db.auditLog.count({
    where: {
      action: 'member_invited',
      ip,
      createdAt: { gte: fifteenMinAgo }
    }
  })

  return count < limit
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() :
             request.headers.get('x-real-ip') ||
             'unknown'
  return ip
}
```

## Organization Lifecycle Helpers

### `lib/multi-tenant/organizations.ts`

```typescript
import db from '@/lib/db'
import { isSuperadmin } from './permissions'

export async function canCreateOrganization(userId: string): Promise<{
  allowed: boolean
  reason?: string
}> {
  // Check if superadmin (bypasses all limits)
  if (await isSuperadmin(userId)) {
    return { allowed: true }
  }

  // Check if org creation is enabled
  const enabled = process.env.ORG_CREATION_ENABLED === 'true'
  if (!enabled) {
    return { allowed: false, reason: 'Organization creation is currently disabled' }
  }

  // Check user's org limit
  const limit = parseInt(process.env.ORG_CREATION_LIMIT || '5', 10)
  const count = await db.organization.count({
    where: { createdById: userId }
  })

  if (count >= limit) {
    return { allowed: false, reason: `You have reached the limit of ${limit} organizations` }
  }

  return { allowed: true }
}

export async function getUserOrganizations(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true }
  })

  // Superadmins see all orgs
  if (user?.role === 'superadmin') {
    return await db.organization.findMany({
      orderBy: { createdAt: 'desc' }
    })
  }

  // Regular users see only their memberships
  const memberships = await db.membership.findMany({
    where: { userId },
    include: {
      organization: true
    },
    orderBy: { createdAt: 'desc' }
  })

  return memberships.map(m => ({
    ...m.organization,
    role: m.role
  }))
}
```

## Usage Examples

### In an API Route

```typescript
import { getCurrentUser } from '@/lib/auth-helpers'
import { requireAdmin } from '@/lib/multi-tenant/permissions'
import { scopeTenant } from '@/lib/multi-tenant/scoping'
import db from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(
  req: Request,
  { params }: { params: { orgSlug: string } }
) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const org = await getOrgBySlug(params.orgSlug)
  if (!org) return new Response('Not found', { status: 404 })

  // Require admin access
  await requireAdmin(user.id, org.id)

  // Fetch org-scoped data
  const projects = await db.project.findMany({
    where: scopeTenant({ status: 'active' }, org.id)
  })

  return Response.json({ projects })
}
```
