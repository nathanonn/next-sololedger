# Post-Merge Instructions: Multi-Tenant Superadmin Support

## Summary of Changes

This feature branch adds **superadmin role support** with **configurable authentication and organization creation policies** and a **full admin area for managing organizations** to the multi-tenant boilerplate. Key additions include:

- **Superadmin Role**: Global access to all organizations without membership
- **Admin Area**: Dedicated `/admin/organizations` dashboard for managing all organizations
- **Organization Management**: View, edit, and delete organizations with full member management
- **Authentication Toggles**: Optional email allowlist and signup controls
- **Organization Creation Policies**: Configurable limits and enable/disable toggle
- **Enhanced Security**: Role-based access controls with admin/superadmin checks
- **Improved UX**: Toast notifications for policy violations with proper error handling

## New Features Added

### 1. Superadmin Role
- Access all organizations without membership
- Bypass email allowlist restrictions
- Bypass signup restrictions
- Create organizations without limits
- Seed script: `scripts/seed-superadmin.ts`

### 2. Authentication Feature Toggles
- `AUTH_ALLOWLIST_ENABLED` - Toggle email allowlist enforcement
- `AUTH_SIGNUP_ENABLED` - Control new user registration

### 3. Organization Creation Policies
- `ORG_CREATION_ENABLED` - Enable/disable org creation for regular users
- `ORG_CREATION_LIMIT` - Set maximum organizations per user

### 4. API & Route Updates
- All org/member/invitation routes use `requireAdminOrSuperadmin()`
- Org creation enforces policies with proper limits
- Superadmin bypass logic in auth routes

### 5. UI Components
- Sidebar shows superadmin role and hides "Create Organization" based on policy
- Settings pages protected with admin/superadmin guards
- Login page displays toast notifications for policy violations
- New denial page for users blocked from creating organizations

### 6. Admin Area for Superadmins
- **Organizations List** (`/admin/organizations`)
  - Search organizations by name or slug
  - Sort by name or creation date (ascending/descending)
  - Paginate with configurable page size (10/20/50)
  - View member counts and creation dates
  - Direct links to organization details

- **Organization Detail Page** (`/admin/organizations/[orgSlug]`)
  - View organization metadata and member count
  - Full member list with pagination
  - Inline role management (admin/member)
  - Remove members with confirmation dialog
  - Delete entire organization with slug confirmation
  - "Last admin" protection (cannot demote/remove)

- **"Manage Organizations" Menu Link**
  - Appears in sidebar user menu for superadmins only
  - Available in both collapsed and expanded sidebar modes
  - Provides quick access to admin area

### 7. Helper Functions
- `isSuperadmin(userId)` - Check if user is superadmin
- `requireAdminOrSuperadmin(userId, orgId)` - Authorization guard
- Updated `getCurrentUserAndOrg()` - Returns `membership: null` for superadmins

## Important Notes

### For Developers
- The `role` field on User model now accepts `"superadmin"` (no migration needed - already supported)
- Superadmins return `membership: null` in org contexts (update code that assumes membership exists)
- All admin-only routes now accept superadmins
- Organization layout filters pages based on admin/superadmin status
- Admin area (`/admin/*`) is protected by middleware and server-side guards
- DELETE organization endpoint uses transactions to ensure data consistency
- All admin UI components use optimistic updates with proper error handling
- "Last admin" protection is enforced at both UI and API levels

### For Users
- Default configuration has **restrictive settings** for security:
  - `ORG_CREATION_ENABLED=false` (only superadmins can create orgs)
  - `AUTH_ALLOWLIST_ENABLED=true` (only allowed emails can sign up)
  - `AUTH_SIGNUP_ENABLED=true` (but can be disabled to prevent new signups)
- Adjust environment variables based on your use case

