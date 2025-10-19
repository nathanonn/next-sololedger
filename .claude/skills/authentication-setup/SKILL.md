---
name: authentication-setup
description: This skill should be used when setting up email OTP authentication with JWT sessions, password management, rate limiting, CSRF protection, and audit logging in a Next.js application. Use this skill when implementing a production-ready authentication system that matches the reference implementation pattern with Resend email, Prisma ORM, PostgreSQL, bcrypt password hashing, and jose JWT tokens.
---

# Authentication Setup

## Overview

Set up a complete, production-ready authentication system for Next.js applications featuring:
- Email OTP authentication (primary method) via Resend
- Optional development password signin (behind strict feature flags)
- JWT session management with access and refresh tokens
- Email allowlist with configurable enforcement
- Signup toggle to control new user registration
- Rate limiting and optional hCaptcha integration
- CSRF protection via Origin/Referer validation
- Password management (set/change) with strength validation
- Comprehensive audit logging
- Session versioning for global invalidation
- Superadmin role with bypass capabilities

This implementation prioritizes security, user experience, and developer flexibility with extensive configuration options.

## When to Use This Skill

Use this skill when:
- Setting up authentication for a new Next.js application
- Migrating from a different auth system to this OTP-based approach
- Adding production-grade security features to existing authentication
- Implementing email-based verification flows with JWT sessions
- Questions about this authentication pattern's architecture or configuration

Do **not** use this skill when:
- Implementing OAuth/social login (Google, GitHub, etc.)
- Using third-party auth services (Auth0, Clerk, Supabase Auth)
- Building magic link authentication (different from OTP)
- Simple API key authentication

## Quick Start

For a rapid setup, follow these steps in order:

1. **Install dependencies**
   ```bash
   npm install @prisma/client bcrypt jose resend zod @zxcvbn-ts/core @zxcvbn-ts/language-common @zxcvbn-ts/language-en
   npm install -D prisma @types/bcrypt
   ```
   See `references/dependencies.md` for complete details.

2. **Set up database schema**
   - Copy the Prisma schema from `references/database_schema.md`
   - Run `npx prisma generate` then `npx prisma migrate dev --name init_auth`

3. **Configure environment variables**
   - Copy required variables from `references/environment_variables.md`
   - Minimum: `DATABASE_URL`, `JWT_SECRET`, JWT cookie names, `APP_URL`, `ALLOWED_EMAILS`, Resend config
   - Generate JWT secret: `openssl rand -base64 32`

4. **Implement core library files**
   - Follow `references/implementation_guide.md` Step 3-5
   - Create: `lib/db.ts`, `lib/env.ts`, `lib/jwt.ts`, `lib/jwt-edge.ts`
   - Create: `lib/csrf.ts`, `lib/email.ts`, `lib/rate-limit.ts`
   - Create: `lib/validators.ts`, `lib/auth.ts`, `lib/auth-helpers.ts`

5. **Add middleware**
   - Create `middleware.ts` for Edge route protection
   - See `references/implementation_guide.md` Step 6

6. **Create API routes**
   - Implement auth endpoints in `app/api/auth/`
   - Routes: `request-otp`, `verify-otp`, `dev-signin`, `signout`, `refresh`
   - Profile routes: `profile/set-password`, `profile/change-password`
   - See `references/implementation_guide.md` Step 7

7. **Build UI pages**
   - Login page: `app/(public)/login/page.tsx`
   - Protected layout: `app/(protected)/layout.tsx`
   - Profile page: `app/(protected)/settings/profile/page.tsx`
   - See `references/implementation_guide.md` Step 8

8. **Test and deploy**
   - Follow testing checklist in `references/implementation_guide.md` Step 9
   - Review production checklist before deploying (Step 10)

## Architecture Overview

### Authentication Flow

**Email OTP (Primary):**
1. User enters email at `/login`
2. System validates email against allowlist (if enabled) and checks signup toggle
3. Rate limiting enforced; hCaptcha required after threshold
4. OTP generated, hashed with bcrypt, stored in database
5. Email sent via Resend with 6-digit code (configurable)
6. User enters code within expiration window (default 10 minutes)
7. System verifies code, consumes token, creates/updates user
8. JWT tokens issued (access ~1h, refresh ~14d) in HTTP-only cookies
9. Audit log created for the event

