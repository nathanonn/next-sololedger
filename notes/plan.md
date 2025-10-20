# AI Settings Redesign + Playground — Implementation Plan

This plan refactors the AI settings from a table-based list into a provider-centric tabbed experience with per-provider management and an inline playground. Admins can verify API keys, manage curated models, and test models without leaving the settings page. The playground uses the existing server API for generation and automatically logs usage under the organization with feature="playground".

## Scope

- Replace `components/features/ai/ai-keys-management.tsx` UI with Tabs per allowed provider (from env.AI_ALLOWED_PROVIDERS).
- Within each tab, provide:
  - API Key management (verify/save, remove, show last four + last verified)
  - Models management (configured models list, set default, remove; curated models list to add)
  - A “Playground” modal to test with configured models
- Ensure all playground requests log to `AiGenerationLog` with feature="playground" (leveraging existing backend).
- Add a “View usage” link from each provider tab to the AI usage dashboard.

## Decisions (per user selections)

1. Providers source: env-driven allowed providers (1/a)
2. Playground model choices: configured models only (2/a)
3. System prompt handling: concatenate system + user into single prompt (no backend change) (3/b)
4. Response mode: non-streaming with explicit loading state (4/a)
5. Max output default: curated model maximum (5/a)
6. Component structure: split into subcomponents (6/b)
7. Logging feature tag: "playground" (7/a)
8. Temperature control: omit for now (8/b)
9. Empty states and helper text: explicit guidance + disabled actions (9/a)
10. View usage: add link/button in each tab (10/a)

## Files to Create/Update

- Update: `components/features/ai/ai-keys-management.tsx`
  - Replace table UI with Tabs per provider
  - Render per-provider tab content using a new subcomponent
  - Persist selected tab in localStorage (`app.v1.ai.providerTab:{orgSlug}`)
- Add: `components/features/ai/AiProviderTab.tsx`
  - Renders API Key section, Models section, Playground trigger, and View Usage link
  - Handles provider-scoped model fetching and CRUD
  - Props:
    - orgSlug: string
    - provider: { provider, displayName, status, lastFour, lastVerifiedAt, defaultModel }
    - onProvidersChanged?: () => void (to refresh parent list after key/model ops)
- Add: `components/features/ai/AiPlaygroundModal.tsx`
  - Two-column modal: inputs (left) and JSON response (right)
  - Props:
    - orgSlug: string
    - provider: string
    - curatedModels: CuratedModel[] (for per-model max tokens)
    - configuredModels: { id, name, label, maxOutputTokens, isDefault, provider }[]
    - open: boolean
    - onOpenChange: (open: boolean) => void
  - Internal state: selectedModelName, systemPrompt, userPrompt, maxOutputTokens, loading, resultJson, errorJson

## Data Sources and Endpoints (existing)

- Providers: `GET /api/orgs/[orgSlug]/ai/keys`
- Save key: `POST /api/orgs/[orgSlug]/ai/keys` (provider, apiKey)
- Delete key: `DELETE /api/orgs/[orgSlug]/ai/keys` (provider)
- Models (per provider): `GET /api/orgs/[orgSlug]/ai/models?provider=<provider>` → { curatedModels, configured }
- Add model: `POST /api/orgs/[orgSlug]/ai/models` (provider, modelName, setAsDefault)
- Remove model: `DELETE /api/orgs/[orgSlug]/ai/models` (modelId)
- Set default: `PATCH /api/orgs/[orgSlug]/ai/models/[modelId]/default`
- Generate (playground): `POST /api/orgs/[orgSlug]/ai/generate`
  - Body: { feature: "playground", provider, modelName, prompt, maxOutputTokens }
  - Returns: { text, correlationId, tokensIn?, tokensOut?, latencyMs }
  - Headers: X-Correlation-ID also returned

## UI Details

- Tabs
  - Labels: provider display name + small status badge (Verified/Missing)
  - Active tab remembered per org

- API Key section (inside tab)
  - Input (password) + Verify & Save button
  - Placeholder when verified: \*\*\*\*lastFour (verified)
  - Last verified timestamp (small text)
  - Destructive Remove API key button

- Models section (inside tab)
  - Configured models list (card/list)
    - Show label, maxOutputTokens
    - Default badge or "Set Default" button
    - Remove button (disable if only model and default per provider)
  - Curated models (filtered not-added)
    - Show label, description, and max tokens
    - Add button (first add becomes default)

- Playground trigger
  - Button "Open Playground"
  - Disabled when provider key missing or no configured models

- Playground modal
  - Left inputs:
    - Model: Select from configured models for the provider (default = provider default or first)
    - System prompt: Textarea (optional)
    - User prompt: Textarea (required)
    - Max output tokens: Number; default to curated model’s max; min=1, max=curated max
    - Submit (primary) + Cancel
  - Right results:
    - While loading: spinner + placeholder
    - On success: pretty JSON, shows correlationId and latency
    - On error: pretty JSON/error block
    - Copy button to copy full JSON

- View usage link
  - Navigates to the org’s usage page, optionally with `?feature=playground&provider=<provider>`

## State and Data Flow

- Parent component (`ai-keys-management`)
  - Fetch providers on mount and after key/model mutations
  - Render tabs and pass selected provider into `AiProviderTab`
  - Store selected tab in localStorage

- `AiProviderTab`
  - Fetch models for provider on mount and when needed
  - Use curatedModels to determine per-model max tokens (pass to playground modal)
  - Handle key verify/delete, add/remove model, set default
  - Notify parent to refresh providers when default model changes or key changes

- `AiPlaygroundModal`
  - Build prompt by concatenating system + user
  - POST to generate endpoint with feature="playground"
  - Render JSON result and allow copy

## Validation, Errors, and Loading

- Client-side checks: require user prompt, ensure model selected
- Disable action buttons while busy
- Show toasts on success/failure; show inline errors in JSON pane for generate
- Respect CSRF and auth (handled by existing routes)

## Security and Guardrails

- All AI calls remain server-side (Node runtime routes)
- Never expose API keys to client; only show last four
- Respect env.AI_ALLOWED_PROVIDERS when rendering tabs
- Token clamping enforced server-side; UI also constrains inputs

## QA / Acceptance Criteria

- Tabs render from allowed providers; statuses and last four visible
- API key verify/delete work and refresh state
- Models add/remove/default operations work; curated list filters correctly
- Playground disabled until a key and at least one model exist
- Playground shows loading, then pretty JSON with correlationId and latency
- Logs record each playground run with feature="playground"
- “View usage” link opens the usage view filtered by feature=playground

## Optional Enhancements (post-MVP)

- Persist playground form inputs per provider (localStorage)
- Add temperature slider (0–2)
- Support streaming preview in playground
- Bulk add curated models for a provider
