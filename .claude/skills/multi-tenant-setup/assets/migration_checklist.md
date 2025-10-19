# Multi-Tenant Migration Checklist

Step-by-step checklist for implementing the database migrations.

## Pre-Migration

- [ ] Backup your database
- [ ] Review current User model schema
- [ ] Ensure PostgreSQL 15+ is running
- [ ] Verify Prisma CLI is installed (`npx prisma --version`)

## Schema Updates

### 1. Update User Model

- [ ] Add `defaultOrganizationId` field to User model
- [ ] Add relations: `memberships`, `createdOrganizations`, `sentInvitations`, `defaultOrganization`
- [ ] Add index on `defaultOrganizationId`

### 2. Add Organization Model

- [ ] Copy Organization model to schema.prisma
- [ ] Verify `createdBy` relation uses existing User model
- [ ] Verify relations: `memberships`, `invitations`, `auditLogs`, `defaultForUsers`
- [ ] Confirm indexes on `slug` and `createdById`

### 3. Add Membership Model

- [ ] Copy Membership model to schema.prisma
- [ ] Verify relations to User and Organization
- [ ] Confirm unique constraint on `[userId, organizationId]`
- [ ] Confirm indexes on `userId` and `[organizationId, createdAt]`

### 4. Add Invitation Model

- [ ] Copy Invitation model to schema.prisma
- [ ] Verify relations to Organization and User (invitedBy)
- [ ] Confirm indexes on `[organizationId, email]`, `tokenHash`, and `[email, acceptedAt, revokedAt]`

### 5. Update AuditLog Model

- [ ] Add `organizationId` field to AuditLog
- [ ] Add relation to Organization
- [ ] Add index on `[organizationId, createdAt]`

## Run Migration

- [ ] Generate Prisma client: `npx prisma generate`
- [ ] Create migration: `npx prisma migrate dev --name add_multi_tenant_support`
- [ ] Verify migration files created in `prisma/migrations/`
- [ ] Review generated SQL for correctness
- [ ] Confirm all tables and indexes created successfully

## Post-Migration

- [ ] Run Prisma Studio to verify schema: `npx prisma studio`
- [ ] Check all tables exist: organizations, memberships, invitations
- [ ] Verify indexes were created
- [ ] Test user relations work (no errors in Prisma Client)

## Seed Data

- [ ] Run superadmin seed script: `npx tsx scripts/seed-superadmin.ts admin@example.com`
- [ ] Verify superadmin user created with role='superadmin'
- [ ] Check audit log for 'superadmin_seeded' action
- [ ] Test login with superadmin user

## Environment Configuration

- [ ] Add all multi-tenant env vars to .env (see env_additions.txt)
- [ ] Verify ORG_RESERVED_SLUGS includes critical routes
- [ ] Set ORG_CREATION_ENABLED based on your policy
- [ ] Configure rate limits for your use case

## Validation

- [ ] Run TypeScript check: `npx tsc --noEmit`
- [ ] Build succeeds: `npm run build`
- [ ] No Prisma errors in console
- [ ] Superadmin can access application

## Rollback Plan

If something goes wrong:

```bash
# Reset database to last migration
npx prisma migrate reset

# Or rollback to specific migration
# (Manual: restore database backup and remove migration files)
```

Keep your database backup until you've verified everything works!