**Dev Password Signin (Development Only):**
1. Only available when `NODE_ENV=development` and `ENABLE_DEV_PASSWORD_SIGNIN=true`
2. Returns 404 in production for security
3. User enters email + password
4. System verifies against bcrypt hash
5. JWT tokens issued on success

### Session Management

**Dual Token System:**
- **Access token** (~1 hour): Short-lived, verified by Edge middleware (signature only)
- **Refresh token** (~14 days): Long-lived, verified by Node.js endpoints with DB check
- Tokens rotate on refresh to maintain security

**Session Invalidation:**
- Increment `User.sessionVersion` to invalidate all sessions globally
- Automatically incremented on password set/change
- Token verification compares `tokenVersion` claim to `User.sessionVersion`

**Edge Middleware:**
- Verifies JWT signature only (no database access)
- Redirects unauthenticated users to `/login?next=...`
- Protected routes: `/dashboard`, `/settings`, etc.
- Public routes: `/`, `/login`, `/api/auth/*`

### Security Features

**Email Allowlist:**
- Configurable via `AUTH_ALLOWLIST_ENABLED` (default: true)
- Comma-separated list in `ALLOWED_EMAILS` (normalized lowercase)
- Exact match required (no wildcards)
- Superadmins bypass this check
- Generic error messages to prevent email enumeration

**Signup Control:**
- Configurable via `AUTH_SIGNUP_ENABLED` (default: true)
- When disabled, only existing users can sign in
- Explicit error messages for better UX
- Superadmins bypass this restriction

**Rate Limiting:**
- Per email: 3 requests per 15 minutes, 10 per 24 hours
- Per IP: 5 requests per 15 minutes
- hCaptcha required after ≥2 requests in 15 minutes (when configured)
- Stored in `OtpRequest` table for tracking

**CSRF Protection:**
- All mutation endpoints validate Origin/Referer headers
- Allowlist includes `APP_URL` and optional `ALLOWED_ORIGINS`
- Development: auto-includes localhost variants

**Password Security:**
- Bcrypt hashing with configurable rounds (default: 12)
- zxcvbn strength validation (score ≥3 required)
- Min 8 characters
- Dev bypass: `SKIP_PASSWORD_VALIDATION=true` (set-password only)

**OTP Security:**
- Bcrypt-hashed storage (never plaintext)
- Single active token per email
- Configurable length (4-8 digits, default: 6)
- Configurable expiration (default: 10 minutes)
- Token consumed after 5 failed attempts
- New request invalidates previous unconsumed tokens

### Database Models

Four core models (see `references/database_schema.md` for complete schemas):

1. **User**: Authentication data, role, session version
2. **OtpToken**: Hashed OTP codes with expiration and attempt tracking
3. **OtpRequest**: Rate limiting tracking per email and IP
4. **AuditLog**: Comprehensive event logging for security monitoring

### Superadmin Role

Special user role with elevated privileges:

**Capabilities:**
- Bypass email allowlist checks
- Bypass signup toggle restrictions
- Create unlimited organizations (bypasses `ORG_CREATION_LIMIT`)
- Global access to all organizations without explicit membership

**Security:**
- Only grant to trusted system administrators
- Create via seed script: `scripts/seed-superadmin.ts`
- Set `SEED_EMAIL` environment variable and run: `npx tsx scripts/seed-superadmin.ts`

**Important:** Superadmins are security-critical accounts. Use sparingly and audit regularly.

## Configuration Reference

### Environment Variables

All configuration is done via environment variables. See `references/environment_variables.md` for complete documentation.

