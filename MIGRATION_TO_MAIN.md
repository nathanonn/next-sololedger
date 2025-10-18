# Migration Guide: Merging Multi-Tenant Feature to Main

## Overview

This guide covers the complete process of merging the multi-tenant feature from the `feat/multi_tenant_support` worktree back to the main branch, including database migrations and data backfilling.

---

## ⚠️ Pre-Migration Checklist

Before merging, ensure:

- [ ] All tests pass in the feature branch
- [ ] You have a **complete backup** of your main database
- [ ] You've tested the multi-tenant feature thoroughly
- [ ] All team members are aware of the upcoming migration
- [ ] You have downtime planned (if needed)
- [ ] Environment variables are documented

---

## 📋 Migration Steps

### Step 1: Backup Your Main Database

```bash
# Create a backup of your main database
pg_dump -U your_user -d nextboilerplate > backup_before_multitenant_$(date +%Y%m%d_%H%M%S).sql

# Verify the backup
ls -lh backup_before_multitenant_*.sql
```

**⚠️ CRITICAL**: Do not proceed without a verified backup!

---

### Step 2: Prepare Main Branch

```bash
# Switch to main branch
cd /path/to/your/main/repo
git checkout main

# Ensure main is up to date
git pull origin main

# Check for any uncommitted changes
git status
```

---

### Step 3: Merge the Feature Branch

```bash
# Merge the feature branch
git merge feat/multi_tenant_support

# If there are conflicts, resolve them carefully
# Pay special attention to:
# - prisma/schema.prisma
# - lib/env.ts
# - middleware.ts
# - app/(protected)/layout.tsx

# After resolving conflicts:
git add .
git commit -m "Merge feat/multi_tenant_support into main"
```

---

### Step 4: Update Dependencies

```bash
# Install any new dependencies
npm install

# Regenerate Prisma client
npx prisma generate
```

---

### Step 5: Update Environment Variables

Add the new multi-tenant variables to your **main** `.env` file:

```bash
# Multi-tenant Configuration
INVITE_EXP_MINUTES=10080              # 7 days
INVITES_PER_ORG_PER_DAY=20
INVITES_PER_IP_15M=5
ORG_RESERVED_SLUGS="o,api,dashboard,settings,login,invite,onboarding,_next,assets,auth,public"
LAST_ORG_COOKIE_NAME="__last_org"
```

**Verify** all required env vars are set:
```bash
# Check if env vars are valid
npx tsx -e "
import { env } from './lib/env';
console.log('✓ Environment variables validated');
console.log('  INVITE_EXP_MINUTES:', env.INVITE_EXP_MINUTES);
console.log('  ORG_RESERVED_SLUGS:', env.ORG_RESERVED_SLUGS);
"
```

---

### Step 6: Apply Database Migrations

#### Option A: Fresh Database (Development)

If you can reset your database:

```bash
# Reset and apply all migrations
npx prisma migrate reset

# This will:
# - Drop the database
# - Create a new database
# - Apply all migrations
# - Run seed scripts (if any)
```

#### Option B: Existing Database (Production/Staging)

If you have existing data:

```bash
# Preview the migration
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma \
  --script

# Apply the migration
npx prisma migrate deploy

# Verify the migration was applied
npx prisma migrate status
```

**Expected output:**
```
✓ Migration 20251015124824_add_multi_tenant_support applied

Database schema is up to date!
```

---

### Step 7: Verify Database Schema

Check that all new tables exist:

```bash
psql -d nextboilerplate -c "\dt"
```

**Expected tables:**
```
users
organizations       ← New
memberships         ← New
invitations         ← New
otp_tokens
otp_requests
audit_logs
```

**Verify the partial unique index:**
```bash
psql -d nextboilerplate -c "\d invitations"
```

Look for:
```
Indexes:
    "invitations_organizationId_email_active_key" UNIQUE, btree ("organizationId", email)
    WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL
```

---

### Step 8: Backfill Existing Users

**CRITICAL STEP**: Create organizations for all existing users.

```bash
# Run the backfill script
npx tsx scripts/backfill-organizations.ts
```

**Expected output:**
```
Starting organization backfill for existing users...

Found 5 user(s) without organizations.

Processing user: user1@example.com
  Creating organization: "User1's workspace" (slug: user1-workspace)
  ✓ Created organization xyz123

Processing user: user2@example.com
  Creating organization: "User2's workspace" (slug: user2-workspace)
  ✓ Created organization abc456

...

Backfill complete!
  Success: 5
  Errors: 0
```

