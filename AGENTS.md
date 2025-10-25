# Repository Guidelines

Concise, must-know guardrails and references for this repository.

## Stack & Guardrails

- Styling: Tailwind + shadcn/ui (Radix). Icons: Lucide only.
- Database: Local PostgreSQL + Prisma ORM. pgvector enabled for embeddings.
- Auth: Email OTP (Resend) + JWT sessions (access + refresh cookies). bcrypt + jose.
- AI: Vercel AI SDK (server-side only). Docs: https://ai-sdk.dev/docs
- Forms: React Hook Form + Zod validation.
- Toasts: Sonner (top-right position).

### Red Lines (Never Do)

- ❌ Use Edge runtime for database operations
- ❌ Expose secrets or AI calls to client
- ❌ Add icon libraries other than Lucide
- ❌ Use cloud databases (local PostgreSQL only)

## Project Structure (minimal)

```
app/
  (public)/login/                # Email OTP + dev password signin
  api/
    auth/                        # request-otp, verify-otp, dev-signin, signout, refresh, profile
    orgs/                        # orgs, members, invitations, AI
  admin/                         # admin area
  invite/                        # invite landing
  onboarding/create-organization/
  o/[orgSlug]/                   # tenant routes
  globals.css

components/
  ui/                            # shadcn components (excluded from tsconfig)
  features/                      # dashboard, org, admin, ai features

lib/                             # env, jwt (node/edge), csrf, rate-limit, email, validators,
                                 # auth, auth-helpers, org-helpers, invitation-helpers, utils,
                                 # ai/{config,providers,rate-limit}

prisma/                          # schema.prisma + migrations

middleware.ts                    # Edge auth guard (JWT signature only)
```

## Authentication (essentials)

- Primary Email OTP: request via `/api/auth/request-otp`, verify via `/api/auth/verify-otp`.
- Dev password signin: development-only toggle; returns 404 in production.
- Cookies: `__access` (short-lived) and `__session` (long-lived, rotates via `/api/auth/refresh`).
- Edge middleware checks access token signature only; full checks happen server-side.
- Session versioning invalidates old sessions on password change.

## Dashboard Shell (key points)

- Two-level navigation (Sections → Pages).
- Sidebar resizable and collapsible; mobile drawer via Sheet.
- Per-user persistence in localStorage.
- Built with `react-resizable-panels`.

## Coding Style & Conventions

- Server-first: default Server Components; add `'use client'` only for hooks, events, browser APIs.
- API routes: `export const runtime = "nodejs"` for DB access.
- TypeScript strict: explicit return types; avoid `any` (use `unknown` + guards); no `enum`; prefer functional patterns.
- Naming: files `kebab-case`; components `PascalCase`; functions `camelCase`; constants `UPPER_SNAKE_CASE`.

## Database & Prisma

- Prisma models include: User, OtpToken, OtpRequest, AuditLog, and multi-tenant org-related models.
- pgvector: enable once per DB; Prisma treats `vector` as unsupported — use raw SQL where needed.

## Environment (must-have only)

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/db
JWT_SECRET=<32+ chars>
JWT_ACCESS_COOKIE_NAME=__access
JWT_REFRESH_COOKIE_NAME=__session
ALLOWED_EMAILS=user@example.com,admin@example.com
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com
APP_URL=http://localhost:3000
```

See `.env.example` for all variables and defaults.

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

### Toast Notifications

```tsx
"use client";

import { toast } from "sonner";

// Success notification
toast.success("Password changed successfully");

// Error notification
toast.error("Failed to save changes");

// Info notification
toast("Settings updated");

// Custom toast
toast("Custom message", {
  description: "Additional details here",
  duration: 5000,
});
```

**Important**: `<Toaster />` is already added to root layout at top-right position. Never add it again.

## Dev Commands (minimal)

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## AI (quick note)

- Server-side only. Never expose keys or calls to client.
- Allowed providers configurable; see notes.

## References

- README.md — Setup and customization
- .env.example — All environment variables
- notes/skills/authentication.md — Auth implementation
- notes/skills/dashboard_shell.md — Dashboard shell
- notes/wireframes.md — Flows & diagrams
