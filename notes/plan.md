Feature Toggles, Superadmin, and Organization Policy — Implementation Plan

Summary
We will add three server‑validated toggles (allowlist, signup, org‑creation), introduce a superadmin role with cross‑org management, and harden both UI visibility
and API authorization so only admins or superadmins can manage organization settings and members. Client code will only mirror server policy for UX; all enforcement
remains in Node runtime routes and server components. No DB schema changes are required.

Decisions (approved)

- AUTH_ALLOWLIST_ENABLED: enabled by default (true)
- AUTH_SIGNUP_ENABLED: enabled by default (true); when false, only existing users can sign in
- ORG_CREATION_ENABLED: disabled by default (false)
- ORG_CREATION_LIMIT: default 1
- Superadmin: user.role === "superadmin" has global org access; may create orgs regardless of policy/limits
- Seed strategy: scripts/seed-superadmin.ts using SEED_EMAIL
- UI visibility: pass canCreateOrganizations from server layout to shell; hide buttons client‑side but always enforce server‑side
- Members list: only admins/superadmins can access
- Notices: toast via query params (?notice=signup_disabled | org_creation_disabled | forbidden)
- ALLOWED_EMAILS optional when allowlist disabled
- Superadmin bypasses allowlist and signup toggles

Environment Variables

- AUTH_ALLOWLIST_ENABLED: boolean, default true
- AUTH_SIGNUP_ENABLED: boolean, default true
- ORG_CREATION_ENABLED: boolean, default false
- ORG_CREATION_LIMIT: number, default 1
- SEED_EMAIL: string (for seed script)

Files To Touch

- lib/env.ts
- lib/auth.ts
- lib/org-helpers.ts (new helpers for superadmin/admin checks)
- app/api/auth/request-otp/route.ts
- app/api/auth/verify-otp/route.ts
- app/api/orgs/route.ts (GET/POST)
- app/api/orgs/[orgSlug]/route.ts (PATCH)
- app/api/orgs/[orgSlug]/members/route.ts (GET)
- app/api/orgs/[orgSlug]/members/[userId]/route.ts (PATCH/DELETE)
- app/api/orgs/[orgSlug]/invitations/\*_/_ (GET/POST/DELETE/resend)
- app/o/[orgSlug]/layout.tsx
- app/o/[orgSlug]/settings/members/page.tsx
- app/o/[orgSlug]/settings/organization/page.tsx
- components/features/dashboard/dashboard-shell.tsx (prop thread)
- components/features/dashboard/sidebar.tsx (hide Create Organization)
- app/(public)/login/page.tsx (toast from notice)
- app/onboarding/create-organization/page.tsx (guard/redirect)
- app/page.tsx (root redirect tweaks)
- scripts/seed-superadmin.ts (new)
- .env.example, README.md, MULTI_TENANT.md, notes/skills/authentication.md (docs)

Implementation Steps

1. Env & Config

- Add new env keys to lib/env.ts with defaults and validation. Make ALLOWED_EMAILS optional when AUTH_ALLOWLIST_ENABLED=false.
- Update .env.example and docs.

2. Allowlist Toggle

- lib/auth.ts → isEmailAllowed(email): if !AUTH_ALLOWLIST_ENABLED return true; else compare against ALLOWED_EMAILS.
- No client exposure.

3. Signup Toggle (existing users only when disabled)

- request-otp: if !AUTH_SIGNUP_ENABLED and user not found → 400 with explicit message; audit otp_request_blocked { reason: 'signup_disabled_no_account' }.
- verify-otp: if !AUTH_SIGNUP_ENABLED and user not found → 401; audit otp_verify_failure { reason: 'signup_disabled_no_account' }.
- Keep dev‑signin unchanged (requires existing user).

4. Superadmin Role

- lib/org-helpers.ts: add isSuperadmin(userId) and assertAdminOrSuperadmin(userId, orgId). Either update requireAdmin to include superadmin or replace callsites.
- app/o/[orgSlug]/layout.tsx: allow superadmin access without membership; expose role='superadmin' to the shell.

5. Admin‑Only Views & API Hardening

- UI: In org layout, include Settings → Organization/Members only for admin or superadmin. Sidebar mirrors that state.
- Pages: members/organization pages perform a server check and redirect with ?notice=forbidden for non‑authorized users.
- API: switch to assertAdminOrSuperadmin for all members/invitations/org‑settings routes. Tighten GET /members to admin/superadmin only.

6. Organization Creation Policy

- app/api/orgs/route.ts (POST):
  - If superadmin → allow.
  - Else require ORG_CREATION_ENABLED=true and createdById count < ORG_CREATION_LIMIT; else 403/400.
- app/api/orgs/route.ts (GET): if superadmin, list all orgs; include role='superadmin' for UI.
- app/o/[orgSlug]/layout.tsx: compute canCreateOrganizations server‑side (superadmin true; else policy+limit) and pass to shell.
- sidebar.tsx: hide Create Organization button when !canCreateOrganizations.
- onboarding/create-organization: guard/redirect to /login or / with ?notice=org_creation_disabled.
- app/page.tsx: no orgs → superadmin to onboarding; regular user → if ORG_CREATION_ENABLED=false redirect to /?notice=org_creation_disabled.

7. Notices & Copy

- Login: show toast when notice=signup_disabled or org_creation_disabled.
- Onboarding: show toast when redirected for org creation disabled.
- Error messages:
  - Request OTP: "No account found for this email. Sign up is disabled."
  - Verify OTP: "Your account does not exist and signup is disabled."
  - Org create disabled: "Organization creation is disabled."
  - Org limit reached: "Organization creation limit reached."

8. Auditing

- Add: otp_request_blocked { reason: 'signup_disabled_no_account' }, otp_verify_failure { reason: 'signup_disabled_no_account' }, org_create_denied { reason:
  'disabled' | 'limit_exceeded' }.
- Optionally mark actions initiated by superadmin with metadata { actingRole: 'superadmin' }.

9. Superadmin Seed

- scripts/seed-superadmin.ts reads SEED_EMAIL; upserts user; sets role='superadmin'; bumps sessionVersion.
- Doc usage and cautions.

10. Testing (follow‑up)

- Unit: isEmailAllowed, assertAdminOrSuperadmin, org creation policy (limit logic).
- API: request-otp/verify-otp with signup disabled; orgs POST policy; members/invitations endpoints for member vs admin vs superadmin.
- E2E: redirects, hidden UI items, toasts.

Acceptance Criteria

- Allowlist disabled allows any email; signup rules still apply.
- Signup disabled blocks non‑existing users at request‑otp and verify‑otp with clear messages.
- Only admins/superadmins see and can open org settings & members; APIs enforce the same.
- Only superadmin can create orgs when ORG_CREATION_ENABLED=false; when enabled, regular users observe ORG_CREATION_LIMIT.
- "Create Organization" button hidden when user cannot create; onboarding create page is guarded.
- Superadmin seed documented; global access verified.