**Verify backfill results:**
```bash
# Check that all users have organizations
psql -d nextboilerplate -c "
SELECT
  u.email,
  COUNT(m.id) as org_count,
  u.\"defaultOrganizationId\" IS NOT NULL as has_default
FROM users u
LEFT JOIN memberships m ON u.id = m.\"userId\"
GROUP BY u.id, u.email, u.\"defaultOrganizationId\"
ORDER BY u.email;
"
```

**Expected result**: All users should have `org_count >= 1` and `has_default = t`

---

### Step 9: Test the Application

#### Basic Functionality Tests

```bash
# Start the dev server
npm run dev
```

**Test these flows:**

1. **Root Redirect**
   - Visit `http://localhost:3000`
   - Should redirect to `/o/[org-slug]/dashboard`

2. **Organization Dashboard**
   - Visit `/o/[your-org-slug]/dashboard`
   - Should show organization info

3. **Create Organization**
   - Click profile → "Create Organization"
   - Create a new org
   - Should redirect to new org dashboard

4. **Member Management** (Admin only)
   - Visit `/o/[org-slug]/settings/members`
   - Send an invitation
   - Check console for invitation URL

5. **Organization Switcher**
   - Create/join multiple orgs
   - Click profile → Switch Organization
   - Verify switching works

6. **Profile Settings**
   - Visit `/o/[org-slug]/settings/profile`
   - Should work as before

#### API Tests

```bash
# Test org creation
curl -X POST http://localhost:3000/api/orgs \
  -H "Content-Type: application/json" \
  -H "Cookie: __access=YOUR_TOKEN" \
  -d '{
    "name": "Test Org",
    "slug": "test-org"
  }'

# Test listing orgs
curl http://localhost:3000/api/orgs \
  -H "Cookie: __access=YOUR_TOKEN"

# Test member listing
curl http://localhost:3000/api/orgs/test-org/members \
  -H "Cookie: __access=YOUR_TOKEN"
```

---

### Step 10: Update Old Routes (Breaking Changes)

The old routes are no longer directly accessible:
- ❌ `/dashboard` → ✅ `/o/[org-slug]/dashboard`
- ❌ `/settings/profile` → ✅ `/o/[org-slug]/settings/profile`

**Migration strategy:**

1. **Keep old routes temporarily** (Optional):
   ```typescript
   // app/(protected)/dashboard/page.tsx
   import { redirect } from 'next/navigation';

   export default function OldDashboard() {
     redirect('/'); // Will redirect to proper org
   }
   ```

2. **Update bookmarks/links**: Notify users to update their bookmarks

3. **Update external integrations**: Update any hardcoded URLs

---

## 🔄 Rollback Procedure

If something goes wrong:

### 1. Immediate Rollback (Git)

```bash
# If you haven't pushed yet
git reset --hard HEAD~1

# If you've already pushed
git revert HEAD
git push origin main
```

### 2. Database Rollback

```bash
# Restore from backup
psql -U your_user -d nextboilerplate < backup_before_multitenant_YYYYMMDD_HHMMSS.sql

# Verify restoration
psql -d nextboilerplate -c "\dt"
```

### 3. Clean Up

```bash
# Regenerate Prisma client
npx prisma generate

# Restart the application
npm run dev
```

---

## 🐛 Troubleshooting

### Issue: Migration Fails with "relation already exists"

**Solution:**
```bash
# Check migration status
npx prisma migrate status

# If migration is partially applied, mark it as applied
npx prisma migrate resolve --applied 20251015124824_add_multi_tenant_support

# Then re-run
npx prisma migrate deploy
```

### Issue: Users Can't Access Application After Merge

**Cause**: Users not backfilled or missing default org

**Solution:**
```bash
# Re-run backfill
npx tsx scripts/backfill-organizations.ts

# Check for users without orgs
psql -d nextboilerplate -c "
SELECT u.email
FROM users u
LEFT JOIN memberships m ON u.id = m.\"userId\"
WHERE m.id IS NULL;
"
```

### Issue: Invitation URLs Not Working

**Cause**: Middleware might be blocking `/invite`

**Solution:** Verify `middleware.ts` has `/invite` in `PUBLIC_PATHS`:
```typescript
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/invite",  // ← Must be here
  // ...
];
```

### Issue: TypeScript Errors After Merge

