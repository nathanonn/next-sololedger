# Repository Guidelines

Next.js 15.3.4 (App Router) + React 19 + TypeScript 5 + Tailwind v4 + Prisma/Postgres 15 with complete email OTP authentication and resizable dashboard shell.

## Stack & Guardrails
- **Styling**: Tailwind v4 + shadcn/ui (Radix). Icons: **Lucide only**.
- **Database**: Local Postgres 15 + Prisma ORM. pgvector enabled for embeddings.
- **Auth**: Email OTP (Resend) + JWT sessions (access + refresh tokens in HTTP-only cookies). bcrypt + jose.
- **AI**: Vercel AI SDK (provider-agnostic, defaults to Gemini). **Server-side only**. Docs: https://ai-sdk.dev/docs
- **Forms**: React Hook Form + Zod validation.

### Red Lines (Never Do)
- ❌ Use Edge runtime for database operations
- ❌ Expose secrets or AI calls to client
- ❌ Add icon libraries other than Lucide
- ❌ Use cloud databases (local PostgreSQL only)

## Project Structure

```
app/
├── (public)/login/          # Email OTP + dev password signin
├── (protected)/             # Auth-protected routes
│   ├── layout.tsx          # Server layout with DashboardShell
│   ├── dashboard/          # Protected pages
│   └── settings/profile/   # Profile management
├── api/auth/               # Auth API routes (Node runtime)
│   ├── request-otp/        # Send OTP via email
│   ├── verify-otp/         # Verify OTP and create session
│   ├── dev-signin/         # Dev-only password signin
│   ├── signout/            # Clear session cookies
│   ├── refresh/            # Token rotation endpoint
│   └── profile/            # Password management
└── globals.css

components/
├── ui/                     # shadcn components (excluded from tsconfig)
└── features/dashboard/     # Dashboard shell & sidebar

lib/
├── db.ts                   # Prisma client singleton
├── env.ts                  # Zod environment validation
├── jwt.ts                  # JWT signing/verification (Node)
├── jwt-edge.ts             # JWT signature check (Edge)
├── csrf.ts                 # CSRF origin validation
├── rate-limit.ts           # Per-email & per-IP limits
├── email.ts                # Email via Resend
├── validators.ts           # Zod schemas + zxcvbn password strength
├── auth.ts                 # OTP, passwords, audit logging
├── auth-helpers.ts         # getCurrentUser, token refresh
└── utils.ts                # cn helper, etc.

prisma/
├── schema.prisma           # User, OtpToken, OtpRequest, AuditLog
└── migrations/

middleware.ts               # Edge auth guard (JWT signature only)
```

## Authentication Architecture

### Email OTP Flow (Primary)
1. User enters email → `/api/auth/request-otp`
2. System validates allowlist, checks rate limits, sends OTP via Resend
3. User enters 6-digit code → `/api/auth/verify-otp`
4. System verifies OTP, creates/updates user (JIT), issues JWT tokens
5. Access token (~1h) + Refresh token (~14d) stored in HTTP-only cookies

### Dev Password Signin (Development Only)
- Enabled when `NODE_ENV=development` and `ENABLE_DEV_PASSWORD_SIGNIN=true`
- POST `/api/auth/dev-signin` with email + password
- Returns 404 in production or when disabled

### Session Management
- **Access Token**: Short-lived (~1h), verified by middleware (Edge)
- **Refresh Token**: Long-lived (~14d), rotates on use via `/api/auth/refresh`
- **Session Versioning**: `User.sessionVersion` incremented on password change to invalidate all sessions
- **Token Rotation**: Middleware rewrites to refresh endpoint when access expired but refresh valid

### Security Features
- ✅ CSRF protection (Origin/Referer validation)
- ✅ Rate limiting (3/15m & 10/day per email; 5/15m per IP)
- ✅ Email allowlist enforcement
- ✅ Optional hCaptcha gating after threshold
- ✅ Audit logging for all auth events
- ✅ Password strength validation (zxcvbn, min 8 chars)
- ✅ Bcrypt hashing (12 rounds default)

## Dashboard Shell Pattern

### Resizable Two-Level Navigation
- **Sections** (e.g., Main, Settings) contain **Pages** (e.g., Dashboard, Profile)
- Sidebar: resizable (15-35% width), collapsible (icon-only ~4%)
- Mobile: left drawer (Sheet) with full sidebar
- Persistence: localStorage per user (`app.v1.sidebar.width:{userId}`, `app.v1.sidebar.collapsed:{userId}`)
- Built with `react-resizable-panels`

### Data Flow
1. Protected layout (server) fetches user + navigation data
2. Passes serializable props to `DashboardShell` (client)
3. Shell manages responsive behavior and persistence
4. `Sidebar` renders navigation with active highlighting

## Coding Style & Conventions

