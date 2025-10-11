# Repository Guidelines

Next.js 15.3.4 (App Router) + React 19 + TypeScript 5 + Tailwind v4 + Prisma/Postgres 15. Keep it typed, server‑first, and secure.

## Stack & Guardrails
- Styling: Tailwind + Shadcn (Radix). Icons: Lucide only.
- Data: Local Postgres 15 + Prisma; enable pgvector.
- AI: AI SDK (provider‑agnostic), default Gemini; server‑side only. Docs: https://ai-sdk.dev/docs
- Auth: JWT in HTTP‑only cookie (bcrypt + jose).
- MUST NOT: use Edge for DB work, expose secrets/AI calls to client, add other icon libs, or use cloud DBs.

## Project Structure & Module Organization
- `app/` – routes/layouts and `app/api/*`; `middleware.ts` sets cross‑cutting behavior.
- `components/` – `ui/` (shadcn), `features/`, `providers/`, `common/`.
- `lib/` – `env.ts`, `db.ts`, auth, validators, rate‑limit, utils.
- `prisma/` – `schema.prisma`, migrations; `public/` – static assets.
- Optional: `hooks/`, `types/`, `tests/`. Use aliases: `@/lib`, `@/components`, `@/hooks`.

## Build, Test, and Development Commands
- `npm run dev` – start dev server (Turbopack) on `:3000`.
- `npm run build` / `npm start` – build and serve.
- `npm run lint` – ESLint (`next/core-web-vitals`, TS rules). Format with Prettier if configured.
- Prisma: `npx prisma generate`; `npx prisma migrate dev --name <desc>`.

## Coding Style & Naming Conventions
- TS strict; 2‑space indent; functional/declarative; avoid classes/enums; explicit return types for exported fns.
- Naming: kebab‑case files/dirs, PascalCase components, camelCase functions, UPPER_SNAKE_CASE constants.
- Server Components by default; add `'use client'` only for interactivity. Pass serializable props; never import server‑only modules into client components.

## Data & pgvector
- DB handlers must run in Node: `export const runtime = "nodejs"`.
- Env: `DATABASE_URL=postgresql://user:password@localhost:5432/db`. Enable once: `CREATE EXTENSION IF NOT EXISTS vector;`.
- Prisma treats `vector` as unsupported—use raw SQL for vector fields/queries; prefer HNSW + cosine (`ORDER BY embedding <=> $query_vector`). Reuse a single Prisma client.

## AI & Auth
- Keep prompts/calls server‑side; validate structured outputs with Zod. Never expose keys to the client.
- Cookies: `HttpOnly`; `Secure` in prod; `SameSite=Lax/Strict`. Rotate refresh tokens; rate‑limit auth flows.

## Testing Guidelines
- Not configured yet. If adding tests, use Jest + React Testing Library; Playwright for E2E; MSW for API mocking. Use a separate test DB and migrate/reset per run.

## Commit & Pull Request Guidelines
- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `perf:`, `build:` (≤72 chars).
- PRs: description, linked issues, UI screenshots/GIFs, migration notes, any env changes (update `.env.example`), and “How to verify”.

## UI Component Rules
- **Dialog from Dropdown/ContextMenu**: MUST clean up `pointer-events: none` on close or screen becomes non-interactive. In `onOpenChange`: when `!open`, use `setTimeout(() => document.body.style.pointerEvents = "", 300)`.
- **SelectItem values**: Never use `""`. Use `"root"`, `"none"`, etc., and convert to `null` in submission logic.

## Red Lines
- No Edge runtime for anything touching the DB.
- No client‑side secrets or AI calls.
- No icon sets beyond Lucide.
- No cloud databases.
