# AI Settings — UX Flow & ASCII Wireframes

This document outlines the flow and screen-by-screen wireframes for the redesigned AI settings with provider tabs and an inline playground modal.

## UX Flow Map

1. Settings: AI Providers (Tabbed)
   - Load providers from `/api/orgs/:orgSlug/ai/keys`
   - For each allowed provider, render a tab with status
   - Select a tab → load models `/api/orgs/:orgSlug/ai/models?provider=<p>`

2. Provider Tab Content
   - API Key Section
     - Verify & Save (POST /ai/keys)
     - Remove API Key (DELETE /ai/keys)
   - Models Section
     - Configured Models (Set Default, Remove)
     - Curated Models (Add)
   - Open Playground Modal
   - View Usage (navigates to usage dashboard, optionally filtered)

3. Playground Modal (per Provider)
   - Inputs (model, system prompt, user prompt, max tokens)
   - Submit → POST `/api/orgs/:orgSlug/ai/generate` (feature="playground")
   - Show loading → Show pretty JSON result or error
   - Copy JSON

4. Usage Dashboard
   - Filterable by feature="playground" and provider
   - Shows logged runs from playground and elsewhere

---

## Screen-by-Screen Wireframes

Legend:

- [ ] Checkbox indicates enable/disable; (disabled) when unavailable
- (…) denotes dynamic content
- -> denotes action or navigation

### 1) AI Settings (Tabbed Providers)

```
┌────────────────────────────────────────────────────────────────────┐
│ AI Settings                                                        │
├────────────────────────────────────────────────────────────────────┤
│ Tabs:  [ OpenAI (Verified) ]  [ Google Gemini (Missing) ] [ Anthropic (Verified) ]
│        ^ active tab stored in localStorage                         │
├────────────────────────────────────────────────────────────────────┤
│ (Active Tab Content — see next wireframe)                          │
└────────────────────────────────────────────────────────────────────┘
```

Notes:

- Tab labels show provider display name and status badge.
- Active tab persists by org.

### 2) Provider Tab Content

```
┌──────────────── Provider: OpenAI (Verified) ───────────────────────┐
│ ****1234 (verified)   Last verified: 2025-10-19 14:23              │
│                                                                  │
│ API Key                                                          │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ [•••••••••••••••••••••••••••••••••••••••••••••••••••     ]   │ │
│ │                (placeholder: ****1234 (verified))        │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ [Verify & Save]   [Remove API Key]                                │
│                                                                  │
│ Configured Models                                                 │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ • GPT-4o Mini                Max: 16384  [Default]           │ │
│ │   [Set Default](disabled)   [Remove]                         │ │
│ │                                                              │ │
│ │ • GPT-4o                    Max: 16384  [ ]                  │ │
│ │   [Set Default]            [Remove]                          │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Curated Models (Available)                                       │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ • GPT-5 Mini — Fast, cost-effective. Max 16384               │ │
│ │   [Add]                                                      │ │
│ │ • GPT-5 — Most capable. Max 16384                            │ │
│ │   [Add]                                                      │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ [Open Playground] (enabled when key verified & ≥1 model)          │
│ [View usage] -> opens usage dashboard (feature=playground,provider=openai)
└──────────────────────────────────────────────────────────────────┘
```

Empty/Missing states:

- If status=Missing → show helper: “Add an API key to enable models and playground.”
- If no configured models → show helper: “Add a model to enable playground.”

### 3) Playground Modal (Two Columns)

```
┌────────────────────────── Playground: OpenAI ──────────────────────┐
│                                                                    │
│ Left (Inputs)                               Right (Result)         │
│ ┌─────────────────────────────┐            ┌─────────────────────┐ │
│ │ Model: [ GPT-4o Mini  v ]  │            │  Loading… (spinner) │ │
│ └─────────────────────────────┘            └─────────────────────┘ │
│                                                                    │
│ System Prompt                                                     │
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │ [ optional text area…                                       ] │ │
│ └───────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ User Prompt (required)                                            │
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │ [ required text area…                                        ] │ │
│ └───────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ Max Output Tokens: [ 16384 ] (min=1, max=curated max)             │
│                                                                    │
│ [Submit]  [Cancel]                                                 │
│                                                                    │
│                                             ┌────────────────────┐ │
│                                             │ {                  │ │
│                                             │   "text": "…",    │ │
│                                             │   "correlationId": │ │
│                                             │   "…",            │ │
│                                             │   "tokensIn": 123,│ │
│                                             │   "tokensOut": 456,│ │
│                                             │   "latencyMs": 789 │ │
│                                             │ }                  │ │
│                                             └────────────────────┘ │
│                                             [Copy JSON]            │
└────────────────────────────────────────────────────────────────────┘
```

Notes:

- Submit sends POST to `/api/orgs/:orgSlug/ai/generate` with feature="playground".
- While waiting, show loading state on the right and disable Submit.
- Pretty-print JSON and show correlationId clearly; copy supports full JSON.

### 4) Usage Dashboard (Filtered)

```
┌────────────────────────── AI Usage Dashboard ──────────────────────┐
│ Filters: Provider=[OpenAI]  Feature=[playground]  Status=[All]     │
│ [Clear Filters]                                                    │
├────────────────────────────────────────────────────────────────────┤
│ Totals: Requests | Tokens In | Tokens Out | Avg Latency            │
├────────────────────────────────────────────────────────────────────┤
│ Logs (click row to view details)                                   │
│ [ corrId  | time | provider | model | feature | status | latency ] │
└────────────────────────────────────────────────────────────────────┘
```

---

## Interaction & States

- Disabled states
  - Playground button: disabled if key missing or no configured model
  - Set Default: disabled if already default
- Busy indicators
  - Verify & Save, Add/Remove model, Set Default, Generate
- Toasters
  - Success/error on key ops and model ops; copy success; network errors