### Security Considerations
- **Only grant superadmin to trusted administrators** - they have unrestricted access to all organizations
- **Admin area is superadmin-only** - regular admins cannot access `/admin/organizations`
- **Organization deletion is irreversible** - deleted orgs cascade to memberships and invitations
- Audit logs are retained when organizations are deleted for compliance
- Review and set appropriate limits in production
- Consider disabling `ORG_CREATION_ENABLED` in production to control org creation
- "Last admin" protection prevents organizations from becoming orphaned

---

## Post-Merge Steps

Follow these steps **after merging** to the main branch to ensure full functionality:

### Step 1: Update Environment Variables

Add the following to your `.env` file:

```bash
# Authentication Feature Toggles
AUTH_ALLOWLIST_ENABLED=true              # Enable email allowlist (default: true)
AUTH_SIGNUP_ENABLED=true                 # Enable new user signup (default: true)

# Note: ALLOWED_EMAILS is now optional (only required when AUTH_ALLOWLIST_ENABLED=true)
ALLOWED_EMAILS="user@example.com,admin@example.com"

# Organization Creation Policies
ORG_CREATION_ENABLED=false               # Allow users to create orgs (default: false)
ORG_CREATION_LIMIT=1                     # Max orgs per user (default: 1)

# Superadmin Seed (optional)
SEED_EMAIL="admin@example.com"
```

**Important**: The defaults are **restrictive for security**. Adjust based on your needs:
- For **open signup**: Set `AUTH_ALLOWLIST_ENABLED=false` and `AUTH_SIGNUP_ENABLED=true`
- For **invite-only**: Set `AUTH_SIGNUP_ENABLED=false` and `ORG_CREATION_ENABLED=false`
- For **user-managed orgs**: Set `ORG_CREATION_ENABLED=true` and adjust `ORG_CREATION_LIMIT`

### Step 2: Update `.env.example` (if not already done)

Ensure `.env.example` includes the new variables:

```bash
# Copy from the updated .env.example in the worktree
cp .env.example .env.example.backup
# The file is already updated in the worktree
```

### Step 3: Database Check

**No new migrations required** - the `role` field on the User model already supports `"superadmin"` value.

Verify your database is up to date:

```bash
npx prisma generate
npx prisma migrate deploy  # In production, or:
npx prisma migrate dev      # In development
```

### Step 4: Create First Superadmin (Optional but Recommended)

Create a superadmin user to manage the system:

```bash
# Set SEED_EMAIL in .env or pass as environment variable
SEED_EMAIL="admin@example.com" npx tsx scripts/seed-superadmin.ts
```

**Output**: You'll see confirmation with the user ID and instructions to sign in.

**Security**: The script increments `sessionVersion`, invalidating existing sessions for that user.

### Step 5: Verify Functionality

Test the following scenarios:

#### a) Superadmin Access
1. Sign in as the superadmin user
2. Verify you see all organizations in the sidebar
3. Navigate to any organization without membership
4. Verify you can access organization settings and members pages
5. Create a new organization (should bypass limits)

#### b) Admin Area Access
1. Sign in as the superadmin user
2. Open the user menu in the sidebar (collapsed or expanded)
3. Click "Manage Organizations" link
4. Verify redirect to `/admin/organizations`
5. Test search functionality (search by org name or slug)
6. Test sorting (by name and creation date, asc/desc)
7. Test pagination (change page size to 10/20/50, navigate pages)
8. Click "View" on an organization to see details

#### c) Organization Management
1. From organization detail page:
   - Change a member's role from admin to member (and vice versa)
   - Try to demote the last admin (should be disabled with tooltip)
   - Try to remove the last admin (should be disabled with tooltip)
   - Remove a non-admin member (confirm in dialog)
   - Verify member is removed and page refreshes
2. Delete organization test:
   - Click "Delete Organization" button
   - Try to delete without typing slug (button should be disabled)
   - Type the organization slug correctly
   - Confirm deletion
   - Verify redirect to organizations list
   - Verify organization is gone from database

#### d) Regular User with ORG_CREATION_ENABLED=false
1. Sign in as a regular user with no organizations
2. Verify you see the "No Organizations" page
3. Check that "Create Organization" is hidden in sidebar
4. Verify toast shows: "Organization creation is disabled"

