      consistently; server layout still enforces role.

Organizations List Page

- File: app/admin/organizations/page.tsx (server component).
- Inputs via searchParams: page (default 1), pageSize (10|20|50; default 20), q
  (search name/slug), sort (createdAt|name), dir (asc|desc; defaults to createdAt
  desc).
- Query:
  - db.organization.findMany({ where: { OR: [{ name: { contains: q, mode:
    'insensitive' }}, { slug: { contains: q, mode: 'insensitive' }}] }, include:
    { \_count: { select: { memberships: true } } }, orderBy, skip, take }).
  - db.organization.count({ where }) for total.
- UI:
  - shadcn Table columns: Name, Slug, Members (\_count.memberships), Created,
    Actions.
  - Actions: “View” → /admin/organizations/[slug].
  - Top controls: Search input (debounced), Sort Select, PageSize Select
    (10/20/50).
  - Footer: shadcn Pagination component; URL reflects params.

Organization Detail Page

- File: app/admin/organizations/[orgSlug]/page.tsx (server component).
- Load org by slug; 404 if missing.
- Fetch members with pagination:
  - db.membership.findMany({ where: { organizationId: org.id }, include: { user:
    { select: { id, email, name, createdAt } } }, orderBy: { createdAt: 'asc' },
    skip, take }), plus count.
- UI sections:
  - Header: Name, Slug, Created, Member count.
  - Members table: Name, Email, Role (inline change), Joined, Actions.
- Actions (client subcomponents inside the page):
  - Role change: PATCH /api/orgs/[slug]/members/[userId] with { role:
    'admin'|'member' }. Use shadcn Select (values are semantic strings; no empty
    string).
  - Remove member: DELETE /api/orgs/[slug]/members/[userId] with confirm dialog.
  - Delete organization: client dialog requiring typing the org slug to enable
    the Delete button; on confirm, DELETE /api/orgs/[slug].
- “Last admin” UX:
  - Preload adminCount once. If adminCount <= 1, disable demote/remove for the
    only admin with tooltip. Keep server fallback check.

API Changes (server-only, Node runtime)

- Reuse existing endpoints:
  - GET /api/orgs/[orgSlug]/members
  - PATCH /api/orgs/[orgSlug]/members/[userId]
  - DELETE /api/orgs/[orgSlug]/members/[userId]
- New endpoint:
  - DELETE /api/orgs/[orgSlug] in app/api/orgs/[orgSlug]/route.ts:
    - export const runtime = 'nodejs'.
    - CSRF validation via validateCsrf.
    - Require isSuperadmin(user.id); 403 otherwise.
    - In a transaction:
      - user.updateMany to set defaultOrganizationId = null where it equals
        the org id.
      - Optionally compute memberCount beforehand for audit metadata.
      - organization.delete({ where: { id } }) to cascade memberships/
        invitations.
      - auditLog.create({ action: 'org_deleted', userId, email,
        organizationId: org.id, metadata: { slug, memberCount } }).
      - Because AuditLog.organization uses onDelete: SetNull, ensure the
        create occurs before delete or write organizationId: null with the
        slug in metadata.
    - Return 204 No Content or { success: true }.

Sidebar User Menu Link

- Modify components/features/dashboard/sidebar.tsx and dashboard-shell.tsx:
  - Add optional prop isSuperadmin?: boolean (default false).
  - In both expanded and collapsed user menus, conditionally render a
    DropdownMenuItem with Lucide Building2 labeled “Manage Organizations”
    → /admin/organizations if isSuperadmin is true OR currentOrg?.role ===
    'superadmin'.
- In app/o/[orgSlug]/layout.tsx, pass isSuperadmin={userIsSuperadmin} to
  DashboardShell.
- In app/admin/layout.tsx, pass isSuperadmin={true} and omit currentOrg.

Client Components (minimal and focused)

- components/features/admin/role-select.tsx:
  - Client-only small select for role; PATCH to update; toast on success/error;
    optimistic update optional.
- components/features/admin/remove-member-button.tsx:
  - Client-only button with shadcn Dialog confirm; DELETE member; toast on
    success/error; refresh or mutate list.
- components/features/admin/delete-organization-dialog.tsx:
  - Client-only dialog with input to type slug; enforce pointer-events restore
    on close; DELETE org and then router.replace('/admin/organizations'); success
    toast.

UX & Validation

- Search is case-insensitive substring against name and slug.
- Default sort: createdAt desc. Allow toggling to name asc/desc and createdAt asc.
- Page size: 10/20/50 (default 20), persisted in URL.
- Use Sonner toasts; handle network errors clearly.
- Dialogs opened from dropdowns follow pointer-events restoration pattern.

Security & Guardrails

- All DB operations in server components or Node route handlers (no Edge DB).
- CSRF origin/referer validation on all mutating calls.
- Superadmin-only checks server-side; never rely solely on UI visibility.
- Preserve existing “last admin” protection on the server; UI disables actions
  when possible.

Audit Logging

- Already covered for role changes and removals in existing routes.
- Add org_deleted entry with relevant metadata (slug, memberCount).

Middleware Update

- Update middleware.ts to treat /admin as protected (like /o/ and /onboarding) to
  benefit from token auto-rotation and consistent redirects.

Acceptance Criteria

- Only superadmins can load /admin/organizations and /admin/organizations/[slug].
- List supports search, sort, pagination; shows member counts.
- Detail page lists members with role change and removal; “last admin” cannot be
  demoted/removed (disabled UI + server guard).
- “Manage Organizations” appears in the user menu only for superadmins (both
  collapsed and expanded).
- Deleting an organization requires typing its slug; cascades members/invitations;
  users’ defaultOrganizationId cleared; audit log written.
- Middleware protects /admin paths.

Work Steps (implementation order)

- Add app/admin/layout.tsx with superadmin guard; render DashboardShell passing
  isSuperadmin.
- Add app/admin/organizations/page.tsx with server-side Prisma queries for list;
  wire search/sort/pagination.
- Add app/admin/organizations/[orgSlug]/page.tsx with member list, adminCount, and
  place small client action components.
- Add client components: role select, remove member, delete org dialog.
- Add DELETE /api/orgs/[orgSlug] (Node runtime, CSRF, audit, transaction).
- Update components/features/dashboard/{dashboard-shell,sidebar}.tsx to accept/use
  isSuperadmin; render “Manage Organizations”.
- Update app/o/[orgSlug]/layout.tsx to pass isSuperadmin; keep existing
  currentOrg.role = 'superadmin' behavior.
- Update middleware.ts to include /admin in protected paths.
- Manual QA against Acceptance Criteria.

No more questions from me—your 12 choices cover the key decisions and I’m confident
to implement with this plan. If you want any additional UI touches (e.g., show
createdBy, quick stats on the list, or an Overview tab), I can fold them in after
the core is done.
