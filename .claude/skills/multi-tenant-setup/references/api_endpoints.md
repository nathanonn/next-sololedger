# Multi-Tenant API Endpoints

Complete API specification for organizations, members, and invitations.

## Common Requirements

**All API Routes:**
- Export `runtime = "nodejs"` (required for database access)
- Validate CSRF on mutations (POST/PATCH/DELETE)
- Return structured JSON errors with appropriate status codes
- Log mutations to AuditLog
- Include proper TypeScript types

**Authentication:**
- All endpoints require valid JWT session
- Superadmin bypasses membership checks
- Regular users need appropriate org membership/role

## Organization Management

### List Organizations

```http
GET /api/orgs
```

**Auth:** Authenticated user

**Behavior:**
- Regular user: Returns their memberships with org details
- Superadmin: Returns all organizations (with pagination/search)

**Response:**
```json
{
  "organizations": [
    {
      "id": "clx...",
      "name": "Acme Inc.",
      "slug": "acme-inc",
      "role": "admin",
      "memberCount": 5,
      "createdAt": "2025-10-15T10:00:00Z"
    }
  ]
}
```

### Create Organization

```http
POST /api/orgs
Content-Type: application/json

{
  "name": "Acme Inc."
}
```

**Auth:** Authenticated user (policy-gated)

**Validation:**
- Check `ORG_CREATION_ENABLED=true` or user is superadmin
- Check user hasn't exceeded `ORG_CREATION_LIMIT` (superadmin bypasses)
- Name: 1-255 chars, trimmed
- Generate unique slug from name

**Response:**
```json
{
  "organization": {
    "id": "clx...",
    "name": "Acme Inc.",
    "slug": "acme-inc",
    "createdAt": "2025-10-15T10:00:00Z"
  }
}
```

**Errors:**
- 403: Org creation disabled or limit reached
- 400: Invalid name

**Side Effects:**
- Creates organization
- Creates admin membership for creator
- Sets as user's defaultOrganizationId if none set
- Logs `org_created` action

### Update Organization

```http
PATCH /api/orgs/[orgSlug]
Content-Type: application/json

{
  "name": "Acme Corporation"
}
```

**Auth:** Org admin or superadmin

**Validation:**
- Name: 1-255 chars, trimmed
- Slug is **immutable** (reject attempts to change)

**Response:**
```json
{
  "organization": {
    "id": "clx...",
    "name": "Acme Corporation",
    "slug": "acme-inc",
    "updatedAt": "2025-10-15T11:00:00Z"
  }
}
```

**Errors:**
- 404: Organization not found
- 403: Not admin/superadmin
- 400: Invalid name

**Side Effects:**
- Updates organization name
- Logs `org_updated` action

### Delete Organization

```http
DELETE /api/orgs/[orgSlug]
```

**Auth:** Superadmin only

**Response:**
```json
{
  "success": true
}
```

**Errors:**
- 404: Organization not found
- 403: Not superadmin

**Side Effects:**
- Deletes organization (cascades to memberships and invitations)
- Logs `org_deleted` action
- Clears users' defaultOrganizationId if pointing to deleted org

## Member Management

### List Members

```http
GET /api/orgs/[orgSlug]/members
```

**Auth:** Org admin or superadmin

**Response:**
```json
{
  "members": [
    {
      "id": "clx...",
      "userId": "clx...",
      "name": "Jane Doe",
      "email": "jane@acme.com",
      "role": "admin",
      "joinedAt": "2025-09-10T10:00:00Z"
    }
  ]
}
```

### Update Member Role

```http
PATCH /api/orgs/[orgSlug]/members/[userId]
Content-Type: application/json

{
  "role": "member"
}
```

**Auth:** Org admin or superadmin

**Validation:**
- Role must be "admin" or "member"
- Last admin protection: Cannot demote if target is last admin

**Response:**
```json
{
  "membership": {
    "userId": "clx...",
    "role": "member",
    "updatedAt": "2025-10-15T11:00:00Z"
  }
}
```

**Errors:**
- 404: Member not found
- 403: Not admin/superadmin
- 400: Invalid role or last admin violation

**Side Effects:**
- Updates membership role
- Logs `member_role_changed` action

### Remove Member

```http
DELETE /api/orgs/[orgSlug]/members/[userId]
```

**Auth:** Org admin (for others) or any member (self-leave) or superadmin

**Validation:**
- Last admin protection: Cannot remove if target is last admin
- Allow self-removal (leaving org)

**Response:**
```json
{
  "success": true
}
```

