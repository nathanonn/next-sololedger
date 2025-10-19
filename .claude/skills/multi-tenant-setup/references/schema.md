# Multi-Tenant Database Schema

Complete schema reference for Organizations, Memberships, and Invitations.

## User Model Updates

Add these fields to the existing User model:

```prisma
model User {
  // ... existing fields ...

  defaultOrganizationId  String?

  // Relations
  memberships            Membership[]
  createdOrganizations   Organization[] @relation("OrganizationCreator")
  sentInvitations        Invitation[]   @relation("InvitationSender")
  defaultOrganization    Organization?  @relation("UserDefaultOrganization", fields: [defaultOrganizationId], references: [id], onDelete: SetNull)

  @@index([defaultOrganizationId])
}
```

**Field Details:**
- `defaultOrganizationId`: Optional FK for faster root redirects; user can set their preferred default org

## Organization Model

The tenant isolation boundary. Each organization has members and manages its own data.

```prisma
model Organization {
  id          String   @id @default(cuid())
  name        String   @db.VarChar(255)
  slug        String   @unique @db.VarChar(50)
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  createdBy             User           @relation("OrganizationCreator", fields: [createdById], references: [id], onDelete: Restrict)
  memberships           Membership[]
  invitations           Invitation[]
  auditLogs             AuditLog[]
  defaultForUsers       User[]         @relation("UserDefaultOrganization")

  @@index([slug])
  @@index([createdById])
  @@map("organizations")
}
```

**Field Details:**
- `name`: Display name (1-255 chars); can be updated
- `slug`: URL-safe identifier (1-50 chars, lowercase, kebab-case); **immutable** after creation
- `createdById`: User who created the org; cannot be deleted while org exists (Restrict)

**Slug Rules:**
- Format: lowercase alphanumeric plus hyphens (`-`)
- Cannot start or end with hyphen
- Must be unique across all organizations
- Reserved words (api, admin, login, etc.) blocked via `ORG_RESERVED_SLUGS` env

## Membership Model

Links users to organizations with a role. Each user-org pair can have one membership.

```prisma
model Membership {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  role           String   @db.VarChar(20) // "admin" | "member"
  createdAt      DateTime @default(now())

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, organizationId])
  @@index([userId])
  @@index([organizationId, createdAt])
  @@map("memberships")
}
```

**Field Details:**
- `role`: Either `"admin"` or `"member"`
  - `admin`: Can manage org settings, members, and invitations
  - `member`: Can read org content and update own profile
- Cascade delete: When user or org is deleted, memberships are removed

**Business Rules:**
- Each user can have at most one membership per organization
- Last admin protection: Cannot remove/demote the final admin in an org

## Invitation Model

Pending organization membership invitations sent via email.

```prisma
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
  invitedBy    User         @relation("InvitationSender", fields: [invitedById], references: [id], onDelete: Restrict)

  @@index([organizationId, email])
  @@index([tokenHash])
  @@index([email, acceptedAt, revokedAt])
  @@map("invitations")
}
```

**Field Details:**
- `email`: Invitee's email; must match signed-in user's email to accept
- `name`: Optional; if provided and user has no name, applied on acceptance
- `role`: Role the user will receive upon acceptance
- `tokenHash`: bcrypt hash of 32-byte random token (plaintext shown only once)
- `expiresAt`: Invite expiry; controlled by `INVITE_EXP_MINUTES` env
- `acceptedAt`: Set when invite is accepted; creates membership
- `revokedAt`: Set when admin revokes invite; prevents acceptance

**Business Rules:**
- One active invite per (organization, email) pair at a time
- Cannot invite existing members
- Acceptance requires authenticated session with matching email
- Token validation includes expiry and revocation checks

## AuditLog Model Updates

Add `organizationId` field to track org-scoped events:

```prisma
model AuditLog {
  // ... existing fields ...

  organizationId String?

  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: SetNull)

  @@index([organizationId, createdAt])
}
```

**New Actions to Log:**
- `org_created`, `org_updated`, `org_deleted`
- `member_invited`, `invite_revoked`, `invite_accepted`
- `member_role_changed`, `member_removed`, `member_left`
- `org_create_denied`

## Migration Strategy

1. Create migration with new models
2. Add indexes in separate migration if needed for performance
3. Enable pgvector if using embedding features: `CREATE EXTENSION IF NOT EXISTS vector;`
4. Seed first superadmin user for system access

## Data Isolation Pattern

All queries for tenant data must include `organizationId`:

```typescript
// Scope Prisma queries by organization
export function scopeTenant<T extends Record<string, unknown>>(
  where: T,
  orgId: string
) {
  return { ...where, organizationId: orgId } as T & { organizationId: string };
}

// Usage example
const projects = await db.project.findMany({
  where: scopeTenant({ status: 'active' }, currentOrgId)
});
```

**Important:** Always derive `organizationId` from the server-side request path, never from client input.
