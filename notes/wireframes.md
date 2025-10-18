# Admin Organization Management — UX Flow Map and ASCII Wireframes

  Updated: 2025-10-18

  This document maps the superadmin organization management flows and shows the screen-by-screen content using lightweight ASCII wireframes. It covers: creating an
  organization, navigating back to an org dashboard from the admin area, editing organization details (including slug), managing members (read-only role in table +
  edit dialog), and inviting new members.

  Legend:

  - [btn] denotes a clickable button, (link) denotes a link.
  - (icon) indicates a Lucide icon next to a label.
  - … indicates omitted repeated rows.
  - Toasts are implied for success/error; no extra <Toaster /> is added.

  ———

  Flow Map (Superadmin)

  1. Admin → Manage Organizations → Create Organization

     /admin/organizations
     └─[btn Create Organization] → Create Organization Dialog
     └─ POST /api/orgs (CSRF-validated)
     ├─ success → redirect → /admin/organizations/{slug}
     └─ error → inline error + toast
  2. Back to Organization Dashboard (from any /admin page)

     /admin/* (sidebar user menu)
     └─ [menu Back to Organization Dashboard] (only if superadmin AND last-org cookie exists)
     └─ navigate → /o/{lastOrgSlug}/dashboard
  3. Admin Org Detail → Edit Organization

     /admin/organizations/{orgSlug}
     └─ [btn Edit Organization] → Edit Organization Dialog
     └─ PATCH /api/orgs/{orgSlug} { name?, slug? }
     ├─ success (slug changed) → update last-org cookie if matched old slug → redirect → /admin/organizations/{newSlug}
     ├─ success (slug unchanged) → refresh
     └─ error → inline error + toast
  4. Admin Org Detail → Members
      - Table shows Role as plain text (no inline selector).
      - Actions column has [icon Edit] (opens dialog) and existing [icon Remove].
      - Invite Member from header button.

     Edit Member Dialog → PATCH /api/orgs/{orgSlug}/members/{userId} { name?, role? }
     ├─ success → refresh
     └─ error → inline error + toast (prevents demoting last admin)

     Invite Member Dialog → POST /api/orgs/{orgSlug}/invitations { name?, email, role, sendEmail? }
     ├─ success → show invite URL with Copy; if sendEmail true (and Resend configured) → emailed
     └─ error → inline error + toast

  ———

  Screen-by-Screen Wireframes

  1. Manage Organizations (List)

  Route: /admin/organizations

  +----------------------------------------------------------------------------------+
  | Manage Organizations                                                            |
  | View and manage all organizations in the system                                 |
  |                                                                                  |
  | [ Search by name/slug ............... ]  Sort:[v]  Order:[v]  Per page:[v]   [btn|
  |                                                                            Create|
  |                                                                      Organization]|
  |                                                                                  |
  | Results: Showing X–Y of Z                                                        |
  |                                                                                  |
  |  Name                | Slug              | Members | Created     | Actions        |
  |----------------------------------------------------------------------------------|
  |  Acme Inc            | acme              |     12  | 2025-09-01  | [icon Eye]View |
  |  Example Org         | example           |      3  | 2025-10-10  | [icon Eye]View |
  |  …                                                                               |
  |----------------------------------------------------------------------------------|
  |  [ Prev ]   1  2  3  4  5   [ Next ]                                          |
  +----------------------------------------------------------------------------------+

  Interactions

  - Create Organization opens the dialog below.
  - Clicking View navigates to /admin/organizations/{slug}.

  2. Create Organization — Dialog

  Trigger: [btn Create Organization]

  +-------------------------------- Create Organization -----------------------------+
  | Name *                                                                          |
  | [ _________________________________________________ ]                            |
  |                                                                                  |
  | Slug (optional, kebab-case)                                                      |
  | [ __________________________ ]                                                   |
  | URL Preview: https://your-app/o/<slug-or-suggestion>                             |
  |                                                                                  |
  | [ Cancel ]                                                       [ Create ]      |
  +----------------------------------------------------------------------------------+

  Validation & States

  - Name required, ≤ 255 chars. Slug validated client-side and server-side.
  - Duplicate or reserved slug returns server error → inline message + toast.error.
  - On success → redirect to /admin/organizations/{slug}.

  3. Organization Detail (Admin)

  Route: /admin/organizations/{orgSlug}

  +----------------------------------------------------------------------------------+
  | (link) ← Back to Organizations                                                   |
  |                                                                                  |
  | {Org Name}                                                                       |
  | slug: {orgSlug}                                                                  |
  | Created: 2025-09-01   •   Members: 12                                           |
  |                                                                                  |
  | [btn Edit Organization]                                  [btn Delete Organization]|
  |                                                                                  |
  | Members                                                            [btn Invite]  |
  | Showing A–B of N                                                                 |
  |                                                                                  |
  |  Name / Email                         | Role     | Joined      | Actions         |
  |----------------------------------------------------------------------------------|
  |  Jane Doe                              Admin      2025-09-02    [icon Pencil]Edit |
  |  jane@acme.com                                                            [🗑]   |
  |----------------------------------------------------------------------------------|
  |  John Smith                            Member     2025-09-03    [icon Pencil]Edit |
  |  john@acme.com                                                             [🗑]  |
  |----------------------------------------------------------------------------------|
  |  …                                                                               |
  |----------------------------------------------------------------------------------|
  |  Page {p} of {totalPages}      [ Prev ]                    [ Next ]              |
  +----------------------------------------------------------------------------------+

  Notes

  - Role column is plain text (“Admin” / “Member”).
  - Remove button is disabled when the user is the last admin (tooltip explains why).
  - Edit icon opens Edit Member dialog.
  - Invite opens Invite Member dialog.

  4. Edit Organization — Dialog

  Trigger: [btn Edit Organization]

  +------------------------------- Edit Organization --------------------------------+
  | Name *                                                                          |
  | [ _________________________________________________ ]                            |
  |                                                                                  |
  | Slug (kebab-case)                                                                |
  | [ __________________________ ]                                                   |
  | URL Preview: https://your-app/o/<new-slug>                                       |
  |                                                                                  |
  | [ Cancel ]                                                       [ Save Changes ] |
  +----------------------------------------------------------------------------------+

  Validation & States

  - Slug change validated server-side (unique, not reserved, kebab-case).
  - On success with slug change → update last-org cookie if it matched old slug; redirect to new admin URL.
  - On success without slug change → refresh page.

  5. Edit Member — Dialog

  Trigger: Members table → [icon Pencil] Edit

  +---------------------------------- Edit Member -----------------------------------+
  | Email (read-only)                                                                  |
  | jane@acme.com                                                                      |
  |                                                                                   |
  | Name                                                                              |
  | [ Jane Doe ______________________________ ]                                        |
  |                                                                                   |
  | Role                                                                              |
  | [ Member v ]  (options: Admin, Member)                                            |
  |                                                                                   |
  | [ Cancel ]                                             [ Save Changes ]           |
  +-----------------------------------------------------------------------------------+

  Validation & States

  - Changing Role to Member for the last admin returns an error from the server (toast.error + inline message).
  - Changing Name updates the global user.name.

  6. Invite Member — Dialog

  Trigger: Members header → [btn Invite]

  +-------------------------------- Invite Member -----------------------------------+
  | Name (optional)                                                                   |
  | [ __________________________________________ ]                                    |
  |                                                                                   |
  | Email *                                                                           |
  | [ user@example.com _________________________ ]                                    |
  |                                                                                   |
  | Role *                                                                            |
  | [ Member v ]  (options: Admin, Member)                                            |
  |                                                                                   |
  | [ ] Send email invitation (if email provider configured)                          |
  |                                                                                   |
  | [ Cancel ]                                             [ Send Invite ]            |
  +-----------------------------------------------------------------------------------+

  Post-Send State (Success)

  +-------------------------------- Invite Sent -------------------------------------+
  | Invitation link:                                                                  |
  | https://your-app/invite?token=XXXXXXXXXXXXXXXXXXXX                                |
  |                                                                                   |
  | [btn Copy Link]           [btn Open Invite Page]                                  |
  |                                                                                   |
  | (If email sending ON) “Email sent to user@example.com”                            |
  +-----------------------------------------------------------------------------------+

  7. Sidebar User Menu (Admin Context, Superadmin Only)

  Context: Any /admin/* route, last-org cookie available.

  +------------------- User Menu -------------------+
  | My Account                                      |
  | ---------------------------------------------- |
  | Profile                                         |
  | Organization                                    |
  | Members                                         |
  | ---------------------------------------------- |
  | Back to Organization Dashboard                  |
  |  → /o/{lastOrgSlug}/dashboard                   |
  | ---------------------------------------------- |
  | Manage Organizations                            |
  | Sign out                                        |
  +------------------------------------------------+

  Visibility Rules

  - “Back to Organization Dashboard” only appears for superadmins on /admin/* when a valid last-org cookie exists.

  ———

  Validation, Feedback, and Patterns

  - Forms use React Hook Form + Zod; show inline validation and Sonner toasts.
  - Select values are semantic (“admin”, “member”); never use empty string values.
  - Dialogs restore pointer events on close per the required pattern.
  - All mutating requests use same-origin fetch (Origin/Referer CSRF check passes).
  - Last admin protections enforced server-side; UI disables where applicable.
  - No additional <Toaster /> is added (already present in root layout).