**Errors:**
- 404: Member not found
- 403: Not authorized
- 400: Last admin violation

**Side Effects:**
- Deletes membership
- Clears user's defaultOrganizationId if pointing to this org
- Logs `member_removed` or `member_left` action

## Invitation Management

### List Invitations

```http
GET /api/orgs/[orgSlug]/invitations
```

**Auth:** Org admin or superadmin

**Response:**
```json
{
  "invitations": [
    {
      "id": "clx...",
      "email": "new@example.com",
      "name": "New User",
      "role": "member",
      "expiresAt": "2025-10-22T10:00:00Z",
      "invitedBy": {
        "name": "Admin User",
        "email": "admin@acme.com"
      },
      "createdAt": "2025-10-15T10:00:00Z"
    }
  ]
}
```

### Create Invitation

```http
POST /api/orgs/[orgSlug]/invitations
Content-Type: application/json

{
  "email": "new@example.com",
  "name": "New User",
  "role": "member",
  "sendEmail": false
}
```

**Auth:** Org admin or superadmin

**Validation:**
- Email: valid format, trimmed, lowercased
- Name: optional, 1-255 chars
- Role: "admin" or "member"
- Check no existing membership for this email
- Check no active invite for (org, email) pair
- Rate limits:
  - `INVITES_PER_ORG_PER_DAY` per organization
  - `INVITES_PER_IP_15M` per IP address

**Response:**
```json
{
  "invitation": {
    "id": "clx...",
    "email": "new@example.com",
    "role": "member",
    "inviteUrl": "https://app.com/invite?token=abc123...",
    "expiresAt": "2025-10-22T10:00:00Z"
  }
}
```

**Errors:**
- 404: Organization not found
- 403: Not admin/superadmin
- 400: Invalid input, existing member, or active invite exists
- 429: Rate limit exceeded (include Retry-After header)

**Side Effects:**
- Creates invitation with bcrypt-hashed token
- Optionally sends email (if sendEmail=true and email configured)
- Logs `member_invited` action

### Revoke Invitation

```http
DELETE /api/orgs/[orgSlug]/invitations/[id]
```

**Auth:** Org admin or superadmin

**Response:**
```json
{
  "success": true
}
```

**Errors:**
- 404: Invitation not found
- 403: Not admin/superadmin

**Side Effects:**
- Sets revokedAt timestamp
- Logs `invite_revoked` action

### Accept Invitation

```http
POST /api/orgs/invitations/accept
Content-Type: application/json

{
  "token": "abc123..."
}
```

**Auth:** Authenticated user

**Validation:**
- Token must be valid (bcrypt verify against tokenHash)
- Invitation not expired (expiresAt > now)
- Invitation not revoked (revokedAt is null)
- Invitation not already accepted (acceptedAt is null)
- Signed-in user's email must match invitation email (case-insensitive)
- User must not already be a member

**Response:**
```json
{
  "organization": {
    "id": "clx...",
    "name": "Acme Inc.",
    "slug": "acme-inc"
  }
}
```

**Errors:**
- 400: Invalid token
- 403: Email mismatch or already member
- 404: Invitation not found or expired/revoked

**Side Effects:**
- Creates membership with specified role
- Sets acceptedAt timestamp
- Applies invitation name to user if user.name is null
- Sets as user's defaultOrganizationId if none set
- Logs `invite_accepted` action
- Redirects to `/o/[orgSlug]/dashboard`

## Error Response Format

All errors follow this structure:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

**Common Error Codes:**
- `ORG_CREATION_DISABLED`
- `ORG_LIMIT_REACHED`
- `LAST_ADMIN_VIOLATION`
- `RATE_LIMIT_EXCEEDED`
- `EMAIL_MISMATCH`
- `ALREADY_MEMBER`
- `INVALID_TOKEN`
- `UNAUTHORIZED`
- `FORBIDDEN`

## Rate Limiting

**Invitation Creation:**
- Per org: `INVITES_PER_ORG_PER_DAY` invites per 24 hours
- Per IP: `INVITES_PER_IP_15M` invites per 15 minutes

**Response on Rate Limit:**
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 3600

{
  "error": "Rate limit exceeded. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "retryAfter": 3600
  }
}
```

## CSRF Validation

All mutating endpoints (POST/PATCH/DELETE) must validate the Origin or Referer header:

```typescript
import { validateCsrf } from '@/lib/csrf'

export async function POST(req: Request) {
  const csrfValid = validateCsrf(req)
  if (!csrfValid) {
    return new Response(JSON.stringify({ error: 'Invalid request origin' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // ... handle request
}
```