#### e) Regular User with ORG_CREATION_ENABLED=true
1. Set `ORG_CREATION_ENABLED=true` in .env
2. Restart dev server
3. Sign in as regular user with no orgs
4. Verify they can create an organization
5. Create up to the limit, then verify blocked by `ORG_CREATION_LIMIT`

#### f) Authentication Toggles
1. Test `AUTH_SIGNUP_ENABLED=false`:
   - Try to request OTP for non-existent user
   - Verify error: "No account found for this email. Sign up is disabled."

2. Test `AUTH_ALLOWLIST_ENABLED=false`:
   - Try OTP with email not in `ALLOWED_EMAILS`
   - Verify it works (allowlist bypassed)

3. Test superadmin bypass:
   - Set `AUTH_ALLOWLIST_ENABLED=true` and `AUTH_SIGNUP_ENABLED=false`
   - Request OTP for superadmin user
   - Verify it works (superadmins bypass restrictions)

### Step 6: Update Production Environment

For production deployments:

1. **Set environment variables** on your hosting platform:
   ```bash
   # Example for Vercel
   vercel env add AUTH_ALLOWLIST_ENABLED
   vercel env add AUTH_SIGNUP_ENABLED
   vercel env add ORG_CREATION_ENABLED
   vercel env add ORG_CREATION_LIMIT
   vercel env add SEED_EMAIL
   ```

2. **Deploy the application**

3. **Run superadmin seed** in production (if needed):
   ```bash
   # SSH into production or use deployment console
   SEED_EMAIL="admin@yourcompany.com" npx tsx scripts/seed-superadmin.ts
   ```

4. **Verify production functionality** using the tests above

### Step 7: Team Communication

Notify your team about:

1. **New environment variables** - Developers need to update local `.env`
2. **Superadmin role** - Who has superadmin access
3. **Policy changes** - Current org creation and signup policies
4. **Documentation updates**:
   - `README.md` - Setup instructions and superadmin info
   - `MULTI_TENANT.md` - Roles, permissions, and feature toggles
   - `notes/skills/authentication.md` - Toggle behavior details

### Step 8: Monitoring & Audit

After deployment, monitor:

1. **Audit logs** - Check for these new actions:
   - `org_create_denied` - User blocked from creating organization
   - `otp_request_blocked` - OTP request blocked by auth policies
   - `org_deleted` - Organization deleted by superadmin (includes metadata)
   - `member_role_updated` - Member role changed via admin area
   - `member_removed` - Member removed via admin area

   Query example:
   ```sql
   SELECT * FROM "audit_logs"
   WHERE action IN ('org_deleted', 'member_role_updated', 'member_removed')
   ORDER BY "createdAt" DESC
   LIMIT 50;
   ```

2. **User feedback** - Users trying to create orgs when disabled
3. **Superadmin activity** - Review all actions taken by superadmins in admin area
4. **Error rates** - Watch for auth-related and admin area errors
5. **Organization deletions** - Track and review any deleted organizations (check audit logs)

---

## Rollback Plan (If Needed)

If issues arise, you can safely rollback:

1. **Revert the merge** from main branch
2. **No database rollback needed** - schema unchanged
3. **Remove new env vars** or set to defaults:
   ```bash
   AUTH_ALLOWLIST_ENABLED=true
   AUTH_SIGNUP_ENABLED=true
   ORG_CREATION_ENABLED=false
   ORG_CREATION_LIMIT=1
   ```

4. **Demote superadmins** if needed:
   ```sql
   UPDATE "User" SET role = 'user' WHERE role = 'superadmin';
   ```

---

## Troubleshooting

### Issue: Users can't create organizations
**Solution**: Check `ORG_CREATION_ENABLED` and `ORG_CREATION_LIMIT` in `.env`

### Issue: "ALLOWED_EMAILS is required" error
**Solution**: Either set `AUTH_ALLOWLIST_ENABLED=false` or provide `ALLOWED_EMAILS`

