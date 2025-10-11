# Claude Code Guidelines

This Next.js boilerplate includes **production-ready email OTP authentication** with JWT sessions, rate limiting, CSRF protection, and a **resizable dashboard shell**. Follow these guidelines when working with this codebase.

## Technology Stack

- **Framework**: Next.js 15.3.4 (App Router) + React 19 + TypeScript 5 (strict)
- **Styling**: Tailwind CSS v4 + shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React only
- **Database**: Local PostgreSQL 15 + Prisma ORM (pgvector enabled)
- **Auth**: Email OTP (Resend) + JWT sessions (access + refresh tokens, HTTP-only cookies)
- **Hashing/Crypto**: bcrypt + jose
- **Forms**: React Hook Form + Zod validation
- **Toasts**: Sonner for toast notifications (top-right position)
- **AI**: Vercel AI SDK (provider-agnostic, defaults to Google Gemini)

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment (copy .env.example to .env and fill required values)
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Enable pgvector (run once in psql)
psql -d your_database -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Start dev server
npm run dev
```

Visit `http://localhost:3000/login` to test authentication.

## Authentication System

### Email OTP Flow (Primary)
1. User enters email → system validates allowlist, enforces rate limits
2. OTP sent via Resend (or logged to console in dev mode)
3. User enters 6-digit code → system verifies, creates/updates user
4. JWT tokens issued: access (~1h) + refresh (~14d) in HTTP-only cookies

**Key Features**:
- ✅ Email allowlist (`ALLOWED_EMAILS` env var)
- ✅ Rate limiting: 3/15m & 10/day per email; 5/15m per IP
- ✅ CSRF protection (Origin/Referer validation)
- ✅ Optional hCaptcha after threshold
- ✅ Audit logging for all auth events
- ✅ Password strength validation (zxcvbn)
- ✅ Session versioning for global invalidation

### Dev Password Signin (Development Only)
- Available when `NODE_ENV=development` and `ENABLE_DEV_PASSWORD_SIGNIN=true`
- Returns 404 in production
- Useful for testing without email setup

### Session Management
- **Access token** (~1h): Verified by Edge middleware (signature only, no DB)
- **Refresh token** (~14d): Verified by Node endpoint, rotates on use
- **Token rotation**: Middleware rewrites to `/api/auth/refresh` when access expired
- **Session invalidation**: Increment `User.sessionVersion` to invalidate all sessions

### API Routes
```
POST /api/auth/request-otp         # Send OTP via email
POST /api/auth/verify-otp          # Verify code, create session
POST /api/auth/dev-signin          # Dev-only password signin
POST /api/auth/signout             # Clear cookies, audit logout
GET  /api/auth/refresh             # Rotate tokens
POST /api/auth/profile/set-password      # Set password (no current)
POST /api/auth/profile/change-password   # Change password (requires current)
```

## Dashboard Shell

### Two-Level Navigation
- **Sections** (e.g., Main, Settings) contain **Pages** (e.g., Dashboard, Profile)
- **Desktop**: Resizable sidebar (15-35% width), collapsible to icon-only (~4%)
- **Mobile**: Left drawer (Sheet) with full sidebar content
- **Persistence**: Per-user localStorage (`app.v1.sidebar.width:{userId}`, collapsed state)

### Customization
Edit `app/(protected)/layout.tsx` to customize sections and pages:

```tsx
const sections = [
  { id: "main", label: "Main", icon: <Home /> },
  { id: "settings", label: "Settings", icon: <Settings /> },
]

const pages = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", sectionId: "main" },
  { id: "profile", label: "Profile", href: "/settings/profile", sectionId: "settings" },
]
```

## Project Structure

```
app/
├── (public)/login/               # Email OTP + dev password signin
├── (protected)/                  # Auth-protected routes
│   ├── layout.tsx               # Server layout with DashboardShell
│   ├── dashboard/page.tsx       # Example protected page
│   └── settings/profile/        # Password management
└── api/auth/                    # Auth endpoints (Node runtime)

components/
├── ui/                          # shadcn components (auto-generated)
└── features/dashboard/          # Dashboard shell & sidebar

lib/
├── db.ts                        # Prisma client singleton
├── env.ts                       # Zod environment validation
├── jwt.ts & jwt-edge.ts         # JWT for Node & Edge
├── csrf.ts                      # CSRF origin validation
├── rate-limit.ts                # Per-email & per-IP limits
├── email.ts                     # Email via Resend
├── validators.ts                # Zod schemas + password strength
├── auth.ts                      # OTP, passwords, audit logging
└── auth-helpers.ts              # getCurrentUser, token refresh

prisma/
├── schema.prisma                # User, OtpToken, OtpRequest, AuditLog
└── migrations/

middleware.ts                    # Edge auth guard (JWT signature only)
```

## Coding Standards

### Server-First Approach
- **Default**: Server Components (no `'use client'`)
- **Add `'use client'`**: Only for hooks, event handlers, browser APIs
- **API Routes**: Always `export const runtime = "nodejs"` for DB access
- **Never**: Use Edge runtime for database operations
- **Never**: Import server-only code into client components

