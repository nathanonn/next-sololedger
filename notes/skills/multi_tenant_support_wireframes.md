# Multi‑Tenant UX Flow and Wireframes

Portable UX flow and ASCII wireframes for running a multi‑tenant app with Organizations, Members, and Invitations, plus Superadmin admin screens. Aligns with `multi_tenant_support.md` and chosen options.

Assumptions from your selections

- Entry points: centralized “Organizations” admin home plus per‑org settings under `/o/[orgSlug]/settings/organization` (1/a)
- Org switcher: top bar combobox; include mobile behavior (2/a, 19/yes)
- Landing: last_org cookie → defaultOrganization → org picker (3/a)
- Org picker: minimal list with actions (Name only) (4/b)
- Settings tabs: General | Members (Members includes invitations management) — “People” is named “Members” (5/b)
- General: edit Name; Slug editable by superadmin only; Danger Zone for delete (6/a)
- Members: actions Edit, Remove; Edit modal can change Name and Role; Email read‑only (7/a)
- Guardrails: prevent last admin demote/remove, block admin self‑demote/remove unless superadmin; allow self‑leave for members (8/a)
- Invitations: managed from Members tab; modal‑based invite creation (9/a with modal tweak)
- Accept invitation (public): validate token, require email match, show clear states (10/a)
- Superadmin admin: Organizations table with View/Edit (no Delete in row actions); delete is only from Danger Zone (11/a)
- Org deletion: two‑step confirm with org name input (12/a)
- Pagination: default 20; options [10, 20, 50] (13/a)
- Mobile tables: horizontal scroll, sticky header, actions in row menu (14/a)
- Empty states: action‑oriented CTAs (15/a)
- Tone: neutral, action‑oriented (16/a)
- Security callouts included (17/a)
- Reserved slugs: use env default (18/yes)
- Additional admin view: Superadmin → Users index (20/a)

Environment references

- ORG_CREATION_ENABLED, ORG_CREATION_LIMIT, ORG_RESERVED_SLUGS (env default used: `o,api,dashboard,settings,login,invite,onboarding,_next,assets,auth,public`), LAST_ORG_COOKIE_NAME (default `__last_org`)

## Flow map

- Entry: App landing
	- If `__last_org` cookie maps to an org you can access → redirect to `/o/[orgSlug]/…`
	- Else if `defaultOrganizationId` exists → redirect to that org
	- Else → show Org Picker

- Top bar Org Switcher (combobox)
	- Shows current org; typedown search; switches context → navigates to `/o/[orgSlug]/…` and sets `__last_org`

- Org Picker (minimal list)
	- For regular users: list “My organizations” with actions: [Go to], [Set default], [Leave] (if member)
	- If ORG_CREATION_ENABLED: [Create organization]
	- For superadmin: also show “All organizations” (global list)

- Organization Settings (under `/o/[orgSlug]/settings/organization`)
	- Tabs: General | Members
	- General: Name (editable), Slug (superadmin‑only), Created/Updated; Danger Zone: Delete (superadmin‑only)
	- Members: table with Edit (modal), Remove; Invite Member (modal)

- Accept Invitation (public `/invite?token=...`)
	- Validate token → show org info and role → Accept joins; handle expired/revoked/mismatch states

- Superadmin: Admin / Organizations
	- Table: Name, Slug, Members, Created, Updated; actions: [View], [Edit] (no Delete); search by name/slug

- Superadmin: Admin / Users
	- Table: Email, Name, Role, Orgs (count), Created; actions: [View user]

Security & guardrails (global)
- All mutations require CSRF + Origin/Referer checks; JWT session required
- Ownership/roles enforced server‑side (admin or superadmin where needed)
- Audit log all key events (org create/update/delete, invite create/accept/revoke/resend, member role change/remove/leave)

---

## Screen 0: Top Bar Org Switcher (Desktop + Mobile)

Goal: Quickly switch organizations from anywhere.

Desktop (combobox)

 +----------------------------------------+
 | [Org ▾]  | Search or select org…       |
 +----------------------------------------+
 | Recent                              ⌘K |
 | • Acme Inc (admin)                    |
 | • Beta Co (member)                    |
 | • Contoso (admin)                     |
 |----------------------------------------|
 | All                                   |
 |  Acme Inc                [ Go ]        |
 |  Beta Co                 [ Go ]        |
 |  Contoso                 [ Go ]        |
 |----------------------------------------|
 | [ Create organization ] (if allowed)   |
 +----------------------------------------+

Mobile

 - Switcher appears inside the left drawer above navigation
 - Selecting an org closes the drawer and navigates

Notes
- On switch: set LAST_ORG_COOKIE_NAME and navigate to `/o/[orgSlug]`
- Superadmin can search across all orgs; regular users see memberships only