### TypeScript (Strict Mode)
- Explicit return types for all exported functions
- Avoid `any` — use `unknown` + type guards
- No `enum` — use const objects or string literal unions
- No classes — functional patterns only

### Naming
- **Files/dirs**: `kebab-case` (`user-profile.tsx`)
- **Components**: `PascalCase` (`DashboardShell`)
- **Functions**: `camelCase` (`getCurrentUser`)
- **Constants**: `UPPER_SNAKE_CASE` (`JWT_SECRET`)

### Server vs Client
- **Default**: Server Components (no `'use client'`)
- **Add `'use client'`**: Only for hooks, event handlers, browser APIs
- **API Routes**: `export const runtime = "nodejs"` for DB access
- **Never**: Import server-only code into client components

## Database & Prisma

### Models
```prisma
User         # id, email, passwordHash?, role, sessionVersion, emailVerifiedAt
OtpToken     # email, otpHash (bcrypt), expiresAt, consumedAt, attempts
OtpRequest   # email, ip, requestedAt (for rate limiting)
AuditLog     # action, userId, email, ip, metadata, createdAt
```

### Commands
```bash
npx prisma generate                   # After schema changes
npx prisma migrate dev --name <desc>  # Create + apply migration
npx prisma studio                     # GUI for data
```

### pgvector Usage
```sql
-- Enable once per database
CREATE EXTENSION IF NOT EXISTS vector;

-- Prisma treats vector as unsupported, use raw SQL:
-- Query: ORDER BY embedding <=> $query_vector
-- Index: CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)
```

## Environment Variables (Required)

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/db

# Auth (JWT secret must be 32+ characters)
JWT_SECRET=<generate with: openssl rand -base64 32>
JWT_ACCESS_COOKIE_NAME=__access
JWT_REFRESH_COOKIE_NAME=__session

# Email Allowlist (comma-separated, required)
ALLOWED_EMAILS=user@example.com,admin@example.com

# Email Provider (Resend)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Dev Mode (optional)
ENABLE_DEV_PASSWORD_SIGNIN=true
SKIP_PASSWORD_VALIDATION=false  # Dev only, bypasses zxcvbn in set-password

# Rate Limiting & Captcha (optional)
HCAPTCHA_ENABLED=false
HCAPTCHA_SITE_KEY=
HCAPTCHA_SECRET_KEY=

# Tunables
OTP_EXP_MINUTES=10
OTP_LENGTH=6
BCRYPT_ROUNDS=12
```

## Critical UI Patterns

### Dialog from Dropdown/ContextMenu
```tsx
<Dialog open={open} onOpenChange={(isOpen) => {
  setOpen(isOpen)
  if (!isOpen) {
    // REQUIRED: Restore pointer events after close
    setTimeout(() => {
      document.body.style.pointerEvents = ""
    }, 300)
  }
}}>
```

### SelectItem Values
```tsx
// ❌ Never use empty string
<SelectItem value="">None</SelectItem>

// ✅ Use semantic value, convert to null in logic
<SelectItem value="none">None</SelectItem>
const value = formData.category === "none" ? null : formData.category
```

## Development Commands

```bash
npm run dev          # Dev server with Turbopack (:3000)
npm run build        # Production build
npm start            # Serve production build
npm run lint         # ESLint check

npx shadcn@latest add <component>  # Add shadcn component
```

## Commit Conventions

```
feat: add email OTP authentication
fix: resolve token refresh loop
chore: update dependencies
refactor: simplify JWT validation
docs: update setup guide
test: add OTP flow tests
perf: optimize database queries
```

Subject lines ≤72 characters. Body wraps at 80.

## Testing (Not Yet Configured)

When adding tests:
- **Unit**: Jest + React Testing Library
- **E2E**: Playwright
- **API Mocking**: MSW
- **Database**: Separate test DB, migrate + reset per run

## Common Patterns

### Protected Route (Server Component)
```tsx
import { getCurrentUser } from '@/lib/auth-helpers'
import { redirect } from 'next/navigation'

export default async function Page() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return <div>Protected content for {user.email}</div>
}
```

### API Route with Auth
```tsx
import { getCurrentUser } from '@/lib/auth-helpers'

export const runtime = "nodejs"  // REQUIRED for DB access

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Handle authenticated request
  return Response.json({ ok: true })
}
```

### Form with Zod Validation
```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2)
})

export function MyForm() {
  const form = useForm({ resolver: zodResolver(schema) })

  async function onSubmit(data: z.infer<typeof schema>) {
    const res = await fetch('/api/endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    // Handle response
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>
}
```

## Reference Documentation

- `notes/skills/authentication.md` — Complete auth implementation details
- `notes/skills/dashboard_shell.md` — Dashboard pattern and customization
- `notes/wireframes.md` — UX flows and ASCII wireframes
- `.env.example` — All environment variables with descriptions
- `README.md` — Setup guide and customization instructions
