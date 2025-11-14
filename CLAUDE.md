# Claude Code Guidelines

Concise engineering guide for building and changing code in this repo.

## Stack (at a glance)

- App Router + React + TypeScript (strict)
- Tailwind + shadcn/ui (Radix). Icons: Lucide only.
- Local PostgreSQL + Prisma (pgvector enabled).
- Email OTP + JWT sessions (access + refresh, HTTP-only cookies). bcrypt + jose.
- Vercel AI SDK (server-side only).

## Quick Start

```bash
npm install

cp .env.example .env

npx prisma generate

npx prisma migrate dev

npm run dev
```

Minimal env required in `.env` (see `.env.example` for full list):

```
DATABASE_URL=postgresql://user:password@localhost:5432/db
JWT_SECRET=<32+ chars>
JWT_ACCESS_COOKIE_NAME=__access
JWT_REFRESH_COOKIE_NAME=__session
ALLOWED_EMAILS=user@example.com,admin@example.com
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com
APP_URL=http://localhost:3000
```

Visit /login to test authentication.

## Authentication (concise)

Email OTP is primary (request via /api/auth/request-otp, verify via /api/auth/verify-otp). Dev password signin is available in development when enabled.

Session basics:

- Access token (short-lived) is checked by Edge middleware (signature only).
- Refresh token (long-lived) rotates via /api/auth/refresh.
- Password changes increment sessionVersion to invalidate old sessions.

### API Routes (map)

```
POST /api/auth/request-otp         # Send OTP via email
POST /api/auth/verify-otp          # Verify code, create session
POST /api/auth/dev-signin          # Dev-only password signin
POST /api/auth/signout             # Clear cookies, audit logout
GET  /api/auth/refresh             # Rotate tokens
POST /api/auth/profile/set-password      # Set password (no current)
POST /api/auth/profile/change-password   # Change password (requires current)
```

## Dashboard Shell (quick)

Two-level navigation (Sections → Pages), resizable/collapsible sidebar, mobile drawer (Sheet), per-user persistence.

Customize shell/navigation in the app layouts and `components/features/dashboard/*`.

## Project Structure (minimal)

```
app/
  (public)/login/
  api/{auth,orgs}/
  admin/
  invite/
  onboarding/create-organization/
  o/[orgSlug]/
components/{ui,features}/
lib/* (+ ai/*)
prisma/
middleware.ts
```

POST /api/orgs/[orgSlug]/ai/generate # Text generation (supports streaming)
POST /api/orgs/[orgSlug]/ai/keys # Add/verify/remove provider API keys
POST /api/orgs/[orgSlug]/ai/models # Add/remove curated models; set default
GET /api/integrations/[provider]/callback # OAuth callback (code+state)
POST /api/integrations/[provider]/test # Connection test
POST /api/integrations/[provider]/disconnect # Disconnect and revoke/remove tokens

## Coding Standards (core)

- Server-first: default Server Components; add `'use client'` only when needed.
- API routes must set `export const runtime = "nodejs"` for DB access.
- Security red lines: see `AGENTS.md`.

## Multi-Tenant Patterns (Sololedger)

### API Route Structure

Standard flow: `getCurrentUser()` → `getOrgBySlug()` → permission check → query with `org.id`

Always filter soft-deleted records: `where: { organizationId: org.id, deletedAt: null }`

### Permission Layers

- **requireMembership**: GET endpoints (members need read access)
- **requireAdminOrSuperadmin**: PATCH/POST/DELETE endpoints (write/config operations)

Example: Financial settings GET = `requireMembership` (members need formatting), PATCH = `requireAdminOrSuperadmin`

### Route Parameters

- ✅ Always use `[orgSlug]` for org routes (never mix with `[orgId]`)
- Pattern: `[orgSlug]` → `getOrgBySlug()` → use `org.id` for DB queries

### Zod Patterns

```typescript
// ❌ WRONG
currencyCode: z.string().length(3).toUpperCase()

// ✅ CORRECT
currencyCode: z.string().length(3).transform((val) => val.toUpperCase())
```

