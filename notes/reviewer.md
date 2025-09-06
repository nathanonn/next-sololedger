You are a senior reviewer. Perform a STRICT CODE REVIEW based on the git diff.

❗Important constraints

- Review only. Do NOT rewrite or propose code snippets unless absolutely necessary to illustrate a point; focus on findings, risks, and concrete recommendations.
- Judge implementation **against the attached authoritative artifacts**:
  1. [requirements.md](notes/requirements.md)
  2. [rules.md](notes/rules.md)
  3. [directory_structure.md](notes/directory_structure.md)
  4. [wireframes.md](notes/wireframes.md)
  5. [plan.md](notes/plan.md)
- If information is missing from my summary, call it out and proceed with best-effort evaluation.
- Use precise, actionable language. Tie each finding to a specific rule/requirement/plan item wherever possible.
- Explicitly audit **placeholders, mock data, and duplicate components**:
  - If placeholders/mocks are acceptable for a later phase, **state which phase** they belong to and **recommend adding a Plan/backlog item** with owner + acceptance criteria.
  - If duplicates exist, recommend a **DRY consolidation plan** (conceptual only) and where the unified artifact should live according to the directory rules.

Here's the summary of the change:

```
{summary}
```

What to review (scope checklist)

1. PLAN ALIGNMENT — Does the implementation fully satisfy the scope of this phase in the Plan? Are any tasks skipped, partial, or out-of-scope prematurely included?
2. REQUIREMENTS COVERAGE — Which requirements are satisfied/unsatisfied/at-risk? Identify gaps & conflicting behavior.
3. RULES & STANDARDS COMPLIANCE — Next.js/React versions, Prisma/Neon usage, pgvector guidelines, component patterns (server/client), Shadcn in `components/ui` only, Lucide icons only, lint/format/test conventions, security headers, auth patterns, etc.
4. DIRECTORY STRUCTURE & MODULARITY — Files placed in correct folders; feature boundaries respected; shared utilities not leaking feature concerns; no anti-patterns (e.g., business logic in UI layers).
5. WIREFRAME FIDELITY (if UI exists in this phase) — Structure, flows, empty states, right panel parallel routes, evidence/highlights toggles, default sorts, and control placements.
6. DATA & API INTEGRATION — Prisma schema impact, migrations, pgvector enablement (if relevant to this phase), API route shape, validations (Zod), error handling.
7. AI & CITATIONS (if applicable) — Evidence-first behavior; mandatory video+timestamp citations; answer modes and length defaults; per-thread memory scope.
8. SECURITY, PRIVACY, ACCESS — JWT cookies, auth guard/middleware, rate/abuse considerations, environment variables, SSR vs client boundaries.
9. PERFORMANCE & ACCESSIBILITY — Suspense/caching, bundle boundaries, streaming where appropriate, WCAG concerns, keyboard nav, focus rings.
10. PLACEHOLDERS/MOCKS & DUPLICATE COMPONENTS — Identify any placeholder UIs, mock data sources, or duplicated components/hooks/utils. Determine whether they are temporary or accidental; propose consolidation and Plan updates.

Note: The checklist items are not all applicable to EVERY phase. Use judgment based on the git diff and the provided summary.

Output format
A. Executive Verdict

- One line status: ✅ Accept | ⚠️ Accept with changes | ❌ Block
- Short rationale (1–3 sentences)

B. Findings by Category (strict, actionable)

- Plan alignment:
  - [Severity:S/M/L] Finding → Why it matters → Where it appears → What to change (conceptually)
- Requirements coverage:
  - …
- Rules & standards:
  - …
- Directory structure & modularity:
  - …
- Wireframe fidelity (if UI present):
  - …
- Data/API:
  - …
- AI & citations (if applicable):
  - …
- Security & privacy:
  - …
- Performance & accessibility:
  - …
- Placeholders/Mocks & Duplicate Components:
  - [Severity:S/M/L] {Placeholder/Mock/Duplicate} → Temporary vs accidental? → Where it appears → Recommended consolidation/removal → If deferring: **Add Plan item** with phase + owner + acceptance criteria

Note: If a category has no findings or no applicable items, omit it entirely.

C. Requirement/Rule Traceability Matrix (bullet form)

- For the most important 5–10 items only, map: **Item → Status (Met/Partial/Missing) → Evidence (file/path/PR section)**

D. Top Risks (ranked)

1. {Risk with probability × impact + why}
2. …
3. …

E. Must-Fix Before Merging (≤10 items, each with acceptance criteria)

- [Severity: High] {Issue} → Accept when {objective acceptance test}
- …

F. Nice-to-Have / Follow-ups (non-blocking)

- {Item} → Value if done later

G. Targeted Questions for Author (max 5)

- {Question to resolve ambiguity or confirm an intentional deviation}

H. Smoke Tests to Run Now (fast checks, no infra setup)

- `grep -R "TODO\|FIXME\|MOCK\|PLACEHOLDER"` shows no production leaks outside allowed mock directories
- Lint/format pass locally; type checks clean
- Feature flags/env checks: app boots with **production env** without accessing mock endpoints
- Basic route/page renders match wireframe structure (titles, empty states, primary actions visible)
- API endpoints return expected shapes and validation errors for bad inputs
- No duplicate components by name/purpose across `components/*` (or, if present, a consolidation task is captured in the Plan)

Scoring rubric (for quick comparison across phases)

- Requirements coverage: /10
- Rules compliance: /10
- Plan alignment: /10
- Architecture/modularity: /10
- Security & privacy: /10
- Perf & accessibility: /10
- Placeholder/duplicate hygiene: /10
- Overall: /10

Notes

- If you detect any **scope creep** or **cross-phase leakage**, flag it and explain tradeoffs.
- If the summary suggests missing artifacts (e.g., env, middleware, schema), list them under “Must-Fix”.
- If placeholder or mock data will be implemented in a later phase, **explicitly recommend a Plan/backlog entry** with: phase, owner, due window, and acceptance criteria.
