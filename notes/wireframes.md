# UX Flow and Wireframes — Superadmin Organization Settings Tabs

This document maps the UX flow and provides screen-by-screen ASCII wireframes for the superadmin organization detail refactor using tabs (General, Members).

## UX Flow Map

1. Admin Organizations List → Select Organization (View)
   - Default target: `/admin/organizations/[orgSlug]/general`
   - Optional deep link: `/admin/organizations/[orgSlug]/members`

2. Organization Tabs Layout
   - Header with back link, org name, slug
   - Tabs below header: General | Members (with count)
   - Active tab determined by subroute segment

3. General Tab
   - Org metadata (name, slug)
   - Edit organization button
   - Danger zone Card with Delete Organization dialog

4. Members Tab
   - Invite member button
   - Members table (Name, Email, Role, Joined, Actions)
   - Client-driven pagination (updates URL query)
   - Role edit and remove actions, last-admin protection

5. Post-delete
   - Redirect to `/admin/organizations` with success toast

## Screen 1: Admin — Organizations List (context)

Route: `/admin/organizations`

```
+-----------------------------------------------------------------------------------+
| Manage Organizations                                                              |
+-----------------------------------------------------------------------------------+
| Search [                 ]   Sort [ Created ▾ ]  Size [ 20 ]        [ + New Org ] |
|-----------------------------------------------------------------------------------|
| Name           | Slug         | Members | Created     | Actions                   |
|-----------------------------------------------------------------------------------|
| Acme Inc.      | acme-inc     | 12      | 2025-09-10  | [ View ] [ View members ] |
| Beta Co.       | beta-co      | 3       | 2025-09-12  | [ View ] [ View members ] |
+-----------------------------------------------------------------------------------+
| [ Prev ]                    Page 1/5                        [ Next ]              |
+-----------------------------------------------------------------------------------+
```

Notes:

- “View” → `/admin/organizations/[orgSlug]/general`
- “View members” → `/admin/organizations/[orgSlug]/members`

## Screen 2: Admin — Organization Tabs Layout

Route: `/admin/organizations/[orgSlug]/(tabs)/*`

```
+-----------------------------------------------------------------------------------+
| ← Back to Organizations                                                           |
|                                                                                   |
| Acme Inc.   [ acme-inc ]                                                          |
+-----------------------------------------------------------------------------------+
| [ General ]   [ Members (12) ]                                                    |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  (Tab Content renders here)                                                       |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

Notes:

- Tabs below header; Members shows count badge.
- Active tab highlighted.

## Screen 3: General Tab

Route: `/admin/organizations/[orgSlug]/general`

```
+-----------------------------------------------------------------------------------+
| Organization Details                                                               |
+-----------------------------------------------------------------------------------+
| Name:  Acme Inc.                     [ Edit ]                                     |
| Slug:  acme-inc                       (read-only in view; editable via dialog)    |
+-----------------------------------------------------------------------------------+
| Danger zone                                                                    ⚠  |
|-----------------------------------------------------------------------------------|
| Deleting this organization is irreversible.                                       |
| It will remove all memberships and invitations.                                   |
|                                                                                   |
|                         [ Delete organization ]                                   |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

Delete dialog (confirmation):

```
+-------------------------------------------+
| Delete organization                        |
|-------------------------------------------|
| Are you sure? This action cannot be undone.|
| Type the slug to confirm: [ acme-inc      ]|
|                                           |
| [ Cancel ]                     [ Delete ]  |
+-------------------------------------------+
```

Notes:

- On success: redirect to `/admin/organizations` with success toast.

## Screen 4: Members Tab

Route: `/admin/organizations/[orgSlug]/members`

```
+-----------------------------------------------------------------------------------+
| Members                                                                           |
+-----------------------------------------------------------------------------------+
| [ Invite member ]                                                                 |
|-----------------------------------------------------------------------------------|
| Name           | Email                | Role    | Joined      | Actions           |
|-----------------------------------------------------------------------------------|
| Jane Doe       | jane@acme.com        | admin   | 2025-09-10  | [ Edit ] [ Rem ] |
| John Smith     | john@acme.com        | member  | 2025-09-11  | [ Edit ] [ Rem ] |
+-----------------------------------------------------------------------------------+
| [ Prev ]     Page 1/3     [ Next ]       Page size: [ 20 ▾ ]                      |
+-----------------------------------------------------------------------------------+
```

Notes:

- Client-driven pagination updates URL (`?page=2&pageSize=20`), re-fetches list.
- “Rem” triggers remove dialog; protect last admin.
- “Edit” triggers role edit dialog.
- Empty state (no members):

```
+-------------------------------------------+
| No members yet                             |
| Invite users to get started.               |
|                                           |
|            [ Invite member ]              |
+-------------------------------------------+
```

## Error and edge states

```
Toast (top-right): "Failed to load members. Please try again."
```

- Not found org: fall back to notFound/redirect.
- Last admin protection: show inline warning in dialog when attempting demote/remove.

## Post-delete flow

```
Redirect → /admin/organizations
Toast: "Organization deleted"
```
