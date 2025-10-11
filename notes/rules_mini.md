# Next.js Project Rules

**Scope**: This file is for **AI agents/tools** that operate in Codex CLI. Be terse, be correct, obey guardrails.

---

## 1) Technology Stack (constraints)

- **Framework**: Next.js **15.3.4** (App Router) with React **19**, TypeScript **5.x**.
- **Styling/UI**: Tailwind, Shadcn (Radix under the hood). **Only** Lucide for icons.
- **State**: Server Components for server state; client state via local state / Context; TanStack Query only when necessary.
- **Data**: **Local PostgreSQL 15** + Prisma ORM + **pgvector** (no cloud DB).
- **AI**: Provider-agnostic via AI SDK; **default provider: Gemini**. Server-side only.
- **Auth**: JWT in **HTTP-only** cookies (bcrypt + jose).
- **Tooling**: ESLint + Prettier.

**AGENT MUST NOT**: introduce Edge/runtime features for DB calls; add other icon libraries; leak any API keys to the client.

---

## 2) Project Structure (high-level)

- **app/**: App Router segments (auth, protected, api routes).
- **prisma/**: schema, migrations, optional seed.
- **lib/**: `ai/`, `auth/`, `database/`, `validations/`, utilities.
- **components/**: `ui/` (Shadcn only), `features/`, `shared/`, `layout/`, `forms/`.
- **hooks/**, **types/**, **tests/**, **public/**, **styles/**, **middleware.ts**, **next.config.ts**.

Use path aliases like `@/lib`, `@/components`, `@/hooks`.

---

## 3) Code Style & Conventions (compressed)

- Prefer **functional**, declarative TS; avoid classes/enums (use `as const` objects).
- Small, single-purpose functions; early returns; descriptive names (`isLoading`, `hasError`).
- Server Components by default; add `'use client'` **only** for interactivity or browser APIs.
- Keep client components small; pass **serializable** props across the RSC boundary.

**AGENT MUST**: keep all files TypeScript; define explicit return types for exported functions.

---

## 4) Data Management (Local Postgres + Prisma + pgvector)

- Database is **local Postgres 15**. Installation steps are **out of scope**—assume it exists.
- Prisma connects via standard Postgres driver in **Node.js runtime** only.
- Run migrations locally; Prisma may create a **shadow DB** automatically.

**Required env (local)**:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/yourdatabase"
```

**Enable pgvector** (run once per DB):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**pgvector + Prisma notes**

- Prisma treats `vector` as unsupported; use **raw SQL** for vector fields/queries.
- Use cosine distance operator and HNSW index; example operator: `vector_cosine_ops`.
- Suggest an index name pattern like: `Document_embedding_hnsw_cos`.
- Sorting pattern (cosine): `ORDER BY embedding <=> $query_vector`.

**AGENT MUST**:

- Place any DB-bound code in **Node runtime** (see Routing).
- Avoid ORM adapters or Edge-compat shims.
- Keep connection counts low in dev; reuse a single Prisma client.

---

## 5) Routing & Navigation

- App Router with layouts, parallel routes as needed; intercepting routes for modals.
- Use `loading.tsx`, `error.tsx`, and `notFound()` where applicable.
- Prefer `<Link prefetch>` for primary nav; programmatic `router.push` sparingly.

**Runtime guardrail (duplicate on purpose)**
**If a route handler uses the database, it MUST run in Node.js:**

```ts
export const runtime = "nodejs";
```

**AGENT MUST NOT**: set `runtime = "edge"` in any DB-bound route/component.

---

## 6) AI Integration

- Use AI SDK with a provider-agnostic setup; **default** to Gemini models unless overridden.
- Keep prompts, parsing, and schema validation **server-side**.
- For structured outputs, validate with Zod before using.
- Consider a provider registry to allow model swapping without changing call sites.

**AGENT MUST**: never expose keys to the client; never call AI from client components.

---

## 7) Authentication

- JWT stored in **HTTP-only** cookie; recommended name via env (e.g., `JWT_COOKIE_NAME`).
- Use **bcrypt** for hashing; **jose** for signing/verification.
- **Rotation**: implement refresh token rotation; short-lived access token (≈ 1h), longer refresh (≈ 7–30d).
- Cookie flags: `HttpOnly`, `Secure` (in prod), `SameSite=Lax` or `Strict` for same-site apps; set `Path=/`.
- Validate all auth inputs via Zod; rate-limit login and password flows.

**AGENT MUST**: keep auth in server code; never read/write auth cookies in the client directly.

---

## 8) Security Practices

- Validate **all** inputs (Zod), especially in API routes.
- Apply basic rate limiting to write endpoints and auth flows.
- Security headers to set (centralized in middleware):

  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`

- Secrets: never commit `.env*`; use `NEXT_PUBLIC_` only for true public config.

**AGENT MUST NOT**: log secrets; include API keys in client bundles; weaken cookie flags.

---

## 9) Performance

- Use `next/image` with proper sizing, `priority` for above-the-fold only; avoid layout shift.
- Load fonts via `next/font` with `display: swap`.
- Dynamic import heavy client-only components; avoid SSR where browser APIs are required.
- Cache with `force-cache` / `revalidate` only when it improves UX; otherwise `no-store` for highly dynamic server data.

---

## 10) Testing

- **Stack**: Jest + React Testing Library; Playwright for E2E; MSW for API mocking.
- **Rules**: test critical paths, error states, edge cases; keep tests independent, descriptive.
- **DB**: use a separate test database; run migrations before tests; clean between specs.

**AGENT MUST**: avoid hitting prod/external services in tests—mock or stub.

---

## 11) Accessibility (WCAG 2.1 AA essentials)

1. Correct heading hierarchy.
2. Sufficient contrast (≥ 4.5:1 normal text).
3. Fully keyboard navigable.
4. ARIA only where semantics aren’t enough.
5. Clear form labels and error messaging.
6. Manage focus on route changes and modals.

---

## 12) Error Handling

- Use typed error objects and status-aware API responses.
- Log server errors; show user-safe messages.
- For AI calls, map vendor errors to stable internal codes (rate limit, invalid key, safety block, context length) and surface actionable messages to clients.

**AGENT MUST**: avoid leaking stack traces or vendor-specific internals to the client.

---

## 13) Naming & Files

- Directories/files: **kebab-case**; Components: **PascalCase**; functions: **camelCase**; constants: **UPPER_SNAKE_CASE**.
- Keep files short; group feature code under `components/features/{feature}/…`.

---

## 14) Tiny Canonical Snippets (allowed)

1. **Node runtime for DB routes**

```ts
export const runtime = "nodejs";
```

2. **Local DB env**

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/yourdatabase"
```

3. **Enable pgvector (once)**

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

_(Use cosine distance and HNSW: `embedding vector_cosine_ops`; prefer index name like `Document_embedding_hnsw_cos`.)_

---

## 15) Red Lines (quick recap)

- **NO Edge runtime** for anything that touches the database.
- **NO client-side** access to secrets, tokens, or AI calls.
- **NO extra icon libraries** beyond Lucide.
- **NO cloud DB**; assume local Postgres 15 with pgvector enabled.

## Follow these rules verbatim. When in doubt, choose server-side, typed, validated, cached responsibly, and **secure by default**.
