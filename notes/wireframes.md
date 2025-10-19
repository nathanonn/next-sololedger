Title: Invitations UX — Flow & Wireframes

Legend

- [S] Server call
- [C] Client action
- [UI] Screen/card state

UX Flow Map

1. Admin invites a member
   [UI] Admin Members tab
   └─ InviteMemberDialog → Submit
   [S] POST /api/orgs/:slug/invitations
   [C] On success: toast + show invite URL (optional), dispatch `org:invitations:changed` → PendingInvitationsList refetches

2. Admin resends or revokes invite
   [UI] PendingInvitationsList → Resend/Revoke
   [S] POST /api/orgs/:slug/invitations/:id/resend
   [S] DELETE /api/orgs/:slug/invitations/:id
   [C] On success: toast + (resend) optional copy link, dispatch event, list refetches

3. Invitee opens invite link
   [C] /invite?token=...
   If not authenticated → redirect to /login?next=/invite?token=...
   If authenticated → [S] GET /api/orgs/invitations/validate?token=... - valid + access (member or superadmin) → show Already Member card with button to /o/:slug - valid + no access → show Accept/Decline card
   Accept → [S] POST /api/orgs/invitations/accept → redirect /o/:slug - invalid/expired → show Invalid Invite card + guidance to request resend

Screen Wireframes (ASCII)

Admin — Members Tab (header area)

┌───────────────────────────────────────────────────────────────┐
│ Members [Invite Member] │
└───────────────────────────────────────────────────────────────┘

Invite Member Dialog

┌──────────────── Invite Member ────────────────┐
│ Name (optional): [ ] │
│ Email*: [ ] │
│ Role*: [ Admin ▼ ][ Member ] │
│ [ ] Send email │
│ │
│ [Cancel] [Send Invitation] │
└─────────────────────────────────────────────────┘

On success (inline success view inside dialog):

┌────────────── Invitation Sent ────────────────┐
│ Invitation link: │
│ https://app.example.com/invite?token=... │
│ ✓ Email sent to user@example.com │
│ │
│ [Copy link] [Open invite] [Done] │
└───────────────────────────────────────────────┘

Pending Invitations List

┌──────────────── Pending Invitations ──────────┐
│ Invitations waiting to be accepted │
├───────────────────────────────────────────────┤
│ • user@example.com (Member) │
│ Invited by admin@acme.com · Expires: 2025‑11‑01
│ [Resend] [Revoke] │
│ │
│ • jane@example.com (Admin) │
│ Invited by admin@acme.com · Expires: 2025‑11‑04
│ [Resend] [Revoke] │
└───────────────────────────────────────────────┘

Resend Confirmation Dialog

┌────────────── Resend Invitation ──────────────┐
│ Resend invitation to user@example.com? │
│ │
│ [Cancel] [Resend Invite]│
└───────────────────────────────────────────────┘

Revoke Confirmation Dialog

┌────────────── Revoke Invitation ──────────────┐
│ Revoke invitation for user@example.com? │
│ │
│ [Cancel] [Revoke] │
└───────────────────────────────────────────────┘

Invite Page — Loading

┌───────────────────────────────────────────────┐
│ ⟳ Validating invitation... │
└───────────────────────────────────────────────┘

Invite Page — Invalid/Expired

┌──────────────── Invalid Invitation ───────────┐
│ This invitation link is invalid or expired. │
│ │
│ [Go to Dashboard] [Sign In] │
└───────────────────────────────────────────────┘

Invite Page — Already a Member (or Superadmin)

┌────────────── You’re already a member ────────┐
│ You already have access to this organization. │
│ │
│ [Go to Dashboard] │
└───────────────────────────────────────────────┘

Invite Page — Valid Invite (Accept/Decline)

┌──────────────── You’ve been invited! ─────────┐
│ You’ve been invited to join: │
│ │
│ Organization: ACME, Inc. │
│ Role: Member │
│ │
│ [Accept & Join] [Decline] │
│ │
│ Having trouble? Ask an admin to resend. │
└───────────────────────────────────────────────┘

Toast Examples

- “Invitation created” (after POST create)
- “Invitation email resent” (resend)
- “Invitation revoked” (revoke)
- “Link copied” (copy inviteUrl)

Empty States

- Pending Invitations (none)

┌──────────────── Pending Invitations ──────────┐
│ No pending invitations │
│ Invite users to get started. │
└───────────────────────────────────────────────┘

Notes

- The pending list auto‑refreshes via a global `org:invitations:changed` event.
- The Invite page derives org name, role, and access state from the validation endpoint.
- Superadmins never accept on behalf; they see the direct dashboard CTA.