**Solution:**
```bash
# Regenerate Prisma types
npx prisma generate

# Clear Next.js cache
rm -rf .next

# Restart dev server
npm run dev
```

### Issue: Environment Variable Errors

**Solution:**
```bash
# Check which vars are missing
npx tsx -e "
try {
  require('./lib/env');
  console.log('✓ All env vars valid');
} catch (e) {
  console.error('✗ Missing env vars:', e.message);
}
"
```

---

## 📊 Post-Migration Verification

### Database Health Check

```sql
-- Check data integrity
SELECT
  (SELECT COUNT(*) FROM organizations) as total_orgs,
  (SELECT COUNT(*) FROM memberships) as total_memberships,
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(*) FROM users WHERE "defaultOrganizationId" IS NULL) as users_without_default;
```

**Expected:**
- `total_orgs` ≥ `total_users`
- `total_memberships` ≥ `total_users`
- `users_without_default` = 0

### Application Health Check

```bash
# Check build
npm run build

# Expected: No errors
```

### User Experience Check

1. Log in as different users
2. Verify each sees their organization
3. Test invitation flow end-to-end
4. Verify org switcher works
5. Check audit logs are being created

---

## 📝 Communication Template

### For Your Team

```
Subject: Multi-Tenant Feature Deployment - [DATE]

Hi Team,

We're deploying the multi-tenant feature to production on [DATE] at [TIME].

What's Changing:
- URLs will change from /dashboard to /o/[your-org]/dashboard
- You'll be automatically redirected to your organization
- Your existing data is preserved and accessible
- Each user now has their own workspace

What You Need to Do:
- Update any bookmarked URLs
- Update browser with the new /o/[org]/ URLs
- Report any issues immediately

Downtime: Approximately [DURATION]

Questions? Contact [YOUR NAME]
```

---

## 🎯 Success Criteria

Your migration is successful when:

- [ ] All migrations applied successfully
- [ ] All users backfilled with organizations
- [ ] Application starts without errors
- [ ] Users can log in and see their dashboard
- [ ] Organization switcher works
- [ ] Invitations can be created and accepted
- [ ] Admin functions work (member management)
- [ ] Old routes redirect properly
- [ ] No TypeScript errors
- [ ] Build succeeds
- [ ] All tests pass

---

## 📚 Additional Resources

- Main documentation: `MULTI_TENANT.md`
- Feature plan: `notes/plan.md`
- Wireframes: `notes/wireframes.md`
- Prisma migrations: `prisma/migrations/`

---

## 🆘 Emergency Contacts

If you encounter critical issues:

1. **Rollback immediately** (see Rollback Procedure above)
2. Check logs: `tail -f /var/log/your-app.log`
3. Review Prisma logs: `DEBUG="prisma:*" npm run dev`
4. Open an issue with full error logs

---

## 📅 Migration Timeline Template

### Recommended Schedule

**1 Week Before:**
- [ ] Review this migration guide
- [ ] Test in staging environment
- [ ] Notify team members
- [ ] Prepare rollback plan

**1 Day Before:**
- [ ] Final backup
- [ ] Verify all prerequisites
- [ ] Schedule downtime window

**Migration Day:**
- [ ] Create backup
- [ ] Merge feature branch (Steps 1-3)
- [ ] Apply migrations (Steps 4-6)
- [ ] Backfill users (Step 7-8)
- [ ] Test application (Step 9)
- [ ] Monitor for issues (1-2 hours)
- [ ] Notify team of completion

**1 Day After:**
- [ ] Verify no issues
- [ ] Monitor audit logs
- [ ] Check user reports
- [ ] Update documentation

---

## ✅ Final Checklist

Before considering the migration complete:

- [ ] Database backup created and verified
- [ ] Feature branch merged to main
- [ ] Dependencies installed
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Partial unique index created
- [ ] All users backfilled with organizations
- [ ] Application starts without errors
- [ ] Root redirect works
- [ ] Organization dashboard accessible
- [ ] Member management works
- [ ] Invitation flow works end-to-end
- [ ] Organization switcher functional
- [ ] No TypeScript errors
- [ ] Build succeeds
- [ ] Team notified
- [ ] Documentation updated

---

## 🎉 You're Done!

Once all items are checked, your multi-tenant feature is successfully migrated to main. Congratulations! 🎊

For ongoing maintenance and customization, refer to `MULTI_TENANT.md`.
