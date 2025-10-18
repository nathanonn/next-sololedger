• Here’s the implementation plan to add superadmin organization management while keeping changes small and consistent with the existing patterns. We’ll add four
focused dialogs (create org, edit org, edit member, invite member), wire them to existing APIs where possible, and extend a few APIs and schema to support
slug updates and optional member display names on invites. We’ll also add a “Back to Organization Dashboard” link in the sidebar user menu for superadmins when
browsing /admin pages, targeting the last-used organization via cookie.

Key Decisions Applied

- Redirect after create: go to /admin/organizations/{slug}.
- “Back to Dashboard” link: use last-org cookie.
- Allow slug editing for orgs.
- Allow editing global user.name when editing a member.
- Invite flow: show invite URL and optionally “Send Email” (admin’s choice).
- Capture optional name in invite and set it on acceptance.
- Button placements: create (list header), edit org (detail header), invite (members header).
- Members table: show plain text role; edit icon opens dialog.
- On slug change: update last-org cookie if it matched the old slug.
- No audit log for name changes (keep existing audits for other actions).

Implementation Order

- Prisma migration + small server helpers
- API extensions (org update, member update, invitations)
- Email helper for invitations
- Sidebar user menu link and admin layout prop
- Admin pages + dialogs
- Manual QA

Data & API Changes

- Prisma
  - Add optional invitation display name:
    - prisma/schema.prisma: model Invitation { name String? @db.VarChar(255) }
    - Run npx prisma migrate dev --name add-invitation-name
- Email helper
  - lib/email.ts: add sendInvitationEmail({ to, orgName, inviteUrl, role, invitedBy }).
  - Behavior: if Resend configured, send; in development with no config, log to console (mirrors OTP logic). Do not expose secrets to client.
- Edit organization details (allow slug changes)
  - app/api/orgs/[orgSlug]/route.ts (PATCH):
    - Extend Zod schema to allow { name?: string; slug?: string }.
    - For slug, reuse validateSlug, isReservedSlug, uniqueness check (as in POST /api/orgs).
    - Update organization.slug when provided.
    - Audit log metadata: include oldSlug/newSlug and oldName/newName if changed (keep existing log line, add slug keys).
    - Response: return updated name, slug.
- Edit member (name + role)
  - app/api/orgs/[orgSlug]/members/[userId]/route.ts (PATCH):
    - Extend Zod schema to accept { role?: 'admin' | 'member'; name?: string } with max length 255.
    - If role present → keep existing last-admin protections and audit.
    - If name present → db.user.update({ where: { id }, data: { name } }) (no new audit per 10/b).
    - Return { success: true } or refreshed minimal data.
- Invite member (optional name + optional send email)
  - app/api/orgs/[orgSlug]/invitations/route.ts (POST):
    - Extend Zod schema: { email: string; role: 'admin' | 'member'; name?: string; sendEmail?: boolean }.
    - Store name in Invitation.
    - Keep existing rate limits and unique checks.
    - Generate token + inviteUrl as today.
    - If sendEmail === true and Resend configured → call sendInvitationEmail(...); otherwise, just return inviteUrl.
    - Response unchanged plus include name and a sent: boolean flag.
- Accept invitation (apply invited name)
  - app/api/orgs/invitations/accept/route.ts:
    - After creating membership, if invitation.name exists and the current user.name is null/empty, set user.name = invitation.name in the existing
      transaction.
    - Keep audits as-is.

Sidebar User Menu: Back To Dashboard

- app/admin/layout.tsx
  - Pass lastOrgCookieName={env.LAST_ORG_COOKIE_NAME} to DashboardShell (parity with org layout).
- components/features/dashboard/sidebar.tsx
  - When isSuperadmin === true and pathname.startsWith('/admin'), read the lastOrgCookieName cookie client-side.
  - If a slug is found, render a DropdownMenuItem (icon: LayoutDashboard or Home) labeled “Back to Organization Dashboard” that navigates to /o/{slug}/dashboard.
  - Only show when a valid slug cookie exists.
  - No server-only imports in client.

Admin Pages & Dialogs

- Create Organization
  - New: components/features/admin/create-organization-dialog.tsx (client)
    - RHF + Zod: name (required), slug (optional, kebab-case validate).
    - Preview full URL under slug input.
    - Submit: POST /api/orgs with JSON.
    - Success: toast, router.replace('/admin/organizations/{slug}').
    - Pointer-events restore on close.
  - app/admin/organizations/page.tsx
    - Add “Create Organization” Button in the header that triggers the dialog.
