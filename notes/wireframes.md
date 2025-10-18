# Admin • Manage Organizations — UX Flow & ASCII Wireframes

  This document captures the superadmin-only admin area at /admin/organizations. It includes the flow map, route/query contracts, and screen-by-screen ASCII wireframes. Decisions applied: separate details page (1/a), selectable page
  size 10/20/50 default 20 (2/c), sort by name and createdAt asc/desc (3/b), search by name/slug (4/b), hard delete with confirm by slug (5/a + 12/b), members table only (6/a), roles admin|member (7/a), disable demote/remove when last
  admin (8/b), user-menu link label: “Manage Organizations” (9/b), /admin covered by middleware (10/a), server-first queries (11/a).

  ## Flow Map

  Sign in → Any protected page (e.g., /o/[slug]/dashboard)
     │
     └─ Open user menu in sidebar
          │
          └─ Click “Manage Organizations” (superadmin only)
                │
                └─ /admin/organizations  (List)
                      │               │                 │
           (Search/Sort/PageSize)   (Pagination)      (Row: View)
                      │               │                 │
                      └───────────────┴─────────────────┘
                                        │
                                        └─ /admin/organizations/[orgSlug]  (Details)
                                              │                 │                 │
                                       (Change Role)      (Remove Member)   (Delete Org)
                                              │                 │                 │
                                     PATCH /members     DELETE /members     DELETE /org
                                     [userId] role      [userId]            [orgSlug]

  ## Routes & Query Contracts

  - /admin/organizations
      - page (number, default 1)
      - pageSize (10|20|50, default 20)
      - q (string, optional; matches name or slug, case-insensitive)
      - sort (name|createdAt, default createdAt)
      - dir (asc|desc, default desc when sort=createdAt, else asc)
  - /admin/organizations/[orgSlug]
      - page (number, default 1)
      - pageSize (10|20|50, default 20)
      - q (string, optional; filters members by email/name substring)

  Notes

  - All mutations use CSRF-validated Node runtime APIs and show Sonner toasts.
  - UI disables demote/remove for the last admin when adminCount <= 1 (server still enforces).

  ———

  ## Entry Point (User Menu)

  Collapsed sidebar (icon-only) user menu shows an item for superadmins:

  [ Avatar ]  ▼
    ├─ Profile
    ├─ Organization (when in /o/…)
    ├─ Members (when admin/superadmin in /o/…)
    ├─ Manage Organizations   ← superadmin only
    └─ Sign out

  Expanded sidebar user menu (footer):

  ┌─────────────────────────────────────────────┐
  │ My Account                                  │
  ├─────────────────────────────────────────────┤
  │ Profile                                     │
  │ Organization (contextual)                   │
  │ Members (contextual)                        │
  │ Manage Organizations    ← superadmin only   │
  ├─────────────────────────────────────────────┤
  │ Sign out                                    │
  └─────────────────────────────────────────────┘

  ———

  ## Screen 1 — Organizations List (/admin/organizations)

  +--------------------------------------------------------------------------------+
  | Admin • Manage Organizations                                                   |
  |                                                                                |
  | Search: [________________________]   Sort: [ Name ▼ ]   Dir: (• Asc ○ Desc)   |
  | Page size: ( 10 ○ 20 • 50 ○ )       Showing rows 1–20 of 132                  |
  |                                                                                |
  | ┌────────────────────────────────────────────────────────────────────────────┐ |
  | | Name                 | Slug              | Members | Created       | View | | |
  | |───────────────────────────────────────────────────────────────────────────| | |
  | | Acme Corp           | acme-corp         |     12  | 2025-09-17    | 🔍   | | |
  | | Beacon Analytics    | beacon-analytics  |      7  | 2025-08-04    | 🔍   | | |
  | | Nimbus Labs         | nimbus-labs       |     31  | 2025-07-22    | 🔍   | | |
  | | …                                                                    …    | | |
  | └────────────────────────────────────────────────────────────────────────────┘ |
  |                                                                                |
  | « Prev   1   2   3   …   7   Next »                                            |
  +--------------------------------------------------------------------------------+

  Interactions

  - Search debounced (updates q, resets page=1).
  - Sort switches between name and createdAt; dir toggles asc/desc.
  - Page size radio updates pageSize, resets page=1.
  - View icon (🔍) goes to /admin/organizations/[orgSlug].

  Empty State

  +----------------------------------------------+
  | No organizations found                        |
  | Try adjusting your search or filters.         |
  +----------------------------------------------+

  ———

  ## Screen 2 — Organization Details (/admin/organizations/[orgSlug])

  +--------------------------------------------------------------------------------+
  | ← Back to Organizations                                                         |
  |                                                                                 |
  | Organization: Acme Corp   (acme-corp)                                           |
  | Created: 2025-09-17   •   Members: 12                                           |
  |                                                                                 |
  | [ Delete Organization ]  (destructive)                                          |
  |                                                                                 |
  | Members                                                                          |
  | Search: [__________________]    Page size: ( 10 ○ 20 • 50 ○ )                   |
  | Showing rows 1–20 of 12                                                          |
  |                                                                                 |
  | ┌────────────────────────────────────────────────────────────────────────────┐  |
  | | Name           | Email                     | Role       | Joined      | ⚙ |  |
  | |──────────────────────────────────────────────────────────────────────────|  |
  | | Jane Admin     | jane@acme.com             | [admin ▾]  | 2025-09-17  | ⓘ|  |
  | | John Member    | john@acme.com             | [member ▾] | 2025-09-19  | ✖ |  |
  | | …                                                                       … |  |
  | └────────────────────────────────────────────────────────────────────────────┘  |
  |                                                                                 |
  | « Prev   1   Next »                                                              |
  +--------------------------------------------------------------------------------+

  Notes

  - Role column is an inline Select with values: admin, member (no empty string).
  - When the listed user is the last admin (adminCount <= 1 and this row is admin):
      - Role Select is disabled; an info icon (ⓘ) shows tooltip: “Cannot demote the last admin.”
      - Remove action (✖) is disabled with tooltip: “Cannot remove the last admin.”

  Empty State (no members)

  +----------------------------------------------+
  | No members yet                                |
  | Invite users from the organization settings.  |
  +----------------------------------------------+

  ———

  ## Dialogs

  Remove Member (shadcn Dialog)

  +-------------------------------+
  | Remove Member                 |
  |                               |
  | Are you sure you want to      |
  | remove john@acme.com from     |
  | “Acme Corp”?                   |
  |                               |
  | [ Cancel ]   [ Remove ]       |
  +-------------------------------+

  Delete Organization (requires typing slug)

  +-----------------------------------------------+
  | Delete Organization                           |
  |                                               |
  | This will permanently delete “Acme Corp”,     |
  | remove all memberships and invitations.       |
  | Audit logs will be retained.                  |
  |                                               |
  | Type the slug to confirm:                     |
  |  [ acme-corp____________________________ ]    |
  |                                               |
  | [ Cancel ]     [ Delete ] (disabled until     |
  |                               exact match)    |
  +-----------------------------------------------+

  Pointer Events Restoration (Dropdown → Dialog)

   // When opening Dialog from a Dropdown/ContextMenu, ensure on close:
   setTimeout(() => { document.body.style.pointerEvents = "" }, 300)

  ———

  ## Behaviors & Feedback

  - Success: Sonner toast top-right (e.g., “Role updated”, “Member removed”, “Organization deleted”).
  - Failure: Sonner error toast with API message. Server still enforces last-admin protection.
  - Navigation: After delete, redirect to /admin/organizations and refresh list.

  ## Permissions & Security

  - /admin/* is protected by middleware and server guard; only superadmins pass.
  - All mutations are CSRF-validated and run on Node runtime; no Edge DB operations.
  - UI visibility (Manage Organizations link, destructive buttons) is not a security boundary.

  ## Data Requirements (SSR)

  - List page: organization fields { id, name, slug, createdAt }, _count.memberships for member counts.
  - Details page: organization header + paginated membership rows with user { id, email, name, createdAt }, role, joinedAt.
  - Precompute adminCount once per details view to drive “last admin” disables.