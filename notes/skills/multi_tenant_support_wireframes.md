# Multi‑Tenant UX Flow and Wireframes

Portable UX flow and ASCII wireframes for a multi‑tenant app with Organizations, Memberships, Invitations, and a Superadmin area. Aligns with `multi_tenant_support.md`.

## Flow map

- Entry: `/` or `/dashboard`
  - Middleware verifies JWT; unauthenticated → `/login?next=...`
  - Server redirects by priority: `__last_org` → default org → first membership → any org (superadmin) → onboarding create org → denial

- Entry: `/o/[orgSlug]/*`
  - Server layout: load user + org + membership; superadmin bypass; render shell

- Org Settings
  - General: view name and immutable slug; edit name
  - Members: list, change role, remove (last‑admin protection)
  - Invitations: list pending, send, revoke; copy invite link; optional email send

- Admin Area (superadmin)
  - Organizations list with search/sort/pagination
  - Organization detail: members with per‑row actions; edit org; delete org

- Invite Acceptance
  - `/invite?token=...` → requires sign‑in → accept → redirect to `/o/[slug]/dashboard`

Security & guardrails

- All mutations require CSRF origin checks
- Membership/role checks server‑side
- Rate limits on invitation creation; friendly error messages
- Audit logs capture all changes

## Screen 1: Root Redirect Outcomes

+-----------------------------------------------------------------------------------+
| Visiting `/` |
+-----------------------------------------------------------------------------------+
| Case A: Has `__last_org` cookie and access → Redirect to /o/[slug]/dashboard |
| Case B: Has defaultOrganizationId and access → Redirect |
| Case C: Has memberships → Redirect to first org |
| Case D: Superadmin and any org exists → Redirect to any org |
| Case E: Can create org → Redirect to /onboarding/create-organization |
| Case F: Cannot create → Show Org Creation Denied |
+-----------------------------------------------------------------------------------+

## Screen 2: Org Shell (Sidebar + Content)

+-----------------------------------------------------------------------------------+
| Top Bar (border) |
| [☰] (md:hidden) [ App/Org Name ] [ Profile ▾ ] |
+-----------------------------------------------------------------------------------+
| Sidebar (resizable/collapsible) | Content Area (scrolls) |
|-------------------------------------------------|---------------------------------|
| [ Org Switcher ▾ ] [ + New Org ] (if allowed) | [ Page content ] |
| | |
| Sections | |
| - [🏠] Main | |
| - Dashboard (active) | |
| - [⚙️] Settings | |
| - Profile | |
| - Organization (admin/superadmin) | |
| - Members (admin/superadmin) | |
| | |
| Footer: [ 👤 you@example.com ] (Profile | Sign out) |
+-----------------------------------------------------------------------------------+

Notes

- Sidebar stores width and collapsed state per user in localStorage
- Mobile uses a left sheet with the same content; closes on navigation

## Screen 3: Onboarding – Create Organization

+-------------------------------------------+
| Create your first organization |
|-------------------------------------------|
| Name |
| [ Acme Inc. ] |
| |
| [ Create organization ] |
| |
| Error (if any): |
| "Organization creation is disabled…" |
+-------------------------------------------+

States

- Success → redirect to `/o/[slug]/dashboard`
- Disabled/limit reached → show denial screen with help text

## Screen 4: Org Settings – General

+-------------------------------------------+
| Organization Settings |
|-------------------------------------------|
| General |
|-------------------------------------------|
| Name |
| [ Acme Inc. ] |
| |
| Slug (immutable) |
| [ acme-inc ] (disabled) |
| https://app.local/o/acme-inc |
| |
| [ Save changes ] |
+-------------------------------------------+

## Screen 5: Org Settings – Members

+-----------------------------------------------------------------------------------+
| Members |
+-----------------------------------------------------------------------------------+
| [ Invite member ] |
|-----------------------------------------------------------------------------------|
| Name | Email | Role | Joined | Actions |
|-----------------------------------------------------------------------------------|
| Jane Doe | jane@acme.com | admin | 2025-09-10 | [ Edit ] [ X ] |
| John Smith | john@acme.com | member | 2025-09-11 | [ Edit ] [ X ] |
+-----------------------------------------------------------------------------------+