**Critical variables:**
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: ≥32 characters, use `openssl rand -base64 32`
- `JWT_ACCESS_COOKIE_NAME`, `JWT_REFRESH_COOKIE_NAME`: Cookie names for tokens
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`: Email service credentials
- `APP_URL`: Application base URL for CSRF validation
- `ALLOWED_EMAILS`: Comma-separated email allowlist

**Feature toggles:**
- `AUTH_ALLOWLIST_ENABLED`: Enable/disable email allowlist (default: true)
- `AUTH_SIGNUP_ENABLED`: Enable/disable new user signups (default: true)
- `ENABLE_DEV_PASSWORD_SIGNIN`: Enable dev password signin (dev only)
- `SKIP_PASSWORD_VALIDATION`: Bypass strength check in dev (set-password only)
- `ORG_CREATION_ENABLED`: Allow organization creation (default: false)
- `HCAPTCHA_ENABLED`: Enable CAPTCHA after rate limit threshold

**Tunable parameters:**
- `OTP_EXP_MINUTES`: OTP expiration in minutes (default: 10)
- `OTP_LENGTH`: OTP code length, 4-8 digits (default: 6)
- `BCRYPT_ROUNDS`: Bcrypt hashing rounds, 10-15 (default: 12)
- `ORG_CREATION_LIMIT`: Max orgs per user (default: 1)

### File Structure

Complete file structure with all required files:

```
app/
├── (public)/login/page.tsx              # Login with OTP + dev password
├── (protected)/
│   ├── layout.tsx                       # Auth guard wrapper
│   ├── dashboard/page.tsx               # Protected page example
│   └── settings/profile/page.tsx        # Password management
└── api/auth/
    ├── request-otp/route.ts             # Send OTP email
    ├── verify-otp/route.ts              # Verify OTP + create session
    ├── dev-signin/route.ts              # Dev password signin
    ├── signout/route.ts                 # Clear session
    ├── refresh/route.ts                 # Rotate tokens
    └── profile/
        ├── set-password/route.ts        # Set initial password
        └── change-password/route.ts     # Change existing password

lib/
├── db.ts                                # Prisma client singleton
├── env.ts                               # Environment validation
├── jwt.ts                               # JWT for Node.js
├── jwt-edge.ts                          # JWT for Edge
├── csrf.ts                              # CSRF validation
├── rate-limit.ts                        # Rate limiting
├── email.ts                             # Email sending
├── validators.ts                        # Zod schemas + password validation
├── auth.ts                              # Core auth logic
└── auth-helpers.ts                      # Session helpers

middleware.ts                            # Edge auth guard
prisma/schema.prisma                     # Database models
scripts/seed-superadmin.ts               # Superadmin creation
```

See `references/implementation_guide.md` for detailed code examples for each file.

## Implementation Workflow

### Step-by-Step Guide

Follow this workflow to implement the complete authentication system:

**Phase 1: Foundation (30-60 minutes)**
1. Install all dependencies (`references/dependencies.md`)
2. Set up Prisma schema and run migrations (`references/database_schema.md`)
3. Configure environment variables (`references/environment_variables.md`)
4. Create core library files: db, env, jwt, csrf (`references/implementation_guide.md` Steps 3-4)

**Phase 2: Authentication Logic (60-90 minutes)**
1. Implement email sending (`lib/email.ts`)
2. Build rate limiting logic (`lib/rate-limit.ts`)
3. Create Zod validators and password strength checking (`lib/validators.ts`)
4. Implement auth functions: OTP, passwords, audit (`lib/auth.ts`)
5. Create session management helpers (`lib/auth-helpers.ts`)

**Phase 3: API Routes (60-90 minutes)**
1. Implement `POST /api/auth/request-otp` (send OTP)
2. Implement `POST /api/auth/verify-otp` (verify + create session)
3. Implement `POST /api/auth/dev-signin` (dev password login)
4. Implement `POST /api/auth/signout` (clear session)
5. Implement `GET /api/auth/refresh` (rotate tokens)
6. Implement `POST /api/auth/profile/set-password`
7. Implement `POST /api/auth/profile/change-password`

**Phase 4: Middleware & Protection (15-30 minutes)**
1. Create Edge middleware (`middleware.ts`)
2. Set up protected layout (`app/(protected)/layout.tsx`)
3. Verify redirects work correctly

**Phase 5: UI Pages (90-120 minutes)**
1. Build login page with OTP flow (`app/(public)/login/page.tsx`)
2. Add dev password tab (conditional rendering)
3. Implement profile page with password management (`app/(protected)/settings/profile/page.tsx`)
4. Add shadcn/ui components as needed (Button, Input, Form, Tabs, Card, etc.)
5. Integrate toast notifications with Sonner

**Phase 6: Testing & Refinement (60-90 minutes)**
1. Test complete OTP flow end-to-end
2. Verify email allowlist enforcement
3. Test rate limiting and CAPTCHA (if enabled)
4. Verify CSRF protection
5. Test password set/change with session rotation
6. Verify middleware protection and redirects
7. Check audit logs are created
8. Test dev password signin (development only)

**Total estimated time:** 5-8 hours for complete implementation

### Common Implementation Patterns

**Protected API Route Pattern:**
```typescript
export const runtime = "nodejs" // Required for DB access

