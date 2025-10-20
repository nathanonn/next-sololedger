# Multi-Tenant Security Checklist

## Runtime & Boundaries

- [ ] All API routes use `export const runtime = "nodejs"` (never Edge for DB)
- [ ] All multi-tenant helpers are server-only (in `lib/` not `components/`)
- [ ] No DB queries or secrets exposed to client components
- [ ] Server components fetch data; client components receive props only

## Authentication & Authorization

- [ ] All API routes verify JWT session via `getCurrentUser()`
- [ ] Permission helpers enforce membership/admin/superadmin checks
- [ ] Superadmin bypass logic is explicit and audited
- [ ] Edge middleware verifies JWT signature only (no DB calls)
- [ ] Deep auth checks happen in API routes and server components

## CSRF Protection

- [ ] All mutating endpoints (POST/PATCH/DELETE) validate Origin/Referer
- [ ] `validateCSRF()` helper checks against `APP_URL` + `ALLOWED_ORIGINS`
- [ ] CSRF checks return clear 403 errors with safe messaging

## Data Isolation

- [ ] All tenant data queries use `scopeTenant(where, orgId)` helper
- [ ] Never query tenant tables without `organizationId` filter
- [ ] Superadmin access bypasses membership but still scopes queries explicitly
- [ ] Foreign keys enforce `organizationId` on tenant-owned tables

## Invitation Security

- [ ] Invitation tokens: 32-byte random hex, bcrypt hashed
- [ ] Store only `tokenHash`, never plain token
- [ ] Tokens expire (default 7 days via `INVITE_EXP_MINUTES`)
- [ ] Accept flow requires authenticated user with matching email
- [ ] Rate limits: per-org/day and per-IP/15m
- [ ] Revoked invitations cannot be accepted

## Last Admin Protection

- [ ] Cannot demote last admin to member
- [ ] Cannot remove last admin from organization
- [ ] Non-superadmin admins cannot self-demote
- [ ] Non-superadmin admins cannot self-remove if admin
- [ ] `isLastAdmin()` helper used in all relevant flows

## Organization Lifecycle Guards

- [ ] Org creation respects `ORG_CREATION_ENABLED` toggle
- [ ] Org creation enforces per-user limit (`ORG_CREATION_LIMIT`)
- [ ] Superadmin bypasses creation toggles and limits
- [ ] Slug validation enforces reserved list and uniqueness
- [ ] Only superadmin can change slug or delete org
- [ ] Org deletion cascades memberships and invitations
- [ ] Org deletion clears `defaultOrganizationId` for affected users

## Audit Logging

- [ ] Record all org create/update/delete actions
- [ ] Record all invitation create/accept/revoke/resend actions
- [ ] Record all member role changes and removals
- [ ] Include metadata: user, email, IP, org, diffs
- [ ] Audit logs are queryable and retained
- [ ] Superadmin actions are clearly marked in audit trail

## Cookies & Session

- [ ] `LAST_ORG_COOKIE_NAME` (default `__last_org`) is httpOnly
- [ ] Cookie is `secure` in production
- [ ] Cookie is `sameSite: 'strict'`
- [ ] Server validates last_org cookie references accessible org
- [ ] Switching orgs updates cookie and redirects

## Rate Limiting

- [ ] Invitation creation: per-org/day limit enforced
- [ ] Invitation creation: per-IP/15m limit enforced
- [ ] Rate limit errors return 429 with `Retry-After` header
- [ ] Rate limit checks logged for monitoring

## Input Validation

- [ ] All inputs validated with Zod schemas
- [ ] Slug validation: lowercase alphanumeric + hyphens, ≤50 chars
- [ ] Email validation for invitations
- [ ] Role validation: only "admin" | "member" allowed
- [ ] Reserved slugs checked against env list

## Error Handling

- [ ] Generic error messages for auth failures (don't leak info)
- [ ] Never expose token values in errors or logs
- [ ] Never log sensitive data (passwords, tokens, API keys)
- [ ] Structured error responses with safe user-facing messages
- [ ] Internal errors logged for debugging (without secrets)

## Environment Variables

- [ ] All multi-tenant env vars validated at boot (Zod in `lib/env.ts`)
- [ ] `JWT_SECRET` is ≥32 chars
- [ ] `ORG_RESERVED_SLUGS` defaults provided
- [ ] `INVITE_EXP_MINUTES` has sensible default (10080 = 7 days)
- [ ] Rate limit defaults are conservative
- [ ] Required vars: `APP_URL`, `DATABASE_URL`, `JWT_SECRET`

## Database Indexes

- [ ] Indexes on `Organization.slug` (unique lookups)
- [ ] Indexes on `Membership.userId` and `organizationId` (queries)
- [ ] Indexes on `Invitation.tokenHash` (token validation)
- [ ] Indexes on `Invitation.organizationId` (org invitations list)
- [ ] Indexes on `AuditLog.organizationId` (org audit trail)

## Testing Edge Cases

- [ ] Invitation with mismatched email → 403
- [ ] Demote/remove last admin → 400
- [ ] Self-demotion by non-superadmin admin → 400
- [ ] Slug collision → 400
- [ ] Reserved slug → 400
- [ ] Org creation disabled → 403
- [ ] Org creation limit exceeded → 400
- [ ] Expired/revoked invitation → 400
- [ ] Already member accepting invitation → informational redirect
- [ ] Superadmin accessing any org without membership → allowed
- [ ] Deleting org clears `defaultOrganizationId` → verified

## Production Hardening

- [ ] All cookies are `secure: true` in production
- [ ] HTTPS enforced (middleware or infra)
- [ ] Database connection pooling configured
- [ ] Audit logs retained and monitored
- [ ] Superadmin access limited to trusted operators
- [ ] Seed scripts secured (not exposed in production builds)
