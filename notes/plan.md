Title: Invitations UX and Auth Plan

Summary

We will make invitation operations reliable, responsive, and clear. On the backend, we’ll ensure resending actually emails the invite link and that invited users can sign up even when general signup is disabled (without weakening allowlist controls for non‑invited emails). On the frontend, pending invitations will update instantly after create/resend/revoke, and the Invite page will show the correct organization name and smarter states: if a user is already a member or is a superadmin, we show a direct path to the dashboard instead of the “Accept & Join” action.

Decisions (locked)

1. Invited emails bypass allowlist when an active invite exists.
2. Use a custom DOM event to refresh “Pending Invitations”.
3. Personalize emails with invitee name if present.
4. Superadmins opening invite links see an access message and a dashboard button; no accept‑on‑behalf.
5. Copy for already‑member state: “You’re already a member” with “Go to Dashboard”.
6. Redirect after accept: `/o/[orgSlug]`.
7. If Resend is not configured in non‑dev, fail loudly (500) to avoid masking production misconfigurations.
8. Invited signups also bypass allowlist when signup is disabled.

Scope of Work

Server/API

- Resend invitation (POST /api/orgs/[orgSlug]/invitations/[id]/resend)
  - Generate a new token + expiry (uses INVITE_EXP_MINUTES).
  - Build inviteUrl: `${APP_URL}/invite?token=...`.
  - Send email via sendInvitationEmail({ to, orgName, inviteUrl, role, invitedBy }).
  - DEV: logs to console if email not configured; Non‑DEV: return 500 when email service not configured.
  - Response includes { id, email, role, expiresAt, inviteUrl, sent }.
  - Audit: invite_resent (includes invitationId, invitedEmail, role).

- Allow invited signups when AUTH_SIGNUP_ENABLED=false
  - request-otp: if signup disabled and user doesn’t exist, allow if an active invitation exists for the email (acceptedAt=null, revokedAt=null, expiresAt>now). Else block.
  - verify-otp: same bypass; allow JIT user creation when active invite exists.
  - Invited emails bypass allowlist checks when active invite exists.
  - Audit metadata reason: invited_signup_allowed when bypass occurs.

- Invitation validation (GET /api/orgs/invitations/validate?token=...)
  - Uses validateInvitationToken(token).
  - Returns: valid, error?, invitation { id, orgId, orgSlug, orgName, email, role, expiresAt }.
  - If authenticated: include alreadyMember and userIsSuperadmin (membership/org helpers).

- Accept invitation (POST /api/orgs/invitations/accept)
  - Ensure already‑member path includes organization slug in response.
  - Keep existing success response with { organization: { id, name, slug } }.
  - No accept‑on‑behalf for superadmins; invited email must match current user.

Client/UI

- PendingInvitationsList
  - Listen for `org:invitations:changed` and call refetch() when fired.
  - On resend success: toast, optional copy inviteUrl, dispatch event.
  - On revoke success: toast, dispatch event.

- InviteMemberDialog
  - After successful invite creation: dispatch `org:invitations:changed` with { orgSlug }.

- Invite Page (/invite)
  - If not authenticated: redirect to /login?next=/invite?token=...
  - If authenticated: GET /api/orgs/invitations/validate?token=...
    - Show real orgName (and role) instead of placeholder.
    - If alreadyMember or userIsSuperadmin: show “You’re already a member” with button to `/o/[orgSlug]`; hide Accept & Join.
    - If invalid/expired: show error card with guidance to request resend.
    - Else: show Accept/Decline with org details; Accept posts to /api/orgs/invitations/accept; on success redirect to `/o/[orgSlug]`.

Edge Cases & Security

- CSRF checks on mutating routes (existing helpers).
- Email service behavior:
  - Development: log email contents via lib/email.ts fallback.
  - Non‑dev: fail with 500 if not configured (visibility over silent failure).
- Rate limiting and audit logging preserved for auth flows.
- Never expose tokens/secrets to client; all email sends remain server‑side.

QA Checklist

- Resend: email dispatched (or dev‑logged), expiry updated, API returns inviteUrl; UI shows success and list refreshes automatically.
- Create invite: new invite appears instantly in Pending Invitations.
- Signup disabled: invited non‑existing email can request + verify OTP and accept invite; non‑invited new emails blocked; existing users continue to sign in.
- Invite page: shows org name; already‑member and superadmin see dashboard action; invalid invites show guidance.
- Accept redirect: always to `/o/[orgSlug]` for both success and already‑member responses.

Deliverables

- Server: updated resend route; updated request-otp and verify-otp gating; new validation route; accept route response tweak.
- Client: event wiring in invite dialog and pending list; Invite page state updates and copy.
- Notes: this plan document and wireframes document.

Out‑of‑Scope (for now)

- Comprehensive automated tests (add later).
- Background job retries for email delivery.
