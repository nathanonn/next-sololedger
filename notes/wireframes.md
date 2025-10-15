
UX FLOW MAP

Legend: [] = page/screen, -> = navigation/action, (API) = server call, {cond} = condition

[ /login ]
  -> Submit Email (POST /api/auth/request-otp) {ok}
    -> Show code entry state
  -> Submit Code (POST /api/auth/verify-otp) {ok}
    -> {has any membership?} yes -> [ Redirect Resolver ]
       no  -> [ /onboarding/create-organization ]

[ /onboarding/create-organization ]
  -> Create (POST /api/orgs) {ok}
    -> [ /o/[org]/dashboard ]

[ /invite?token=...] (accept invitation)
  -> {signed in?} no -> [ /login?next=/invite?token=... ]
  -> Accept (POST /api/orgs/invitations/accept) {ok}
    -> [ /o/[org]/dashboard ]

[ / ] or [ /dashboard ] or [ /settings/* ] (no org in path)
  -> [ Redirect Resolver ]

[ Redirect Resolver ]
  -> {last_org cookie} yes -> [ /o/[slug]/dashboard ]
  -> {defaultOrganizationId} yes -> [ /o/[slug]/dashboard ]
  -> {has memberships} yes -> [ /o/[first]/dashboard ]
  -> else -> [ /onboarding/create-organization ]

[ /o/[org]/dashboard ]
  -> Open Org Switcher -> [ Org Switcher Overlay ]
  -> Go to Settings -> [ /o/[org]/settings/organization ]
  -> Go to Members -> [ /o/[org]/settings/members ]

[ Org Switcher Overlay ]
  -> Select org -> [ /o/[org]/dashboard ] (set last_org cookie)
  -> Create new -> [ Create Org Modal ]
  -> Manage members -> [ /o/[org]/settings/members ]

[ /o/[org]/settings/organization ]
  -> Save name -> toast

[ /o/[org]/settings/members ]
  -> Invite -> toast
  -> Change role -> toast
  -> Remove -> toast
  -> Resend/Revoke invite -> toast


SCREEN-BY-SCREEN ASCII WIREFRAMES

1) Login: /login (Email OTP)

+----------------------------------------------------------------------------------+
|                                   Sign in                                         |
|----------------------------------------------------------------------------------|
|  Tabs: [ Email Code ] [ Password (Dev) ]                                          |
|                                                                                  |
|  Email                                                                           |
|  [ user@example.com____________________________________________ ]                |
|                                                                                  |
|  [ Request code ]                                                                |
|                                                                                  |
|  -- After requesting code --                                                     |
|  Enter 6-digit code                                                              |
|  [ _ _ _ _ _ _ ]                                                                 |
|                                                                                  |
|  [ Verify & continue ]                                   [ Need a new code? ]    |
|                                                                                  |
|  Footer: By continuing you agree to our Terms and Privacy Policy.                |
+----------------------------------------------------------------------------------+
Notes:
- If server returns requiresCaptcha, show hCaptcha widget below Email.
- On verify success: if no memberships -> Onboarding; else -> Redirect Resolver.
- Errors show inline under inputs and toast.error.


2) Onboarding: Create Organization (/onboarding/create-organization)

+----------------------------------------------------------------------------------+
|                              Create your workspace                                |
|----------------------------------------------------------------------------------|
|  Name                                                                             |
|  [ Nathan's workspace__________________________________________ ]                 |
|                                                                                  |
|  Slug (immutable)                                                                 |
|  [ nathan-workspace________________________ ]  https://app/o/nathan-workspace     |
|  Tip: You can't change the slug later.                                            |
|                                                                                  |
|  [ Create workspace ]                                      [ Cancel ]             |
+----------------------------------------------------------------------------------+
Notes:
- Validate kebab-case, reserved slugs, <= 50 chars, uniqueness (server).
- If slug taken -> append random alphanum suggestion (editable before submit).
- On success -> set as defaultOrganizationId; redirect to /o/[slug]/dashboard.


3) Invite Accept: /invite?token=...

+----------------------------------------------------------------------------------+
|                           You’ve been invited to join                              |
|----------------------------------------------------------------------------------|
|  Organization: Acme Inc                                                           |
|  Invited email: user@example.com                                                  |
|                                                                                  |
|  [ Accept & join ]                                           [ Decline ]          |
|                                                                                  |
|  Problems? This invite may have expired. Ask an admin to resend.                  |
+----------------------------------------------------------------------------------+
States:
- Not signed in: show a prompt with a button "Sign in to accept" that routes to /login?next=/invite?token=...
- Invalid/expired token: show error panel with [Back to login] and [Contact admin].


4) Dashboard: /o/[org]/dashboard

+----------------------------------------------------------------------------------+
| [☰]  Acme Inc ▾        Search__________________________________    💬  ⚙  ◉      |
|----------------------------------------------------------------------------------|
| |▮ Sidebar (resizable 15–35%)              |  Content area                        |
| |                                          |                                      |
| |  Main                                    |  [ Page title ]                      |
| |   • Dashboard (active)                   |  Primary content cards, tables, etc. |
| |                                          |                                      |
| |  Settings                                |                                      |
| |   • Profile                              |                                      |
| |   • Organization                         |                                      |
| |   • Members                              |                                      |
| |                                          |                                      |
| |  Collapse ◀                              |                                      |
|----------------------------------------------------------------------------------|
| Footer / status bar (optional)                                                    |
+----------------------------------------------------------------------------------+
Notes:
- Org Switcher on org name (Acme Inc ▾). Clicking opens Command dialog.
- Sidebar collapses to icons; state persisted per userId.


5) Org Switcher Overlay (Command dialog)

+-----------------------------------------------+
|  Switch organization                          |
|-----------------------------------------------|
|  > Filter orgs...                             |
|-----------------------------------------------|
|  Recent                                       |
|  • Acme Inc                                   |
|  • Personal workspace                         |
|-----------------------------------------------|
|  All                                          |
|  • Design Guild                               |
|  • Sales Ops                                  |
|-----------------------------------------------|
|  Actions                                      |
|  + Create new organization                    |
|  ⚙ Manage members (current org)               |
+-----------------------------------------------+
Notes:
- Enter selects highlighted org; Esc closes. Selecting sets last_org cookie and navigates.


6) Organization Settings: /o/[org]/settings/organization

+----------------------------------------------------------------------------------+
|  Organization settings                                                              |
|----------------------------------------------------------------------------------|
|  Name                                                                              |
|  [ Acme Inc____________________________________________ ]                          |
|                                                                                   |
|  Slug (immutable)                                                                  |
|  [ acme-inc________________________ ]   https://app/o/acme-inc                     |
|  Note: Slug cannot be changed.                                                     |
|                                                                                   |
|  [ Save changes ]                                              [ Cancel ]          |
+----------------------------------------------------------------------------------+
Notes:
- Admin only. Show 403 screen for non-admins.


7) Members: /o/[org]/settings/members

+----------------------------------------------------------------------------------+
|  Members & invitations (Admin)                                                     |
|----------------------------------------------------------------------------------|
|  Invite member                                                                     |
|  Email: [ user@example.com____________________________ ]  Role: ( ) Member ( ) Admin |
|  [ Send invite ]                                                                    |
|----------------------------------------------------------------------------------|
|  Members                                                                           |
|  user1@example.com        Admin        [ Change role ] [ Remove ]                   |
|  user2@example.com        Member       [ Change role ] [ Remove ]                   |
|                                                                                     |
|----------------------------------------------------------------------------------|
|  Pending invitations                                                                |
|  jane@example.com        Member      Expires in 5d   [ Resend ] [ Revoke ]          |
|  bob@example.com         Admin       Expires in 2d   [ Resend ] [ Revoke ]          |
+----------------------------------------------------------------------------------+
Notes:
- Change role dialog blocks demoting the last admin.
- Remove blocks removing the last admin; self-leave blocked if sole admin.
- Actions show toast.success/error.


7.1) Change Role Dialog

+----------------------------+
| Change role                |
|----------------------------|
| ( ) Member                 |
| ( ) Admin                  |
|                            |
| [ Save ]         [ Cancel ]|
+----------------------------+
Error state:
- "You must have at least one admin in this organization."


7.2) Remove Member Dialog

+----------------------------+
| Remove member              |
|----------------------------|
| Remove user2@example.com from Acme Inc?        |
|                                                |
| [ Remove ]       [ Cancel ]                    |
+----------------------------+
Error state:
- "Cannot remove the last admin. Assign another admin first."


7.3) Resend / Revoke Invite Confirm

+----------------------------+
| Resend invitation?         |
|----------------------------|
| We’ll send a fresh invite link to jane@example.com. |
| [ Resend ]       [ Cancel ]                    |
+----------------------------+

+----------------------------+
| Revoke invitation?         |
|----------------------------|
| Revoke the pending invite for bob@example.com? |
| [ Revoke ]       [ Cancel ]                    |
+----------------------------+


8) Create Org Modal (from Switcher)

+-----------------------------------------------+
|  Create organization                          |
|-----------------------------------------------|
|  Name                                          |
|  [ New Team________________________________ ]  |
|                                               |
|  Slug (immutable)                              |
|  [ new-team______________________________ ]    |
|  Tip: Slug can’t be changed later.            |
|                                               |
|  [ Create ]                     [ Cancel ]     |
+-----------------------------------------------+


9) Redirect screens (helpers)

- 403 Not a member (when accessing /o/[org]/... without membership)

+-----------------------------------------------+
|  Access denied                                 |
|-----------------------------------------------|
|  You’re not a member of this organization.     |
|  [ Switch organization ]  [ Go to login ]      |
+-----------------------------------------------+

- 404 Org not found (bad slug)

+-----------------------------------------------+
|  Organization not found                        |
|-----------------------------------------------|
|  Check the URL or switch to another org.       |
|  [ Switch organization ]                       |
+-----------------------------------------------+


10) Mobile behavior (summary)
- Top bar contains org switcher and hamburger to open left drawer.
- Sidebar content rendered inside a Sheet; same menu items.
- Dialogs and Command overlay full-screen on small viewports.


11) Toasts (Sonner positions)
- Success: "Invitation sent", "Role updated", "Member removed", "Workspace created".
- Error: human-friendly messages, fallback generic.


COPY & VALIDATION HINTS
- Slug validation messages: "Only lowercase letters, numbers, and hyphens. Max 50 chars."
- Reserved slugs: "This slug is reserved. Choose another."
- Invite expired/invalid: "This invitation is no longer valid. Ask the admin to resend."
- Last-admin guard: "At least one admin is required."
- Email allowlist note remains on login only (invites bypass allowlist).
