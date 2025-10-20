# Multi-Tenant API Endpoints

All endpoints require Node runtime and JWT authentication. CSRF validation required on mutating methods.

## Organizations

### GET /api/orgs

List organizations for current user (or all for superadmin).

**Auth:** Required
**Response:**

```json
{
  "organizations": [
    {
      "id": "clx123",
      "name": "Acme Inc",
      "slug": "acme-inc",
      "role": "admin",
      "createdAt": "2025-08-01T10:20:00Z",
      "updatedAt": "2025-10-14T15:30:00Z"
    }
  ]
}
```

### POST /api/orgs

Create a new organization.

**Auth:** Required
**CSRF:** Required
**Body:**

```json
{
  "name": "Acme Inc",
  "slug": "acme-inc"  // Optional; auto-generated if omitted
}
```

**Errors:**
- `401` Unauthorized
- `403` Creation disabled or limit exceeded
- `400` Invalid slug or slug taken
- `500` Server error

**Response:** `201 Created`

```json
{
  "organization": {
    "id": "clx123",
    "name": "Acme Inc",
    "slug": "acme-inc",
    "createdAt": "2025-10-20T12:00:00Z"
  }
}
```

### GET /api/orgs/[orgSlug]

Fetch organization details.

**Auth:** Admin or superadmin
**Response:**

```json
{
  "id": "clx123",
  "name": "Acme Inc",
  "slug": "acme-inc",
  "createdAt": "2025-08-01T10:20:00Z",
  "updatedAt": "2025-10-14T15:30:00Z"
}
```

### PATCH /api/orgs/[orgSlug]

Update organization name or slug.

**Auth:** Admin (name only) or superadmin (name + slug)
**CSRF:** Required
**Body:**

```json
{
  "name": "Acme Corporation",  // Optional
  "slug": "acme-corp"          // Optional; superadmin only
}
```

**Errors:**
- `403` Slug change requires superadmin
- `400` Validation error
- `404` Organization not found

**Response:**

```json
{
  "organization": {
    "id": "clx123",
    "name": "Acme Corporation",
    "slug": "acme-corp",
    "updatedAt": "2025-10-20T12:30:00Z"
  }
}
```

### DELETE /api/orgs/[orgSlug]

Delete organization (superadmin only).

**Auth:** Superadmin only
**CSRF:** Required
**Response:**

```json
{
  "success": true
}
```

## Members

### GET /api/orgs/[orgSlug]/members

List organization members with pagination.

**Auth:** Member or superadmin
**Query params:**
- `page=1` (default)
- `pageSize=20` (10, 20, or 50)
- `excludeSuperadmins=true` (optional)

**Response:**

```json
{
  "members": [
    {
      "id": "usr123",
      "email": "jane@acme.com",
      "name": "Jane Smith",
      "role": "admin",
      "joinedAt": "2025-09-01T10:00:00Z"
    }
  ],
  "total": 42,
  "adminCount": 3,
  "page": 1,
  "pageSize": 20,
  "totalPages": 3
}
```

### PATCH /api/orgs/[orgSlug]/members/[userId]

Change member role and/or name.

**Auth:** Admin or superadmin
**CSRF:** Required
**Body:**

```json
{
  "role": "member",        // Optional: "admin" | "member"
  "name": "Jane Doe"       // Optional
}
```

**Guardrails:**
- Cannot demote/remove last admin
- Non-superadmin admins cannot self-demote
- Audits all role changes

**Response:**

```json
{
  "success": true
}
```

### DELETE /api/orgs/[orgSlug]/members/[userId]

Remove member from organization.

**Auth:** Admin (can remove others) or self (leave)
**CSRF:** Required
**Guardrails:**
- Cannot remove last admin
- Clears `defaultOrganizationId` if removed

**Response:**

```json
{
  "success": true
}
```

## Invitations

### GET /api/orgs/[orgSlug]/invitations

List pending invitations for organization.

**Auth:** Admin or superadmin
**Response:**

```json
{
  "invitations": [
    {
      "id": "inv123",
      "email": "new@example.com",
      "name": "New User",
      "role": "member",
      "expiresAt": "2025-11-01T12:34:00Z",
      "invitedBy": "usr456",
      "invitedByName": "Jane Smith",
      "createdAt": "2025-10-20T12:34:00Z"
    }
  ]
}
```

### POST /api/orgs/[orgSlug]/invitations

Create an invitation.

**Auth:** Admin or superadmin
**CSRF:** Required
**Rate limits:** Per-org/day and per-IP/15m
**Body:**

