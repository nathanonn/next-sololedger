# AI Playground + AI Usage Dashboard — Wireframes

This document provides a UX flow map and ASCII wireframes for the changes described in `notes/plan.md`.

## Flow map (high level)

	+------------------------------+                     +----------------------------+
	| Dashboard: AI Usage Logs    | -- select row -->   | Log Details (Sheet)       |
	| - Filters, Table, Paging    |                     | - Tabs: Pretty | Raw       |
	+------------------------------+                     | - Metadata, Error (if any) |
																											| - Input/Output w/ Copy     |
																											| - Raw Request/Response     |
																											+----------------------------+

	+------------------------------+
	| Playground (opens modal)    |
	| - Model, Prompts, Tokens    |
	| - Submit → Generating…      |
	| - While generating:         |
	|   * No close via ESC/overlay|
	|   * Close icon hidden       |
	|   * Cancel disabled         |
	+------------------------------+

## Screens / States

### 1) AI Playground Modal (idle)

┌──────────────────────────────────────────────────────────────────────────────┐
│ Dialog: Playground: {provider}                                               │
│ description: Test AI models with custom prompts.                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ LEFT (Inputs)                                         │ RIGHT (Response)     │
│ ─ Model [Select ▼]                                    │ ┌───────────────────┐ │
│ ─ System Prompt [Textarea]                            │ │ Response          │ │
│ ─ User Prompt [Textarea]*                             │ │ (empty state)     │ │
│ ─ Max Output Tokens [Number]                          │ └───────────────────┘ │
│                                                        │                      │
│ [Submit] [Cancel]                                      │                      │
└──────────────────────────────────────────────────────────────────────────────┘

Notes:
- Close icon visible; overlay/ESC close allowed in idle state.

### 2) AI Playground Modal (generating)

┌──────────────────────────────────────────────────────────────────────────────┐
│ Dialog: Playground: {provider}                                               │
│ description: Test AI models with custom prompts.                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ LEFT (Inputs)                                         │ RIGHT (Response)     │
│ ─ Model [Select ▼] (disabled)                          │ ┌───────────────────┐ │
│ ─ System Prompt [Textarea] (disabled)                  │ │ [spinner]         │ │
│ ─ User Prompt [Textarea]* (disabled)                   │ │ Generating…       │ │
│ ─ Max Output Tokens [Number] (disabled)                │ └───────────────────┘ │
│                                                        │                      │
│ [ Generating… (spinner) ] [Cancel (disabled)]          │                      │
└──────────────────────────────────────────────────────────────────────────────┘

Notes:
- Close icon hidden; overlay/ESC attempts do nothing.
- If user attempts to close, show a brief info toast: “Generation in progress — please wait.”
- Parent-driven close (e.g., route change) still closes.

### 3) AI Usage Dashboard (Logs table)

┌──────────────────────────────────────────────────────────────────────────────┐
│ Filters: Provider | Feature | Status | Search [      ] [Search]  [Clear]     │
├──────────────────────────────────────────────────────────────────────────────┤
│ Table: Correlation | Time | Provider | Model | Feature | Status | Latency     │
│  row… (clickable)                                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ Pagination:  Page X of Y   [Prev] [Next]                                      │
└──────────────────────────────────────────────────────────────────────────────┘

### 4) Log Details Sheet (Tabs: Pretty | Raw)

┌───────────────────────────────────────────────────── Sheet ──────────────────┐
│ Title: Log Details                                                  [Close]   │
│ Sub: Correlation ID: abcdef12…                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ Tabs: [ Pretty ]  Raw                                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ Pretty tab                                                                    │
│ ─ Metadata (two-column key/value)                                             │
│ ─ Error Information (if status === error)                                     │
│ ─ Input (sanitized & truncated)                         [Copy]                │
│     ┌───────────────────────────────────────────────┐                         │
│     │ <pre>…log.rawInputTruncated…</pre>            │                         │
│     └───────────────────────────────────────────────┘                         │
│ ─ Output (sanitized & truncated)                        [Copy]                │
│     ┌───────────────────────────────────────────────┐                         │
│     │ <pre>…log.rawOutputTruncated…</pre>           │                         │
│     └───────────────────────────────────────────────┘                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ Raw tab                                                                       │
│ Tabs:  Pretty  [ Raw ]                                                        │
│ ─ Raw Request                                     [Copy JSON]                 │
│   helper: Reconstructed from stored logs; sanitized and may be truncated.     │
│     ┌───────────────────────────────────────────────┐                         │
│     │ {                                            │                         │
│     │   provider, model, feature, prompt,          │                         │
│     │   options: { maxOutputTokens: null,          │                         │
│     │              temperature: null, stream: false },│                      │
│     │   correlationId, note                        │                         │
│     │ }                                            │                         │
│     └───────────────────────────────────────────────┘                         │
│ ─ Raw Response                                    [Copy JSON]                 │
│   helper: Reconstructed from stored logs; sanitized and may be truncated.     │
│     ┌───────────────────────────────────────────────┐                         │
│     │ {                                            │                         │
│     │   status, text, usage: { in, out },          │                         │
│     │   latencyMs, error?, correlationId, note     │                         │
│     │ }                                            │                         │
│     └───────────────────────────────────────────────┘                         │
└──────────────────────────────────────────────────────────────────────────────┘

## Notes & interactions
- Copy buttons always enabled; if content is empty, we still copy an empty string and show a success/neutral toast.
- JSON shown in the Raw tab is reconstructed from truncated/sanitized fields. Some fields are intentionally null/omitted to avoid implying exact provider payload parity.
- Metadata and Error sections are unchanged from current behavior on the Pretty tab.

