# Multi-Tenant Implementation Checklist

Use this checklist to implement multi-tenant support step-by-step.

## Phase 1: Schema & Database

- [ ] Add environment variables from `assets/env_additions.txt` to `.env`
- [ ] Update `lib/env.ts` to validate new multi-tenant env vars with Zod
- [ ] Add Organization, Membership, Invitation models to `schema.prisma` (see `references/schema.md`)
- [ ] Update User model with multi-tenant fields: `role`, `defaultOrganizationId`, relations
- [ ] Update AuditLog model with `organizationId` field
- [ ] Run `npx prisma generate` to update Prisma client
- [ ] Run `npx prisma migrate dev --name add_multi_tenant_support` to create migration
- [ ] Verify schema in `npx prisma studio`

## Phase 2: Server Helpers

Create `lib/multi-tenant/` directory and implement helpers:

- [ ] `lib/multi-tenant/slugs.ts` - Slug validation and generation
- [ ] `lib/multi-tenant/permissions.ts` - Permission checking (admin, superadmin, membership)
- [ ] `lib/multi-tenant/scoping.ts` - Tenant data scoping helper
- [ ] `lib/multi-tenant/invitations.ts` - Token generation, validation, rate limiting
- [ ] `lib/multi-tenant/organizations.ts` - Org lifecycle helpers

Reference: `references/helpers.md` for complete implementation

## Phase 3: API Routes - Organizations

- [ ] `app/api/orgs/route.ts` - GET (list) and POST (create)
- [ ] `app/api/orgs/[orgSlug]/route.ts` - GET, PATCH, DELETE
- [ ] Test org creation with `ORG_CREATION_ENABLED` toggle
- [ ] Test org creation limit enforcement
- [ ] Test superadmin bypass of limits
- [ ] Test slug validation and reserved slugs
- [ ] Verify audit logging for org actions

## Phase 4: API Routes - Members

- [ ] `app/api/orgs/[orgSlug]/members/route.ts` - GET (list members)
- [ ] `app/api/orgs/[orgSlug]/members/[userId]/route.ts` - PATCH (change role) and DELETE (remove)
- [ ] Test last admin protection (cannot demote/remove)
- [ ] Test admin self-demotion block
- [ ] Test pagination (page, pageSize, excludeSuperadmins)
- [ ] Verify audit logging for member actions

## Phase 5: API Routes - Invitations

- [ ] `app/api/orgs/[orgSlug]/invitations/route.ts` - GET (list) and POST (create)
- [ ] `app/api/orgs/[orgSlug]/invitations/[id]/route.ts` - DELETE (revoke)
- [ ] `app/api/orgs/[orgSlug]/invitations/[id]/resend/route.ts` - POST (resend)
- [ ] `app/api/orgs/invitations/validate/route.ts` - GET (public, validate token)
- [ ] `app/api/orgs/invitations/accept/route.ts` - POST (accept invitation)
- [ ] Test rate limits (per-org/day and per-IP/15m)
- [ ] Test email match requirement on accept
- [ ] Test expired/revoked invitation handling
- [ ] Verify audit logging for invitation actions

## Phase 6: UI Components - Org Switcher

- [ ] Create `components/features/org-switcher.tsx` - Combobox for desktop
- [ ] Integrate org switcher into top bar of `DashboardShell`
- [ ] Add org switcher to mobile drawer
- [ ] Implement `LAST_ORG_COOKIE_NAME` cookie logic
- [ ] Test switching between orgs (cookie + navigation)

## Phase 7: UI Screens - Org Picker

- [ ] Create `app/(protected)/organizations/page.tsx` - Org picker/list
- [ ] Show user's orgs with actions: [Go to], [Set default], [Leave]
- [ ] Show [Create organization] button (if `ORG_CREATION_ENABLED`)
- [ ] Implement create org modal/form
- [ ] Implement leave org confirmation (with last admin check)
- [ ] Add empty states for no orgs

## Phase 8: UI Screens - Org Settings

### General Tab

- [ ] Create `app/(protected)/o/[orgSlug]/settings/organization/page.tsx`
- [ ] Implement General tab: Name edit form
- [ ] Show Slug field (read-only for admin, editable for superadmin)
- [ ] Add Danger Zone: Delete button (superadmin only)
- [ ] Implement delete confirmation modal (type org name to confirm)

### Members Tab

- [ ] Implement Members tab in org settings
- [ ] Create members table with pagination (10, 20, 50)
- [ ] Add [Edit] and [Remove] actions per member
- [ ] Create Edit Member modal (Name + Role)
- [ ] Implement remove member confirmation
- [ ] Add [Invite Member] button and modal
- [ ] Show Pending Invitations table with [Resend] and [Revoke] actions
- [ ] Implement mobile-responsive table (horizontal scroll + sticky header)