```json
{
  "email": "new@example.com",
  "role": "member",           // "admin" | "member"
  "name": "New User",         // Optional
  "sendEmail": true           // Optional; default true
}
```

**Response:** `201 Created`

```json
{
  "invitation": {
    "id": "inv123",
    "email": "new@example.com",
    "role": "member",
    "name": "New User",
    "expiresAt": "2025-11-01T12:34:00Z",
    "inviteUrl": "https://app.example.com/invite?token=abc123...",
    "sent": true
  }
}
```

### DELETE /api/orgs/[orgSlug]/invitations/[id]

Revoke invitation.

**Auth:** Admin or superadmin
**CSRF:** Required
**Response:**

```json
{
  "success": true
}
```

### POST /api/orgs/[orgSlug]/invitations/[id]/resend

Resend invitation with new token and expiry.

**Auth:** Admin or superadmin
**CSRF:** Required
**Response:**

```json
{
  "invitation": {
    "id": "inv123",
    "email": "new@example.com",
    "role": "member",
    "expiresAt": "2025-11-05T10:00:00Z",
    "inviteUrl": "https://app.example.com/invite?token=xyz789...",
    "sent": true
  }
}
```

## Public Invitation Endpoints

### GET /api/orgs/invitations/validate?token=...

Validate invitation token (public, no auth required).

**Query:** `token` (required)
**Response:**

```json
{
  "valid": true,
  "invitation": {
    "id": "inv123",
    "orgId": "org456",
    "orgSlug": "acme-inc",
    "orgName": "Acme Inc",
    "email": "new@example.com",
    "role": "member",
    "expiresAt": "2025-11-01T12:34:00Z"
  },
  "alreadyMember": false,        // If authenticated
  "userIsSuperadmin": false      // If authenticated
}
```

**Invalid states:**

```json
{
  "valid": false,
  "error": "Invalid or expired invitation"
}
```

### POST /api/orgs/invitations/accept

Accept invitation (requires auth; email must match).

**Auth:** Required
**CSRF:** Required
**Body:**

```json
{
  "token": "abc123..."
}
```

**Errors:**
- `401` Unauthorized
- `403` Email mismatch
- `400` Invalid/expired token
- `400` Already a member

**Response:**

```json
{
  "message": "Successfully joined Acme Inc",
  "organization": {
    "id": "org456",
    "name": "Acme Inc",
    "slug": "acme-inc"
  }
}
```

Or if already member:

```json
{
  "message": "You are already a member of this organization",
  "alreadyMember": true,
  "organization": {
    "id": "org456",
    "name": "Acme Inc",
    "slug": "acme-inc"
  }
}
```

## Implementation Template

```typescript
// app/api/orgs/route.ts
import { getCurrentUser } from '@/lib/auth-helpers'
import { getUserOrganizations, canCreateOrganization } from '@/lib/multi-tenant/organizations'
import { validateSlug, generateUniqueSlug } from '@/lib/multi-tenant/slugs'
import { validateCSRF } from '@/lib/csrf'
import db from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const organizations = await getUserOrganizations(user.id)
  return Response.json({ organizations })
}

export async function POST(req: Request) {
  // 1. Auth check
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // 2. CSRF check
  const csrfError = validateCSRF(req)
  if (csrfError) return csrfError

  // 3. Parse body
  const { name, slug: proposedSlug } = await req.json()
  if (!name) {
    return Response.json({ error: 'Name is required' }, { status: 400 })
  }

  // 4. Check creation permission
  const permission = await canCreateOrganization(user.id)
  if (!permission.allowed) {
    return Response.json({ error: permission.reason }, { status: 403 })
  }

  // 5. Validate or generate slug
  let slug = proposedSlug
  if (slug) {
    const validation = validateSlug(slug)
    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 })
    }
    const existing = await getOrgBySlug(slug)
    if (existing) {
      return Response.json({ error: 'Slug already taken' }, { status: 400 })
    }
  } else {
    slug = await generateUniqueSlug(name)
  }

  // 6. Create org + membership + audit
  const organization = await db.organization.create({
    data: {
      name,
      slug,
      createdById: user.id,
      memberships: {
        create: {
          userId: user.id,
          role: 'admin'
        }
      }
    }
  })

  // 7. Set default org if first
  if (!user.defaultOrganizationId) {
    await db.user.update({
      where: { id: user.id },
      data: { defaultOrganizationId: organization.id }
    })
  }

  // 8. Audit log
  await db.auditLog.create({
    data: {
      action: 'org_created',
      userId: user.id,
      email: user.email,
      organizationId: organization.id,
      metadata: { name, slug }
    }
  })

  return Response.json({ organization }, { status: 201 })
}
```