### TypeScript
- Strict mode enabled
- Explicit return types for all exported functions
- Avoid `any` — use `unknown` + type guards
- No `enum` — use const objects or string literal unions
- No classes — functional patterns only

### Naming Conventions
- **Files/dirs**: `kebab-case` (`user-profile.tsx`)
- **Components**: `PascalCase` (`DashboardShell`)
- **Functions**: `camelCase` (`getCurrentUser`)
- **Constants**: `UPPER_SNAKE_CASE` (`JWT_SECRET`)

### Security Best Practices
- All cookies: `httpOnly`, `secure` (production), `sameSite: 'strict'`
- Validate all inputs with Zod
- Rate limit authentication endpoints
- CSRF validation on mutations
- Hash passwords with bcrypt (12 rounds default)
- Never log sensitive data (passwords, tokens, API keys)
- Never expose secrets or AI calls to client

## Required Environment Variables

```bash
# Database (required)
DATABASE_URL=postgresql://user:password@localhost:5432/db

# Auth (required)
JWT_SECRET=<32+ chars, generate with: openssl rand -base64 32>
JWT_ACCESS_COOKIE_NAME=__access
JWT_REFRESH_COOKIE_NAME=__session
ALLOWED_EMAILS=user@example.com,admin@example.com

# Email (required for production OTP)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com

# App (required)
APP_URL=http://localhost:3000

# Dev Mode (optional)
ENABLE_DEV_PASSWORD_SIGNIN=true      # Enable password signin in dev
SKIP_PASSWORD_VALIDATION=false        # Skip zxcvbn in set-password (dev only)

# Rate Limiting & Captcha (optional)
HCAPTCHA_ENABLED=false
HCAPTCHA_SITE_KEY=
HCAPTCHA_SECRET_KEY=

# Tunables (optional, defaults shown)
OTP_EXP_MINUTES=10
OTP_LENGTH=6
BCRYPT_ROUNDS=12
```

## Database & Prisma

### Models
- **User**: id, email, passwordHash?, role, sessionVersion, emailVerifiedAt
- **OtpToken**: email, otpHash (bcrypt), expiresAt, consumedAt, attempts
- **OtpRequest**: email, ip, requestedAt (for rate limiting)
- **AuditLog**: action, userId, email, ip, metadata, createdAt

### Commands
```bash
npx prisma generate                   # After schema changes
npx prisma migrate dev --name <desc>  # Create + apply migration
npx prisma studio                     # Open GUI for data
```

### pgvector
```sql
-- Enable once per database
CREATE EXTENSION IF NOT EXISTS vector;

-- Prisma treats vector as unsupported, use raw SQL for queries
-- Example: ORDER BY embedding <=> $query_vector
-- Index: CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)
```

## shadcn/ui Usage

### Add Components
```bash
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add card
```

Components are added to `components/ui/` (excluded from tsconfig).

### Critical UI Patterns

**Dialog from Dropdown/ContextMenu**: Must restore pointer events on close

```tsx
<Dialog open={open} onOpenChange={(isOpen) => {
  setOpen(isOpen)
  if (!isOpen) {
    setTimeout(() => {
      document.body.style.pointerEvents = ""
    }, 300)
  }
}}>
```

**SelectItem values**: Never use empty string

```tsx
// ❌ Bad
<SelectItem value="">None</SelectItem>

// ✅ Good
<SelectItem value="none">None</SelectItem>
const value = formData.category === "none" ? null : formData.category
```

**Toast Notifications**: Use Sonner for all toast notifications

```tsx
'use client'

import { toast } from "sonner"

// Success notification
toast.success("Password changed successfully")

// Error notification
toast.error("Failed to save changes")

// Info notification
toast("Settings updated")

// Custom toast
toast("Custom message", {
  description: "Additional details here",
  duration: 5000,
})
```

**Important**: `<Toaster />` is already added to root layout at top-right position. Never add it again.

## Common Patterns

### Protected Route
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

export const runtime = "nodejs"  // Required for DB

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Handle authenticated request
  return Response.json({ ok: true })
}
```

### Form with Validation and Toast Notifications
```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2)
})

export function MyForm() {
  const form = useForm({ resolver: zodResolver(schema) })

  async function onSubmit(data: z.infer<typeof schema>) {
    try {
      const res = await fetch('/api/endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await res.json()

      if (!res.ok) {
        toast.error(result.error || 'Failed to save')
        return
      }

      toast.success('Saved successfully')
    } catch (error) {
      toast.error('Network error. Please try again.')
    }
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>
}
```

## Development Commands

```bash
npm run dev          # Start dev server (Turbopack, :3000)
npm run build        # Production build
npm start            # Serve production build
npm run lint         # Run ESLint

npx shadcn@latest add <component>  # Add UI component
npx prisma studio                   # Open database GUI
```

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