### Prisma Decimals

Always convert `Decimal` to `Number`: `const total = Number(decimal) * rate`

### Soft Deletes

- Add `deletedAt DateTime?` to models
- Always filter: `deletedAt: null`
- Delete: `update({ data: { deletedAt: new Date() } })`

### Financial Rules

- YTD based on fiscal year (`fiscalYearStartMonth`), not calendar year
- Decimal separator ≠ thousands separator
- Store: `amountOriginal`, `currencyOriginal`, `exchangeRateToBase`, `amountBase`
- Recalculate: `amountBase = amountOriginal × exchangeRateToBase`

### Transaction Validation

- Amount must be positive
- Category type must match transaction type (INCOME/EXPENSE)
- POSTED = no future dates, DRAFT = future OK
- Always validate category type matches on create/update

### Multi-Step Onboarding

1. Add `onboardingComplete: boolean` flag
2. Layout guard redirects to next incomplete step
3. Show step indicators ("Step 2 of 4")
4. Final step sets `onboardingComplete: true`

### Client Forms

Pattern: Load org on mount → get `orgId` → fetch lookups → show form with loading states → submit to `/api/orgs/${orgId}/resource`

## Required Environment Variables

# Database (required)

DATABASE_URL=postgresql://user:password@localhost:5432/db

JWT_ACCESS_COOKIE_NAME=**access
JWT_REFRESH_COOKIE_NAME=**session
ALLOWED_EMAILS=user@example.com,admin@example.com
RESEND_FROM_EMAIL=noreply@yourdomain.com

# App (required)

APP_URL=http://localhost:3000

# Dev Mode (optional)

ENABLE_DEV_PASSWORD_SIGNIN=true # Enable password signin in dev

SKIP_PASSWORD_VALIDATION=false # Skip zxcvbn in set-password (dev only)
HCAPTCHA_SITE_KEY=
HCAPTCHA_SECRET_KEY=

# Tunables (optional, defaults shown)

OTP_EXP_MINUTES=10
OTP_LENGTH=6
BCRYPT_ROUNDS=12

````
6. ❌ Handle OAuth or store provider tokens in client; server-only. APP_ENCRYPTION_KEY required when storing tokens.

## Notes

- pgvector: enable once per DB; Prisma treats `vector` as unsupported — use raw SQL.
- Critical UI patterns (Dialog pointer-events, SelectItem values, Toasts): see `AGENTS.md`.

## AI (quick note)

- Server-side only. Never expose API keys or calls to client.
- See `notes/skills/ai_features.md` for details.

## References

- AGENTS.md — Guardrails and constraints (security red lines, UI patterns)
- README.md — Setup guide and customization
- .env.example — Complete environment variables
- notes/skills/authentication.md — Full auth details
- notes/boilerplate_wireframes.md — Flows and diagrams

## Development Commands

```bash
npm run dev          # Start dev server (Turbopack, :3000)
npm run build        # Production build
npm start            # Serve production build
npm run lint         # Run ESLint

npx shadcn@latest add <component>  # Add UI component
npx prisma studio                   # Open database GUI
````

## Red Lines (Never Do)

1. ❌ Use Edge runtime for database operations
2. ❌ Expose secrets or API keys to client
3. ❌ Make AI calls from client components
4. ❌ Add icon libraries other than Lucide
5. ❌ Use cloud databases (local PostgreSQL only)

## Reference Documentation

- `AGENTS.md` — Comprehensive guidelines for AI agents
- `notes/skills/authentication.md` — Auth implementation details
- `notes/skills/dashboard_shell.md` — Dashboard customization guide
- `notes/wireframes.md` — UX flows and ASCII wireframes
- `.env.example` — All environment variables with descriptions
- `README.md` — Setup guide and customization

## External Resources

- [Next.js 15 Docs](https://nextjs.org/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Radix UI Primitives](https://www.radix-ui.com)
- [Vercel AI SDK](https://ai-sdk.dev/docs)
- [Prisma Docs](https://www.prisma.io/docs)