### Issue: Superadmin can't access organizations
**Solution**: Verify `role='superadmin'` in database:
```sql
SELECT id, email, role FROM "User" WHERE email = 'admin@example.com';
```

### Issue: Infinite redirects on root page
**Solution**: Check that users have at least one organization OR can create one

### Issue: Toast notifications not showing
**Solution**: Verify `<Toaster />` component is in root layout (already added)

### Issue: Cannot access /admin/organizations (redirects to /?error=unauthorized)
**Solution**:
1. Verify user has `role='superadmin'` in database:
   ```sql
   SELECT id, email, role FROM "users" WHERE email = 'admin@example.com';
   ```
2. If role is correct, check middleware is protecting the path:
   ```bash
   # Should see /admin in protected paths in middleware.ts
   grep -A 5 "isProtected" middleware.ts
   ```
3. Clear cookies and sign in again to get fresh JWT with correct role

### Issue: "Manage Organizations" link not showing in sidebar
**Solution**:
1. Verify `isSuperadmin` prop is being passed to DashboardShell in both:
   - `app/admin/layout.tsx` (should be `true`)
   - `app/o/[orgSlug]/layout.tsx` (should be result of `isSuperadmin(user.id)`)
2. Check sidebar component is receiving and using the prop
3. Sign out and back in to refresh the sidebar state

---

## File Changes Reference

### New Files
- `scripts/seed-superadmin.ts` - Superadmin seed script
- `app/_components/org-creation-denied.tsx` - Denial page component
- `app/o/[orgSlug]/settings/organization/layout.tsx` - Org settings guard
- `app/o/[orgSlug]/settings/members/layout.tsx` - Members page guard
- `app/onboarding/create-organization/layout.tsx` - Create org guard
- `app/admin/layout.tsx` - Admin area layout with superadmin guard
- `app/admin/organizations/page.tsx` - Organizations list page
- `app/admin/organizations/[orgSlug]/page.tsx` - Organization detail page
- `components/features/admin/organizations-filters.tsx` - Search/sort/pagination controls
- `components/features/admin/role-select.tsx` - Inline member role selector
- `components/features/admin/remove-member-button.tsx` - Remove member with confirmation
- `components/features/admin/delete-organization-dialog.tsx` - Delete org with slug confirmation

### Modified Files
- `lib/env.ts` - New environment variables
- `lib/auth.ts` - Allowlist toggle logic
- `lib/org-helpers.ts` - Superadmin functions
- `app/api/auth/request-otp/route.ts` - Signup toggle enforcement
- `app/api/auth/verify-otp/route.ts` - Signup toggle enforcement
- `app/api/orgs/route.ts` - Org creation policies, superadmin sees all
- `app/api/orgs/[orgSlug]/route.ts` - Added DELETE endpoint for org deletion
- All org/member/invitation API routes - Admin/superadmin checks
- `app/o/[orgSlug]/layout.tsx` - Superadmin access, canCreateOrganizations, pass isSuperadmin
- `components/features/dashboard/dashboard-shell.tsx` - Pass canCreateOrganizations and isSuperadmin
- `components/features/dashboard/sidebar.tsx` - Hide button, show superadmin role, "Manage Organizations" link
- `middleware.ts` - Added /admin path protection
- `app/(public)/login/page.tsx` - Toast notices
- `app/page.tsx` - Root redirect logic with denial page
- `.env.example` - New variables
- `README.md` - Superadmin and toggles documentation
- `MULTI_TENANT.md` - Roles and feature toggles
- `notes/skills/authentication.md` - Toggle behavior

---

## Questions?

If you encounter issues during or after the merge:

1. Check this document's troubleshooting section
2. Review the updated documentation in `README.md` and `MULTI_TENANT.md`
3. Verify environment variables match your intended configuration
4. Check audit logs for denied actions: `SELECT * FROM "AuditLog" WHERE action LIKE '%denied%' ORDER BY "createdAt" DESC LIMIT 20;`

**Support**: Refer to `CLAUDE.md` for architecture guidelines and coding standards.