- Edit: change role to admin/member; save
- Remove: confirm; blocks if target is last admin

## Screen 6: Org Settings – Invitations

+-----------------------------------------------------------------------------------+
| Invitations |
+-----------------------------------------------------------------------------------+
| [ Invite member ] |
|-----------------------------------------------------------------------------------|
| Email | Role | Expires | Invited By | Actions |
|-----------------------------------------------------------------------------------|
| amy@example.com | member | 2025-10-22 | admin@acme.com | [ Copy ] [ ✉ ] |
| bob@example.com | admin | 2025-10-19 | admin@acme.com | [ Revoke ] |
+-----------------------------------------------------------------------------------+

Invite dialog

+-------------------------------------------+
| Invite member |
|-------------------------------------------|
| Email |
| [ you@example.com ] |
| Role |
| (•) member ( ) admin |
| Name (optional) |
| [ Amy Adams ] |
| [ ] Send email (if configured) |
| [ Create invite ] [ Cancel ] |
+-------------------------------------------+

Notes

- Rate limits: show structured 429 message on org/day or IP/15m exceed
- Always provide a copyable invite URL; email provider optional

## Screen 7: Invite Acceptance

+-------------------------------------------+
| You've been invited! |
|-------------------------------------------|
| Organization: Acme Inc. |
| Role: member |
| |
| [ Accept & Join ] [ Decline ] |
| |
| Notes: Sign in required; email must match. |
+-------------------------------------------+

Outcomes

- Success → redirect to `/o/[slug]/dashboard`, toast success
- Errors → structured: invalid/expired token, email mismatch, already member

## Screen 8: Admin – Organizations List (Superadmin)

+-----------------------------------------------------------------------------------+
| Manage Organizations |
+-----------------------------------------------------------------------------------+
| Search [ ] Sort [ Created ▾ ] Size [ 20 ] [ + New Org ] |
|-----------------------------------------------------------------------------------|
| Name | Slug | Members | Created | Actions |
|-----------------------------------------------------------------------------------|
| Acme Inc. | acme-inc | 12 | 2025-09-10 | [ View ] |
| Beta Co. | beta-co | 3 | 2025-09-12 | [ View ] |
+-----------------------------------------------------------------------------------+
| [ Prev ] Page 1/5 [ Next ] |
+-----------------------------------------------------------------------------------+

## Screen 9: Admin – Organization Detail (Superadmin)

+-----------------------------------------------------------------------------------+
| Acme Inc. [ acme-inc ] [ Edit ] [ Delete ] |
+-----------------------------------------------------------------------------------+
| Members |
| Name | Email | Role | Joined | Actions |
|-----------------------------------------------------------------------------------|
| Jane Doe | jane@acme.com | admin | 2025-09-10 | [ Edit ] [ Remove ] |
| John Smith | john@acme.com | member | 2025-09-11 | [ Edit ] [ Remove ] |
+-----------------------------------------------------------------------------------+
| [ Prev ] Page 1/3 [ Next ] |
+-----------------------------------------------------------------------------------+

Delete dialog

+-------------------------------------------+
| Delete organization |
|-------------------------------------------|
| Are you sure? This action cannot be undone.|
| This removes memberships and invitations. |
| |
| [ Cancel ] [ Delete ] |
+-------------------------------------------+

## Interaction Notes

- Membership checks run server‑side; superadmin bypasses
- Last‑admin protection enforced on edit/remove operations
- Slugs are immutable; show as read‑only
- Org switcher should respect access and creation policy
- Use toasts for success/error; keep responses structured

## Checklist (for implementation)

- [ ] Server layout gates `/o/[orgSlug]` by membership/superadmin
- [ ] Root redirect chain implemented with `LAST_ORG_COOKIE_NAME`
- [ ] Org settings: general, members, invitations screens
- [ ] Admin area: orgs list/detail screens
- [ ] Invitation accept flow with sign‑in requirement
- [ ] CSRF and rate limits wired on all mutating routes
- [ ] Audit logs on all organization/member/invite mutations