---

## Screen 1: Org Picker (Minimal List)

Goal: Select or create an organization when no default/last org exists.

 +-----------------------------------------------------------------------------------+
 | Organizations                                                                      |
 +-----------------------------------------------------------------------------------+
 | My organizations                                                                   |
 |-----------------------------------------------------------------------------------|
 |  Acme Inc                      [ Go to ]  [ Set default ]  [ Leave ]               |
 |  Beta Co                       [ Go to ]  [ Set default ]  [ Leave ]               |
 |  Contoso                       [ Go to ]  [ Set default ]  [ Leave ]               |
 |-----------------------------------------------------------------------------------|
 | [ Create organization ] (visible when ORG_CREATION_ENABLED)                        |
 +-----------------------------------------------------------------------------------+

Empty states
- No orgs → “You’re not a member of any organization yet.” [Create organization] (if enabled) or “Accept an invitation.”

Security & guardrails
- “Leave” prompts confirmation; blocks leaving if you are the last admin in that org

---

## Screen 2: Organization Settings — General

Path: `/o/[orgSlug]/settings/organization`

 +-----------------------------------------------------------------------------------+
 | Settings / Organization                                                           |
 +-----------------------------------------------------------------------------------+
 | Tabs: [ General ]  [ Members ]                                                    |
 |-----------------------------------------------------------------------------------|
 | Organization Details                                                              |
 | Name:  [ Acme Inc                      ] [ Save ]                                  |
 | Slug:  [ acme-inc ]  (Superadmin only; read-only for admins)                      |
 |                                                                                   |
 | Created: 2025-08-01  | Updated: 2025-10-14                                        |
 |-----------------------------------------------------------------------------------|
 | Danger Zone (Superadmin only)                                                     |
 | [ Delete organization ]                                                           |
 |                                                                                   |
 | Confirm modal:                                                                    |
 |  “This permanently deletes the organization and its data.”                        |
 |  Type the organization name to confirm: [ Acme Inc ]                              |
 |  [ Cancel ] [ Delete ]                                                            |
 +-----------------------------------------------------------------------------------+

Validation & guardrails
- Slug edit requires superadmin; enforce reserved slugs and uniqueness
- Delete requires name input; cascades memberships/invitations; audits action

---

## Screen 3: Organization Settings — Members (with Invitations)

Path: `/o/[orgSlug]/settings/organization?tab=members` (or route segment)

 +-----------------------------------------------------------------------------------+
 | Settings / Organization / Members                                                 |
 +-----------------------------------------------------------------------------------+
 | Tabs: [ General ]  [ Members ]                                                    |
 |-----------------------------------------------------------------------------------|
 | Actions: [ Invite Member ]                                                        |
 |-----------------------------------------------------------------------------------|
 | Members                                                                           |
 | Columns: Name | Email | Role | Joined | Actions                                   |
 |-----------------------------------------------------------------------------------|
 | Jane Smith        jane@acme.com       admin   2025-09-01   [ Edit ] [ Remove ]    |
 | John Lee          john@acme.com       member  2025-09-10   [ Edit ] [ Remove ]    |
 | ...                                                                               |
 |-----------------------------------------------------------------------------------|
 | Pagination:  [ Prev ]  Page 1/12  [ Next ]   Page size: [ 20 v ]                  |
 +-----------------------------------------------------------------------------------+

Row Actions
- Edit → modal to change Name (text) and Role (admin|member); Email is read‑only
- Remove → confirmation; blocks removing last admin; blocks admin self‑remove unless superadmin

Edit Member Modal

 +-------------------------------------------+
 | Edit Member                               |
 |-------------------------------------------|
 | Name     [ Jane Smith             ]        |
 | Email    [ jane@acme.com          ] (ro)   |
 | Role     [ admin v ]                       |
 |-------------------------------------------|
 | [ Cancel ]                 [ Save changes ]|
 +-------------------------------------------+

Invite Member (Modal‑based creation)

 +-------------------------------------------+
 | Invite Member                              |
 |-------------------------------------------|
 | Email    [ person@example.com     ]        |
 | Name     [ Optional                ]        |
 | Role     (•) member   ( ) admin             |
 | Send email now?  [x]                        |
 |-------------------------------------------|
 | [ Cancel ]                 [ Send invite ] |
 +-------------------------------------------+

Pending Invitations (list under Members)

 +-----------------------------------------------------------------------------------+
 | Pending Invitations                                                              |
 | Email                Name        Role   Expires            Invited by  Actions    |
 |-----------------------------------------------------------------------------------|
 | person@example.com   —           member 2025-11-01 12:34  admin@acme   [Resend]  |
 | guest@beta.com       Guest User  admin  2025-11-03 10:15  owner@beta   [Revoke]  |
 +-----------------------------------------------------------------------------------+