export async function POST(req: Request) {
  // 1. CSRF validation
  if (!isRequestOriginValid(req)) {
    return Response.json({ error: 'Invalid origin' }, { status: 403 })
  }

  // 2. Get current user
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 3. Parse and validate request
  const body = await req.json()
  const data = yourSchema.parse(body)

  // 4. Perform operation
  // ...

  // 5. Audit log
  await auditLog({
    action: 'action_name',
    userId: user.id,
    email: user.email,
    ip: req.headers.get('x-forwarded-for') || 'unknown',
  })

  // 6. Return response
  return Response.json({ ok: true })
}
```

**Protected Server Component Pattern:**
```typescript
import { getCurrentUser } from '@/lib/auth-helpers'
import { redirect } from 'next/navigation'

export default async function ProtectedPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return <div>Protected content for {user.email}</div>
}
```

**Client Form with Validation:**
```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

export function MyForm() {
  const form = useForm({
    resolver: zodResolver(mySchema),
  })

  async function onSubmit(data) {
    try {
      const res = await fetch('/api/auth/endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await res.json()

      if (!res.ok) {
        toast.error(result.error || 'Operation failed')
        return
      }

      toast.success('Success!')
    } catch (error) {
      toast.error('Network error. Please try again.')
    }
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>
}
```

## Audit Logging

All authentication events are logged to the `AuditLog` table for security monitoring and compliance.

**Logged Events:**
- `otp_request`: OTP email sent
- `otp_request_blocked`: OTP request blocked (rate limit, allowlist, signup disabled)
- `otp_verify_success`: User successfully verified OTP
- `otp_verify_failure`: OTP verification failed (reasons in metadata)
- `dev_signin_success`: Dev password signin succeeded
- `dev_signin_failure`: Dev password signin failed (reasons in metadata)
- `password_set`: User set initial password
- `password_change_success`: User changed password
- `password_change_failure`: Password change failed (wrong current password)
- `signout`: User signed out

**Metadata Examples:**
- Failed verification: `{ reason: 'invalid_code', attempts: 3 }`
- Blocked request: `{ reason: 'rate_limit_exceeded', email_15m_count: 4 }`
- Signup disabled: `{ reason: 'signup_disabled_no_account' }`

Query audit logs for security monitoring:
```typescript
const recentFailures = await db.auditLog.findMany({
  where: {
    action: 'otp_verify_failure',
    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  },
  orderBy: { createdAt: 'desc' },
})
```

## Production Deployment

Before deploying to production, complete this checklist:

**Environment Configuration:**
- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `JWT_SECRET` (≥32 chars, never reuse from dev)
- [ ] Configure production `APP_URL` (actual domain)
- [ ] Set up Resend with verified domain
- [ ] Configure `ALLOWED_EMAILS` appropriately or set `AUTH_ALLOWLIST_ENABLED=false`
- [ ] Set `ENABLE_DEV_PASSWORD_SIGNIN=false` or remove entirely
- [ ] Consider enabling `HCAPTCHA_*` for bot protection
- [ ] Review `AUTH_SIGNUP_ENABLED` setting based on your use case

**Database & Infrastructure:**
- [ ] Set up production PostgreSQL database
- [ ] Run migrations: `npx prisma migrate deploy`
- [ ] Enable database backups (automated, tested restore process)
- [ ] Set up monitoring for database performance
- [ ] Consider connection pooling (PgBouncer, Prisma Data Proxy)

**Security Hardening:**
- [ ] Review all environment variables for sensitive data
- [ ] Ensure cookies use `secure: true` in production
- [ ] Set up rate limiting at infrastructure level (Cloudflare, etc.)
- [ ] Configure CSP headers for additional XSS protection
- [ ] Review and test CSRF protection
- [ ] Set up security monitoring and alerts

**Testing:**
- [ ] Test complete OTP flow end-to-end in production-like environment
- [ ] Verify email deliverability (check spam folders)
- [ ] Test rate limiting behavior
- [ ] Verify CSRF protection blocks invalid origins
- [ ] Test session expiration and refresh
- [ ] Verify middleware protects all routes correctly
- [ ] Test password set/change flows

**Monitoring & Maintenance:**
- [ ] Set up application logging (errors, warnings)
- [ ] Monitor audit logs for suspicious activity
- [ ] Set up alerts for failed auth attempts
- [ ] Plan for `OtpRequest` cleanup (cron job to delete old records)
- [ ] Document incident response procedures
- [ ] Schedule regular security reviews

**Email Deliverability:**
- [ ] Verify Resend domain and DNS records
- [ ] Test emails to major providers (Gmail, Outlook, etc.)
- [ ] Set up SPF, DKIM, and DMARC records
- [ ] Monitor bounce rates and spam reports
- [ ] Have fallback contact method if emails fail

## Troubleshooting

### Common Issues

**OTP emails not sending:**
- Verify `RESEND_API_KEY` is valid and not expired
- Check that sending domain is verified in Resend dashboard
- Review application logs for Resend API errors
- Test with a simple curl request to Resend API
- Check spam folders on recipient email
- Verify `RESEND_FROM_EMAIL` uses verified domain

**JWT verification failures:**
- Ensure `JWT_SECRET` is identical across all instances/reploys
- Check cookie settings (httpOnly, secure, sameSite, path)
- Verify token hasn't expired (check exp claim)
- Ensure `sessionVersion` matches between token and database
- Check browser developer tools for cookie presence

**Rate limiting too aggressive:**
- Adjust limits via environment variables (see `environment_variables.md`)
- Consider clearing old `OtpRequest` records
- Review IP detection logic (check `x-forwarded-for` header)
- Test from different IPs to isolate email vs IP limits

**Middleware redirect loops:**
- Ensure `/login` is in `PUBLIC_PATHS` constant
- Verify all `/api/auth/*` routes are public
- Check Edge runtime compatibility of imported modules
- Review middleware matcher configuration
- Test with browser developer tools network tab

**CSRF validation blocking legitimate requests:**
- Verify `APP_URL` matches actual application domain
- Check Origin/Referer headers in browser developer tools
- Add additional origins to `ALLOWED_ORIGINS` if needed
- Ensure forms submit to same origin
- Review CORS configuration if using separate frontend

**Password strength validation too strict:**
- Review zxcvbn feedback messages for user guidance
- Consider temporarily using `SKIP_PASSWORD_VALIDATION=true` in dev
- Check that password requirements are communicated to users
- Test with passphrases (often stronger than complex passwords)

**Database connection issues:**
- Verify `DATABASE_URL` format and credentials
- Check network connectivity to database
- Review connection pool settings
- Test connection with `npx prisma studio`
- Check for connection leaks (not closing Prisma client)

### Debug Mode

Add debug logging to troubleshoot issues:

```typescript
// lib/auth.ts
export async function verifyOtpToken(email: string, code: string): Promise<boolean> {
  if (process.env.DEBUG_AUTH) {
    console.log('[AUTH] Verifying OTP:', { email, codeLength: code.length })
  }

  const token = await db.otpToken.findFirst({
    where: {
      email,
      consumedAt: null,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (process.env.DEBUG_AUTH) {
    console.log('[AUTH] Token found:', { found: !!token, attempts: token?.attempts })
  }

  // ... rest of function
}
```

Set `DEBUG_AUTH=true` in development to enable detailed logging.

### Getting Help

If you encounter issues not covered here:

1. Check the reference files in `references/` for detailed implementation examples
2. Review the existing codebase (if this is based on the reference implementation)
3. Search audit logs for related events and error metadata
4. Test individual components in isolation (e.g., just OTP generation)
5. Verify all dependencies are correctly installed and versions match

## Resources

This skill includes comprehensive reference documentation:

### references/database_schema.md
Complete Prisma schema definitions for all authentication models (User, OtpToken, OtpRequest, AuditLog) with field descriptions, indices, and migration commands. Includes superadmin seeding script.

### references/environment_variables.md
Exhaustive documentation of all environment variables with descriptions, defaults, examples, and security notes. Includes complete `.env` template.

### references/dependencies.md
All runtime and development dependencies with installation commands, version compatibility, TypeScript configuration requirements, and native module build instructions.

### references/implementation_guide.md
Detailed step-by-step implementation guide with complete code examples for all library files, API routes, middleware, and UI pages. Includes testing checklist and production deployment guide.

**Using references:** Reference files contain detailed implementation code and should be consulted when implementing specific components. The main SKILL.md provides the workflow and architecture; references provide the code.
