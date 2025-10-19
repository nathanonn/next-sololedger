# Database Schema (Prisma)

This document contains the complete Prisma schema for the authentication system.

## Models

### User

The core user model with authentication and role information.

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  passwordHash String?
  role      String   @default("user") // "user" or "superadmin"
  sessionVersion Int @default(1)
  emailVerifiedAt DateTime?
  defaultOrganizationId String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  auditLogs AuditLog[]

  @@index([email])
  @@map("users")
}
```

**Key Fields:**
- `passwordHash`: Optional bcrypt hash for password authentication
- `role`: Either "user" or "superadmin" (superadmins bypass allowlist and org limits)
- `sessionVersion`: Incremented on password changes to invalidate all existing sessions
- `emailVerifiedAt`: Set when user verifies their email via OTP

### OtpToken

Stores one-time password tokens for email verification.

```prisma
model OtpToken {
  id        String   @id @default(cuid())
  email     String
  otpHash   String   // bcrypt hash of the OTP
  expiresAt DateTime
  consumedAt DateTime?
  attempts  Int      @default(0)
  createdAt DateTime @default(now())

  @@index([email, consumedAt, expiresAt])
  @@map("otp_tokens")
}
```

**Key Fields:**
- `otpHash`: Bcrypt hash of the numeric OTP code
- `expiresAt`: OTP expiration time (default 10 minutes from creation)
- `consumedAt`: Timestamp when OTP was successfully used (null = unconsumed)
- `attempts`: Failed verification attempts (token invalidated after 5 attempts)

**Policy:**
- Single active token per email (requesting new OTP consumes existing ones)
- Tokens are consumed on successful verification or after 5 failed attempts

### OtpRequest

Tracks OTP request attempts for rate limiting.

```prisma
model OtpRequest {
  id          String   @id @default(cuid())
  email       String
  ip          String?
  requestedAt DateTime @default(now())

  @@index([email, requestedAt])
  @@index([ip, requestedAt])
  @@map("otp_requests")
}
```

**Purpose:**
- Rate limiting enforcement
- Per email: 3 requests per 15 minutes, 10 per 24 hours
- Per IP: 5 requests per 15 minutes

### AuditLog

Comprehensive audit trail for all authentication events.

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  action    String   // e.g., "otp_request", "otp_verify_success", "password_set"
  userId    String?
  email     String?
  ip        String?
  organizationId String?
  metadata  Json?    // Additional context (e.g., failure reasons, attempt counts)
  createdAt DateTime @default(now())

  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@index([email, createdAt])
  @@index([action, createdAt])
  @@map("audit_logs")
}
```

**Common Actions:**
- `otp_request`, `otp_request_blocked`
- `otp_verify_success`, `otp_verify_failure`
- `dev_signin_success`, `dev_signin_failure`
- `password_set`, `password_change_success`, `password_change_failure`
- `signout`

## Complete Schema File

Place this in `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  passwordHash String?
  role      String   @default("user")
  sessionVersion Int @default(1)
  emailVerifiedAt DateTime?
  defaultOrganizationId String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  auditLogs AuditLog[]

  @@index([email])
  @@map("users")
}

model OtpToken {
  id        String   @id @default(cuid())
  email     String
  otpHash   String
  expiresAt DateTime
  consumedAt DateTime?
  attempts  Int      @default(0)
  createdAt DateTime @default(now())

  @@index([email, consumedAt, expiresAt])
  @@map("otp_tokens")
}

model OtpRequest {
  id          String   @id @default(cuid())
  email       String
  ip          String?
  requestedAt DateTime @default(now())

  @@index([email, requestedAt])
  @@index([ip, requestedAt])
  @@map("otp_requests")
}

model AuditLog {
  id        String   @id @default(cuid())
  action    String
  userId    String?
  email     String?
  ip        String?
  organizationId String?
  metadata  Json?
  createdAt DateTime @default(now())

  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@index([email, createdAt])
  @@index([action, createdAt])
  @@map("audit_logs")
}
```

## Migration Commands

After creating/updating the schema:

```bash
# Generate Prisma client
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name init_auth

# View database in GUI
npx prisma studio
```

## Superadmin Seeding

To create a superadmin user, create `scripts/seed-superadmin.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.SEED_EMAIL
  if (!email) {
    console.error('SEED_EMAIL environment variable is required')
    process.exit(1)
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: 'superadmin' },
    create: {
      email,
      role: 'superadmin',
      emailVerifiedAt: new Date(),
    },
  })

  console.log('✅ Superadmin user created:', user.email)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

Run with:
```bash
SEED_EMAIL=admin@example.com npx tsx scripts/seed-superadmin.ts
```
