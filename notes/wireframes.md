UX Flow Map + ASCII Wireframes

  Flow Map (high level)

  - Unauthenticated
      - GET /login
          - POST /api/auth/request-otp
              - If AUTH_SIGNUP_ENABLED=false AND user does not exist → 400, toast “No account…signup is disabled”
              - Else → 200, advance to code step
          - POST /api/auth/verify-otp
              - If AUTH_SIGNUP_ENABLED=false AND user does not exist → 401, toast “Account does not exist…”
              - Else → 200, set cookies → redirect
      - GET /invite?token=…
          - If not authenticated → redirect to /login?next=/invite?token=…
          - After login → POST /api/orgs/invitations/accept → on success redirect to /o/[slug]/dashboard
  - Authenticated Root (/)
      - last_org cookie valid? → /o/[slug]/dashboard
      - else defaultOrganizationId valid? → /o/[slug]/dashboard
      - else memberships > 0? → /o/[first]/dashboard
      - else:
          - if user.role === superadmin → /onboarding/create-organization
          - else if ORG_CREATION_ENABLED=false → /?notice=org_creation_disabled (toast on home/login)
          - else → /onboarding/create-organization
  - Organization (protected)
      - /o/[slug]/dashboard: anyone in org
      - /o/[slug]/settings/organization: admin or superadmin only (non‑admin → redirect to dashboard?notice=forbidden)
      - /o/[slug]/settings/members: admin or superadmin only (non‑admin → redirect to dashboard?notice=forbidden)
  - Create Organization
      - /onboarding/create-organization:
          - if canCreateOrganizations=true → show form
          - else → redirect to /?notice=org_creation_disabled (or /login if unauthenticated)

  Toasts (Sonner, top‑right)

  - signup_disabled: “Sign up is disabled. Ask an admin to create your account.”
  - org_creation_disabled: “Organization creation is disabled. You must be invited.”
  - forbidden: “You don’t have permission to view that page.”

  Screens (ASCII)

  1. Login (Email → OTP)
     +--------------------------------------------------+
     | Welcome Back                                     |
     | Sign in to your account                          |
     |                                                  |
     | [ Email ]_______________________________         |
     |                                                  |
     | [ Send verification code ]                       |
     |                                                  |
     | Note: If your email is allowed, you will         |
     |       receive a 6‑digit code.                    |
     |                                                  |
     | Tabs: [ Email OTP | Password (Dev)* ]            |
     | * Dev tab visible only in development            |
     +--------------------------------------------------+

  OTP Code Step
  +--------------------------------------------------+
  | Enter 6‑digit code sent to: you@example.com      |
  |                                                  |
  | [ _ ] [ _ ] [ _ ] [ _ ] [ _ ] [ _ ]              |
  |                                                  |
  | [ Back ]                  [ Verify & sign in ]   |
  +--------------------------------------------------+

  Dev Password (only in dev)
  +--------------------------------------------------+
  | Password (Dev)                                   |
  |                                                  |
  | [ Email ]_______________________________         |
  | [ Password ]____________________________         |
  |                                                  |
  | [ Sign in ]                                      |
  | Dev‑only password sign‑in                        |
  +--------------------------------------------------+

  2. Invite Accept (/invite?token=…)
     +--------------------------------------------------+
     | You’ve been invited!                             |
     | You’ve been invited to join an organization      |
     |                                                  |
     | Organization:  Acme Inc                          |
     | Role:          Member                            |
     |                                                  |
     | [ Accept & Join ]     [ Decline ]                |
     |                                                  |
     | Tip: If this expired, ask an admin to resend.    |
     +--------------------------------------------------+
  3. Dashboard Shell (Org scope)
     +--------------------+------------------------------+
     | Sidebar            | Top Bar       [☰]            |
     |                    |------------------------------|
     | Main               | Content Area                 |
     | - Dashboard        |                              |
     | Settings           |                              |
     | - Profile          |                              |
     | - Organization (*) |                              |
     | - Members ()      |                              |
     |                    |                              |
     | [Create Organization] (hidden if not allowed)     |
     | (*) Visible only for admin or superadmin          |
     +--------------------+------------------------------+
  4. Organization Settings (/o/[slug]/settings/organization)
     +--------------------------------------------------+
     | Organization Settings                            |
     | Manage your organization details                 |
     |                                                  |
     | General                                          |
     |  Label: Organization Name                        |
     |  [ My Workspace ]_______________________         |
     |                                                  |
     | Slug (immutable)                                 |
     |  [ my-workspace ] (disabled)                     |
     |  URL: https://app.local/o/my-workspace          |
     |                                                  |
     | [ Save changes ]                                 |
     +--------------------------------------------------+
  5. Members & Invitations (/o/[slug]/settings/members)
     Invite Form
     +--------------------------------------------------+
     | Invite Member                                    |
     |                                                  |
     | Email:  [ user@example.com ]______________       |
     | Role:   [ Member ▼ ]                             |
     |                                                  |
     | [ Send Invite ]                                  |
     +--------------------------------------------------+

  Members List
  +--------------------------------------------------+
  | Members (3)                                      |
  |                                                  |
  | user1@example.com     [admin]  Joined 2025‑10‑05 |
  |   [ Change Role ] [ Remove ]                     |
  |                                                  |
  | user2@example.com     [member] Joined 2025‑10‑12 |
  |   [ Change Role ] [ Remove ]                     |
  |                                                  |
  | (Dialogs) Change Role: [Member|Admin] [Cancel][Save]  |
  |           Remove: “Are you sure?” [Cancel][Remove]    |
  +--------------------------------------------------+

  Pending Invitations
  +--------------------------------------------------+
  | Pending Invitations                              |
  |                                                  |
  | user3@example.com [member]  Expires in 5d        |
  |   [ Resend ]  [ Revoke ]                         |
  |                                                  |
  | (Empty state): “No pending invitations”          |
  +--------------------------------------------------+

  6. Create Organization (/onboarding/create-organization)
     +--------------------------------------------------+
     | Create your workspace                            |
     | Get started by creating your first workspace     |
     |                                                  |
     | Workspace Name                                   |
     | [ My Workspace ]________________________         |
     |                                                  |
     | Workspace URL                                    |
     | [ my-workspace ]________________________         |
     | https://app.local/o/my-workspace                 |
     |                                                  |
     | [ Create workspace ]                             |
     |                                                  |
     | (Guard) If not allowed → redirect with toast     |
     +--------------------------------------------------+
  7. Redirect/Guard States

  - Non‑admin opens /settings/* → redirect to /o/[slug]/dashboard?notice=forbidden (toast)
  - No orgs:
      - superadmin → /onboarding/create-organization
      - regular user:
          - ORG_CREATION_ENABLED=false → /?notice=org_creation_disabled (toast)
          - else → /onboarding/create-organization