- Edit Organization
  - New: components/features/admin/edit-organization-dialog.tsx (client)
    - Props: orgName, orgSlug, lastOrgCookieName.
    - RHF + Zod same as create; prefill inputs.
    - Submit: PATCH /api/orgs/{orgSlug} with { name?, slug? }.
    - On success:
      - If slug changed, update last-org cookie when it matches the old slug (per 9/b) and router.replace('/admin/organizations/{newSlug}').
      - Else router.refresh().
    - Pointer-events restore on close.
  - app/admin/organizations/[orgSlug]/page.tsx
    - Import and render the edit dialog next to DeleteOrganizationDialog.
- Members Table Changes
  - app/admin/organizations/[orgSlug]/page.tsx
    - Replace RoleSelect cell with plain text “Admin”/“Member”.
    - Add an “Edit” icon button (Lucide Pencil) in the Actions column.
    - Keep RemoveMemberButton as-is.
  - New: components/features/admin/edit-member-dialog.tsx (client)
    - Props: orgSlug, userId, email, initialName, initialRole, isLastAdmin.
    - Fields: name (text), role (Select: admin|member). Disable demote if isLastAdmin.
    - Submit: PATCH /api/orgs/{orgSlug}/members/{userId} with optional fields.
    - Success: toast, close, router.refresh().
- Invite Member
  - New: components/features/admin/invite-member-dialog.tsx (client)
    - Props: orgSlug.
    - Fields: name?, email (required), role (admin|member), sendEmail (checkbox).
    - Submit: POST /api/orgs/{orgSlug}/invitations.
    - Success: show toast and returned inviteUrl with Copy button; if sent === true, show “Email sent”.
  - app/admin/organizations/[orgSlug]/page.tsx
    - Add “Invite Member” button to the Members section header to open the dialog.

Validation & UX Guardrails

- Zod validation mirrors server checks; no empty SelectItem values.
- Dialog close restores document.body.style.pointerEvents (per required pattern).
- Toasts via Sonner for all outcomes; do not add another <Toaster />.
- Icons: Lucide only (Plus, Pencil, LayoutDashboard/Home, Mail, Eye, Users).
- All client fetches rely on same-origin; CSRF Origin/Referer validation remains effective.

Testing Checklist

- Create org: creating with and without slug; reserved/duplicate slug errors; redirect to detail page.
- Back link: on /admin/\* with cookie set → visible; click navigates to /o/{slug}/dashboard.
- Edit org: change only name; change slug (cookie updated if it matched); redirect to new slug detail; old URL 404s.
- Members: role displayed as text; Edit dialog updates name, role; cannot demote last admin (API error → toast).
- Invite: with and without sendEmail; name included; accept flow sets user.name when previously null.
- CSRF: requests from the app origin pass; direct cURL from a different origin rejected.
- Regression: org settings pages still work; existing members management under org scope unaffected.

Files To Touch (no edits yet; for reference)

- API
  - app/api/orgs/[orgSlug]/route.ts (PATCH slug support)
  - app/api/orgs/[orgSlug]/members/[userId]/route.ts (PATCH name support)
  - app/api/orgs/[orgSlug]/invitations/route.ts (POST accept name, sendEmail)
  - app/api/orgs/invitations/accept/route.ts (apply invited name)
- Lib
  - lib/email.ts (add sendInvitationEmail)
  - lib/invitation-helpers.ts (no change unless you want helper for composing invite email HTML)
- Prisma
  - prisma/schema.prisma (+ migration adding Invitation.name String?)
- Layout/Shell
  - app/admin/layout.tsx (pass lastOrgCookieName)
  - components/features/dashboard/sidebar.tsx (add “Back to Organization Dashboard” when in /admin)
- Admin UI
  - app/admin/organizations/page.tsx (+ create dialog trigger)
  - app/admin/organizations/[orgSlug]/page.tsx (header buttons, members table tweaks)
  - New components in components/features/admin/:
    - create-organization-dialog.tsx
    - edit-organization-dialog.tsx
    - edit-member-dialog.tsx
    - invite-member-dialog.tsx

Risks & Mitigations

- Slug change breaks bookmarked admin URL: mitigate with redirect to new slug after save; last-org cookie updated if it matched old slug.
- Token email content: keep in server; do not expose secrets; include only inviteUrl.
- Accepting invite name override: only set when user.name is null/empty to avoid clobbering.
