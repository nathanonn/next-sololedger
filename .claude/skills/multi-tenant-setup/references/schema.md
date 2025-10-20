# Multi-Tenant Prisma Schema

## Required Models

Add these models to your `schema.prisma`:

```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  createdBy   User         @relation("OrganizationCreator", fields: [createdById], references: [id], onDelete: Restrict)
  createdById String
  memberships Membership[]
  invitations Invitation[]

  @@index([slug])
  @@index([createdById])
  @@map("organizations")
}

model Membership {
  id        String   @id @default(cuid())
  role      String   // "admin" | "member"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId         String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  organizationId String

  @@unique([userId, organizationId])
  @@index([userId])
  @@index([organizationId])
  @@index([organizationId, role])
  @@map("memberships")
}

model Invitation {
  id        String    @id @default(cuid())
  email     String
  name      String?
  role      String    // "admin" | "member"
  tokenHash String    @unique // bcrypt hash of token
  expiresAt DateTime
  acceptedAt DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  // Relations
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  organizationId String
  invitedBy      User         @relation("InvitationInviter", fields: [invitedById], references: [id], onDelete: Restrict)
  invitedById    String

  @@index([email])
  @@index([organizationId])
  @@index([tokenHash])
  @@index([invitedById])
  @@map("invitations")
}
```

## User Model Updates

Add these fields to your existing `User` model:

```prisma
model User {
  id                    String    @id @default(cuid())
  email                 String    @unique
  name                  String?
  passwordHash          String?
  role                  String    @default("user") // "user" | "superadmin"
  sessionVersion        Int       @default(0)
  emailVerifiedAt       DateTime?
  defaultOrganizationId String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  // Multi-tenant relations
  memberships           Membership[]
  createdOrganizations  Organization[]     @relation("OrganizationCreator")
  sentInvitations       Invitation[]       @relation("InvitationInviter")

  // Existing relations...
  otpTokens             OtpToken[]
  auditLogs             AuditLog[]

  @@index([email])
  @@index([role])
  @@index([defaultOrganizationId])
  @@map("users")
}
```

## AuditLog Model Updates

Add `organizationId` for org-scoped audit trails:

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  action    String   // e.g., "org_created", "member_invited", "role_changed"
  userId    String?
  email     String?
  ip        String?
  organizationId String?  // New field for org-scoped actions
  metadata  Json?
  createdAt DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([action])
  @@index([organizationId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

## Migration Commands

After adding these models:

```bash
# Generate Prisma client
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add_multi_tenant_support

# Verify in Prisma Studio
npx prisma studio
```

## Important Schema Notes

1. **Cascading deletes**: Memberships and Invitations cascade when org is deleted
2. **Restrict on creators**: Cannot delete user who created orgs (prevents orphaning)
3. **Unique constraint**: One membership per user-org pair
4. **Indexes**: Optimized for common queries (by org, by user, by role)
5. **Token security**: Store only bcrypt hash of invitation token, never plain text
