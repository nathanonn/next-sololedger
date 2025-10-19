## Summary

This plan delivers reusable, responsive organization settings components and tightens permissions/edge cases while ensuring the Members and Pending Invitations lists always reflect the latest data after actions. We’ll keep Danger Zone only on the admin’s General tab, prevent admins from demoting/removing themselves, optionally filter superadmins out of the org-level member view, and hide “Organization” from member-only users in the sidebar/user menu. Data refresh will be explicit via hooks and success callbacks rather than relying on page-level reloads.

## Scope & Deliverables

- Reuse and enhance Organization Details block across admin and org-level settings
- Show Danger Zone only on admin/general tab
- Extract a reusable Members List component with Invite button, pagination, and actions
- Extract a reusable Pending Invitations List component with resend/revoke + confirmations
- Explicit client-side refetch strategy for both lists on successful actions
- API hardening:
  - Superadmin-only slug updates
  - Optional `excludeSuperadmins` for members index
  - Prevent org admin self-demote/self-remove; always-1-admin invariant
- Sidebar/user menu visibility: hide Organization for member-only roles

## Components and Files

Existing:

- `components/features/organization/organization-general-card.tsx`
- `components/features/organization/organization-danger-zone.tsx`
- `components/features/organization/organization-settings-layout.tsx`
- `components/features/organization/organization-tabs.tsx`
- `components/features/admin/*` (dialogs/buttons already implemented)

New (reusable):

- `components/features/organization/members-list.tsx`
- `components/features/organization/pending-invitations-list.tsx`
- `hooks/use-members.ts` and `hooks/use-invitations.ts` (lightweight fetch + refetch)

Pages to wire:

- Admin: `app/admin/organizations/[orgSlug]/(tabs)/general/page.tsx`, `.../(tabs)/members/page.tsx`
- Org-level: `app/o/[orgSlug]/settings/organization/(tabs)/general/page.tsx`, `.../(tabs)/members/page.tsx`

API touched:

- `app/api/orgs/[orgSlug]/route.ts` (PATCH)
- `app/api/orgs/[orgSlug]/members/route.ts` (GET)
- `app/api/orgs/[orgSlug]/members/[userId]/route.ts` (PATCH, DELETE)

Sidebar/user menu:

- `components/features/dashboard/sidebar.tsx`

## Implementation Details

### 1) Organization Details: reuse and enhance

- Keep `OrganizationGeneralCard` with `EditOrganizationButton`/`EditOrganizationDialog`.
- Add a `canEditSlug` prop to `EditOrganizationDialog` to hide/disable the slug input for non-superadmins.
- Pass `canEditSlug` from server pages based on `isSuperadmin(user.id)`.
- Keep existing cookie/redirect logic when slug changes.

API (PATCH /api/orgs/[orgSlug]):

- Allow name updates for admin/superadmin.
- Only allow slug updates for superadmin; otherwise return 403.
- Keep slug format/reserved/uniqueness validation.

### 2) Danger Zone placement

- Render `OrganizationDangerZone` only in admin general tab page.
- Remove from org-level general tab page.

### 3) MembersList (reusable)

- Props: `{ orgSlug: string; context: 'admin' | 'org'; excludeSuperadmins?: boolean }`.
- Renders:
  - Header with right-aligned `InviteMemberDialog`.
  - Table: Name, Email, Role, Joined, Actions (Edit, Remove).
  - Pagination with 10/20/50 page sizes.
- Behavior differences:
  - When `context==='org'`, pass `excludeSuperadmins=true` to the API query.

### 4) PendingInvitationsList (reusable)

- Props: `{ orgSlug: string }`.
- Fetch from `GET /api/orgs/[orgSlug]/invitations`.
- Each item shows: email, role badge, invited by, created date, days to expiry.
- Actions: Resend (POST) and Revoke (DELETE) with confirmation dialogs.

### 5) Data Refresh Strategy

- Add hooks:
  - `useMembers(orgSlug, { page, pageSize, excludeSuperadmins }) -> { data, isLoading, error, refetch, setPage, setPageSize }`
  - `useInvitations(orgSlug) -> { items, isLoading, error, refetch }`
- Update existing dialogs/buttons to accept callbacks:
  - `InviteMemberDialog({ onInvited })`
  - `EditMemberDialog({ onEdited })`
  - `RemoveMemberButton({ onRemoved })`
- On success, invoke callbacks to refetch without relying on `router.refresh()`.

### 6) API Changes and Constraints

- `PATCH /api/orgs/[orgSlug]`:
  - If `slug` is present and user is not superadmin: return 403.
- `GET /api/orgs/[orgSlug]/members`:
  - Support `excludeSuperadmins=true` to filter out users with `user.role==='superadmin'`.
- `PATCH /api/orgs/[orgSlug]/members/[userId]`:
  - If requester is org admin (not superadmin) and `userId===requesterId`, block changing own role to member.
  - Keep last-admin guard.
- `DELETE /api/orgs/[orgSlug]/members/[userId]`:
  - If requester is org admin (not superadmin) and `userId===requesterId`, block self-removal.
  - Keep last-admin guard.

### 7) Sidebar/User Menu Visibility

- In `sidebar.tsx`, hide the “Organization” menu item when `currentOrg.role==='member'`.
- Keep “Members” entry for admin/superadmin only (already in place).

### 8) Responsiveness

- Ensure full-width cards/tables; wrap long content; preserve mobile usability.
- Keep “Invite Member” right-aligned above the table in both contexts.

## Acceptance Criteria

Functional:

- Editing org name works for admin/superadmin; slug editing only for superadmin, with validation and redirect.
- Danger Zone shown only in admin general tab; not visible in org-level settings.
- Members list shows correct data with pagination; org-level excludes superadmins.
- Invite/Edit/Remove actions update the Members list immediately.
- Resend/Revoke actions show confirmation dialogs and update the Pending Invitations list immediately.
- Admin cannot demote/remove self; last-admin cannot be demoted/removed; clear error toasts/messages.
- “Organization” option hidden for member-only users in the user menu.

Non-functional:

- Components reusable across admin and org contexts.
- No client-side exposure of secrets; Node runtime for API routes.
- Typescript strict; follow project conventions.

## Rollout (PRs)

1. API hardening
   - Superadmin-only slug updates; self-demote/self-remove guards; `excludeSuperadmins` query.
2. Reusable UI + hooks
   - `MembersList`, `PendingInvitationsList`, `useMembers`, `useInvitations`; add callbacks to dialogs/buttons; wire refetch.
3. Pages wiring + visibility
   - Replace inline tables with reusable components; adjust Danger Zone placement; hide Organization in user menu for members.
4. QA & polish
   - Copy and micro-UX; edge cases; accessibility sweep.

## Test Matrix (manual)

- Edit org (admin): name-only; slug hidden.
- Edit org (superadmin): slug change; slug taken/reserved/invalid; redirect and cookie update.
- Members: invite -> appears in invitations; after acceptance path out-of-scope; list refresh works.
- Members: edit role/name -> list refresh; cannot demote last admin; admin self-demotion blocked.
- Members: remove -> list refresh; cannot remove last admin; admin self-removal blocked.
- Pending invitations: resend/revoke with confirm; list refresh.
- Org-level members exclude superadmins.
- Danger Zone only on admin general tab.
- User menu: Organization hidden for members.
