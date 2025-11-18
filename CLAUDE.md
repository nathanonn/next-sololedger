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
- **Backend-first implementation**: Complete all API endpoints with full validation, security, and audit logging before building UI. This ensures stable API contracts, enables faster UI iteration, provides clear separation of concerns, and readies the system for mobile/external integrations.

## Multi-Tenant Patterns (Sololedger)

### API Route Structure

Standard flow: `getCurrentUser()` → `getOrgBySlug()` → permission check → query with `org.id`

Always filter soft-deleted records: `where: { organizationId: org.id, deletedAt: null }`

### Permission Layers

- **requireMembership**: GET endpoints and regular operations (members need read access and basic functionality)
- **requireAdminOrSuperadmin**: PATCH/POST/DELETE endpoints, destructive operations, and configuration changes

**Tiered permission strategy**: Regular operations (create, read, update, soft delete) should be accessible to all members, while destructive operations (hard delete, permanent changes) require elevated privileges. This balances accessibility with protection.

Examples:
- Financial settings GET = `requireMembership` (members need formatting), PATCH = `requireAdminOrSuperadmin`
- Document upload/link/soft delete = `requireMembership`, hard delete = `requireAdminOrSuperadmin`

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

### Prisma Query Patterns

**Complex filtering with OR/AND combinations**

When combining multiple OR conditions in a single query, wrap them in AND to avoid conflicts:

```typescript
// Example: Combining date range OR with search field OR
const where: Prisma.RecordWhereInput = { organizationId: org.id };

// First OR condition (date range with fallback)
if (startDate || endDate) {
  where.OR = [
    { dateField: { gte: startDate, lte: endDate } },
    { fallbackDate: { gte: startDate, lte: endDate } }
  ];
}

// Second OR condition (search across fields)
if (searchQuery) {
  const searchConditions = [
    { field1: { contains: searchQuery } },
    { field2: { contains: searchQuery } }
  ];

  // Must wrap both OR conditions in AND
  if (where.OR) {
    where.AND = [{ OR: where.OR }, { OR: searchConditions }];
    delete where.OR;
  } else {
    where.OR = searchConditions;
  }
}
```

**Filtering many-to-many relations with conditions on target model**

When querying through join tables, you cannot filter directly on fields that exist only on the target model. Navigate through the nested relation:

```typescript
// Schema: Model A ↔ JoinTable ↔ Model B (B has deletedAt, JoinTable does not)

// ❌ WRONG - deletedAt doesn't exist on join table
const result = await prisma.modelA.findUnique({
  where: { id },
  include: {
    joinTableRelation: {
      where: { deletedAt: null }  // Error!
    }
  }
});

// ✅ CORRECT - filter through nested relation, then flatten
const result = await prisma.modelA.findUnique({
  where: { id },
  include: {
    joinTableRelation: {
      where: {
        modelB: { deletedAt: null }  // Navigate to target model
      },
      include: {
        modelB: {  // Include actual data
          select: { id: true, name: true, ... }
        }
      }
    }
  }
});

// Flatten the response
const flattened = {
  ...result,
  relatedItems: result.joinTableRelation.map(jt => jt.modelB)
};
```

**Key insight**: Prisma's relation name for join tables refers to the join table entries, not the target model. Always navigate through the target model field to access its properties.

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

### SelectItem Value Rule

**NEVER** use empty string `""` as a SelectItem value. Shadcn's Select component doesn't handle empty values properly. Instead:

- Use a meaningful string like `"root"`, `"none"`, `"default"`, etc.
- Update all related logic to handle the placeholder value correctly
- Convert the placeholder value back to `null` in the submission logic if needed

```typescript
// ❌ WRONG - Don't use empty string
<SelectItem value="">No selection</SelectItem>

// ✅ CORRECT - Use meaningful placeholder value
<SelectItem value="none">No selection</SelectItem>
<SelectItem value="root">No parent (root level)</SelectItem>
<SelectItem value="default">Use default setting</SelectItem>

// Handle in form submission
const handleSubmit = (values) => {
  const processedValues = {
    ...values,
    parentId: values.parentId === 'root' ? null : values.parentId,
    category: values.category === 'none' ? null : values.category
  };
  // Submit processedValues
};
```

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

## Common Pitfalls

### @paralleldrive/cuid2 Import

The cuid2 package changed its API between v1 and v2. Always use the correct import:

```typescript
// ❌ WRONG - v1 pattern, will fail with "Export cuid doesn't exist"
import { cuid } from '@paralleldrive/cuid2';
const id = cuid();

// ✅ CORRECT - v2 exports createId
import { createId } from '@paralleldrive/cuid2';
const id = createId();
```

**Root cause**: @paralleldrive/cuid2 v2.x changed the main export from `cuid` to `createId`. Always check package TypeScript definitions when upgrading dependencies.

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