Guardrails
- Prevent demotion/removal of the last admin
- Non‑superadmin admins cannot self‑demote or self‑remove if admin
- Rate limit invites per org/day and IP/15m; show clear errors

Mobile behavior
- Horizontal scroll; sticky header; actions collapsed into row (…) menu

Empty states
- No members (rare) → “No members yet. Invite someone.” [Invite Member]
- No pending invites → “No invitations yet.” [Invite Member]

---

## Screen 4: Accept Invitation (Public)

Path: `/invite?token=…`

 +-------------------------------------------+
 | Accept Invitation                          |
 |-------------------------------------------|
 | Organization:  Acme Inc (acme-inc)         |
 | Role:          member                       |
 | Expires:       2025-11-01 12:34             |
 |-------------------------------------------|
 | [ Accept and join ]  [ Cancel ]            |
 |-------------------------------------------|
 | Notes:                                      |
 | - You must be signed in with the invited    |
 |   email address.                            |
 +-------------------------------------------+

Error/edge states
- Invalid/expired → “This invitation is invalid or has expired.” CTA: Ask an admin to resend
- Revoked → “This invitation has been revoked.”
- Email mismatch → “This invitation was sent to <email>. Sign in with that email to accept.” CTA to sign out
- Already member → Informational and redirect to org

---

## Screen 5: Superadmin — Organizations

Path: `/admin/organizations`

 +-----------------------------------------------------------------------------------+
 | Admin / Organizations                                                              |
 +-----------------------------------------------------------------------------------+
 | Search [ name or slug … ]                                                         |
 |-----------------------------------------------------------------------------------|
 | Name                Slug         Members  Created            Updated   Actions     |
 |-----------------------------------------------------------------------------------|
 | Acme Inc            acme-inc     12       2025-08-01 10:20   2025-10-14 [View] [Edit] |
 | Beta Co             beta-co      5        2025-07-11 12:45   2025-10-12 [View] [Edit] |
 | ...                                                                                 |
 |-----------------------------------------------------------------------------------|
 | Pagination: [ Prev ]  Page 1/8  [ Next ]   Page size: [ 20 v ]                    |
 +-----------------------------------------------------------------------------------+

Notes
- No row Delete action; deletion is in org’s Danger Zone (superadmin only)
- [View] jumps to the org context; [Edit] can change slug (superadmin) and name

---

## Screen 6: Superadmin — Users

Path: `/admin/users`

 +-----------------------------------------------------------------------------------+
 | Admin / Users                                                                     |
 +-----------------------------------------------------------------------------------+
 | Search [ email or name … ]                                                        |
 |-----------------------------------------------------------------------------------|
 | Email                  Name          Role         Orgs  Created       Actions      |
 |-----------------------------------------------------------------------------------|
 | admin@example.com      Admin User    superadmin   24    2025-06-01    [View]       |
 | user@acme.com          Jane Smith    user         2     2025-09-01    [View]       |
 | ...                                                                                    |
 |-----------------------------------------------------------------------------------|
 | Pagination: [ Prev ]  Page 1/42  [ Next ]  Page size: [ 20 v ]                    |
 +-----------------------------------------------------------------------------------+

View user (drawer/modal)
- Show memberships (org, role), createdAt, last seen (if available), actions (jump to org)

---

## Interaction and Security Notes

- CSRF & Origin/Referer checks on all POST/PATCH/DELETE
- JWT‑gated routes; server‑side permission checks (admin or superadmin)
- Rate limiting on invitation creation/resend; clear UI errors (429)
- Reserved slugs enforced using env default: `o, api, dashboard, settings, login, invite, onboarding, _next, assets, auth, public`
- All critical actions audited with metadata (user, email, ip, org, deltas)

## Checklist (for implementation)

- [ ] Org picker (minimal list) with Create/Go/Set default/Leave
- [ ] Top bar Org switcher combobox + mobile drawer integration
- [ ] Settings/Organization tabs: General | Members
- [ ] General: Name edit; Slug (superadmin only); Danger Zone delete flow with name confirm
- [ ] Members: table with Edit (modal), Remove; pagination and mobile menus
- [ ] Invitations: modal create; list pending with Resend/Revoke
- [ ] Accept invitation page with structured error states
- [ ] Admin: Organizations (View/Edit, no Delete); search + pagination
- [ ] Admin: Users (View); search + pagination
- [ ] Security callouts integrated (CSRF, JWT, roles, audits)

---

These wireframes intentionally focus on the minimal, portable surfaces needed to run a secure multi‑tenant app. They align with the server‑first patterns and permissions in `multi_tenant_support.md` and can be adapted to any Next.js App Router project.