## Phase 9: UI Screens - Accept Invitation

- [ ] Create `app/(public)/invite/page.tsx` - Public invitation acceptance
- [ ] Show org name, role, expiry
- [ ] Validate token on page load (call `/api/orgs/invitations/validate`)
- [ ] Handle states: valid, expired, revoked, email mismatch, already member
- [ ] Require user to be signed in
- [ ] Implement [Accept] action (call `/api/orgs/invitations/accept`)
- [ ] Redirect to org after successful acceptance

## Phase 10: Superadmin UI

- [ ] Create `app/(protected)/admin/organizations/page.tsx` - Org list for superadmin
- [ ] Table: Name, Slug, Members, Created, Updated
- [ ] Actions: [View] (jump to org), [Edit] (modal to change name/slug)
- [ ] Search by name/slug
- [ ] Pagination
- [ ] Create `app/(protected)/admin/users/page.tsx` - Users list for superadmin
- [ ] Table: Email, Name, Role, Orgs (count), Created
- [ ] Action: [View] (show user details/memberships)
- [ ] Search by email/name
- [ ] Pagination

## Phase 11: Landing & Routing Logic

- [ ] Update `app/(protected)/layout.tsx` to resolve current org from slug
- [ ] Implement org context resolution server-side
- [ ] Pass org context to `DashboardShell` as props
- [ ] Create `app/page.tsx` or root landing logic:
  - Check `__last_org` cookie → redirect if valid
  - Else check `user.defaultOrganizationId` → redirect if exists
  - Else redirect to org picker
- [ ] Update middleware to allow public `/invite` route

## Phase 12: Superadmin Seeding

- [ ] Copy `scripts/seed-superadmin.ts` from skill
- [ ] Update script with your database connection
- [ ] Run script to create first superadmin: `tsx scripts/seed-superadmin.ts`
- [ ] Verify superadmin user in database
- [ ] Document superadmin credentials securely

## Phase 13: Security Audit

Go through `references/security_checklist.md` and verify:

- [ ] All API routes use Node runtime
- [ ] All mutating endpoints validate CSRF
- [ ] All tenant data uses `scopeTenant()` helper
- [ ] All permission checks in place (admin, membership, superadmin)
- [ ] Last admin protection working
- [ ] Invitation tokens are hashed (bcrypt)
- [ ] Rate limits enforced
- [ ] Audit logging complete
- [ ] Reserved slugs enforced
- [ ] Cookies are httpOnly + secure (production)

## Phase 14: Testing & Edge Cases

- [ ] Test invitation with mismatched email → 403
- [ ] Test demote/remove last admin → 400 blocked
- [ ] Test self-demotion by admin → 400 blocked
- [ ] Test slug collision → 400
- [ ] Test reserved slug → 400
- [ ] Test org creation disabled → 403
- [ ] Test org creation limit exceeded → 400
- [ ] Test expired invitation → error state
- [ ] Test revoked invitation → error state
- [ ] Test already member accepting invite → informational
- [ ] Test superadmin accessing any org → allowed
- [ ] Test org deletion clears defaultOrganizationId → verified
- [ ] Test last_org cookie persistence and fallback
- [ ] Test mobile responsive tables and menus

## Phase 15: Documentation

- [ ] Document how to seed superadmin
- [ ] Document org creation toggles and limits
- [ ] Document reserved slugs configuration
- [ ] Document rate limiting settings
- [ ] Update README with multi-tenant setup instructions
- [ ] Add inline code comments for complex permission logic

## Phase 16: Production Readiness

- [ ] All cookies `secure: true` in production
- [ ] HTTPS enforced
- [ ] Database connection pooling configured
- [ ] Audit logs retention policy defined
- [ ] Monitoring for rate limit violations
- [ ] Backup strategy for tenant data
- [ ] Superadmin access restricted to trusted operators
- [ ] Seed scripts excluded from production builds

---

## Quick Validation

After implementation, verify these key flows:

1. **User creates org** → becomes admin → can invite members
2. **User accepts invite** → joins org → sees org in switcher
3. **Admin changes member role** → audit logged
4. **Admin tries to remove last admin** → blocked
5. **Superadmin deletes org** → cascades memberships → clears defaultOrganizationId
6. **User switches orgs** → last_org cookie updated → context changes
7. **Expired invite accessed** → clear error state shown

If all flows work, multi-tenant support is complete!
