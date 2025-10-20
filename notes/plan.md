# AI Playground Lock + AI Usage Dashboard Enhancements — Implementation Plan

This plan makes the AI Playground modal non-closable while a generation is running and enhances the AI Usage Dashboard’s Log Details with copy actions and a clear Pretty/Raw split. We’ll block user-initiated closes (overlay, ESC, close icon) during generation but still allow parent-driven closes, add Copy buttons for sanitized input/output, and introduce Tabs with a reconstructed provider-agnostic Raw request/response JSON view (sanitized/truncated). No server/database changes are required.

## Scope

- Lock `AiPlaygroundModal` during generation (user-initiated closing disabled; parent can still close).
- Add Copy buttons to sanitized Input and Output in Log Details.
- Replace single view in Log Details with Tabs: Pretty (default) and Raw.
- Raw tab shows reconstructed request/response JSON (sanitized/truncated) with Copy JSON buttons.
- No changes to API routes, database schema, or environment variables.

## Files to edit

- `components/features/ai/AiPlaygroundModal.tsx`
- `components/features/ai/ai-usage-dashboard.tsx`

## Implementation details

### A) AiPlaygroundModal: make non-closable while generating

Context: `AiPlaygroundModal` uses `Dialog`, `DialogContent` (from `components/ui/dialog.tsx`) and tracks `loading`.

1. Prevent user-initiated close while `loading === true`:
   - On `DialogContent` add handlers:
     - `onInteractOutside={(e) => loading && (e.preventDefault(), toast.info("Generation in progress — please wait"))}`
     - `onEscapeKeyDown={(e) => loading && (e.preventDefault(), toast.info("Generation in progress — please wait"))}`
   - Pass `showCloseButton={!loading}` to `DialogContent` so the “X” is hidden while generating.

2. Keep Cancel button disabled while loading (already in place):
   - Continue using `disabled={loading}` on the Cancel button.

3. Respect parent-driven closes (choice 2/b):
   - Keep `Dialog` controlled by `open` and `onOpenChange` as-is, but wrap/guard locally so user-initiated close attempts are blocked by the handlers above. If the parent intentionally calls `onOpenChange(false)` (e.g., route change), allow it to close.

4. Optional UX feedback (choice 1/b):
   - Show a small info toast when a close attempt is blocked during generation to reduce user confusion.

Notes:

- No changes required in `components/ui/dialog.tsx` because it already forwards event handlers and supports `showCloseButton`.

Acceptance:

- During generation: overlay click, ESC do nothing; close icon hidden; Cancel disabled.
- After generation completes: dialog is closable normally.

### B) AI Usage Dashboard: Copy actions + Pretty/Raw tabs

Context: `ai-usage-dashboard.tsx` renders the Log Details in a `Sheet` with Metadata, Error info, and sanitized Input/Output.

1. Add Copy buttons for sanitized Input and Output (choice 3/a):
   - In the Input section header, add a small ghost button with Copy icon that copies `selectedLog.rawInputTruncated || ""` to clipboard and shows a toast.
   - In the Output section header, add a similar Copy button copying `selectedLog.rawOutputTruncated || ""`.
   - Always enabled, even if content is empty; show a success/neutral toast for predictability.

2. Introduce Tabs: Pretty (default) and Raw (choice 4/c):
   - Use `components/ui/tabs.tsx` to add Tabs within the Sheet content.
   - Pretty Tab: existing layout — Metadata, Error (if any), Input (with Copy), Output (with Copy).
   - Raw Tab: two blocks — “Raw Request” and “Raw Response” — each with a Copy JSON button.

3. Reconstructed provider-agnostic JSON schema (choice 5/b):
   - Raw Request (sanitized/truncated):
     {
     provider: log.provider,
     model: log.model,
     feature: log.feature,
     prompt: log.rawInputTruncated,
     options: {
     maxOutputTokens: null,
     temperature: null,
     stream: false
     },
     correlationId: log.correlationId,
     note: "sanitized; may be truncated"
     }
   - Raw Response:
     {
     status: log.status,
     text: log.rawOutputTruncated,
     usage: { inputTokens: log.tokensIn, outputTokens: log.tokensOut },
     latencyMs: log.latencyMs,
     ...(log.errorCode || log.errorMessage ? { error: { code: log.errorCode, message: log.errorMessage } } : {}),
     correlationId: log.correlationId,
     note: "sanitized; may be truncated"
     }

4. Labels and placement (choices 6/a and 7/a):
   - Section headings: “Raw Request” / “Raw Response”.
   - Helper text under headings: “Reconstructed from stored logs; sanitized and may be truncated.”
   - Copy buttons live in the title bar of each section for consistent placement.

Acceptance:

- Pretty tab shows current (sanitized) Input/Output with Copy actions; Raw tab shows reconstructed JSON with Copy JSON actions.
- Copy actions work reliably with toasts; empty content copies as empty string but still shows success.

## Edge cases

- Empty input/output: copy actions still enabled and copy empty string.
- Very long text: UI keeps code blocks scrollable; copy still works.
- Error logs: Raw Response includes `error` object only when present; Pretty tab shows Error section as today.
- Clipboard permission: if denied, show error toast; failure does not crash UI.
- iOS/older browsers: rely on `navigator.clipboard`; if unavailable, optionally fall back to a transient `<textarea>` and `document.execCommand("copy")` (only if needed; likely not required for supported browsers).

## Testing / QA steps

Manual tests:

1. Playground
   - Start generation. Press ESC and click overlay → dialog remains.
   - Confirm close icon hidden and Cancel disabled.
   - On block, an info toast appears.
   - After generation completes, dialog closes normally.
2. Usage Dashboard
   - Open Log Details. In Pretty tab, copy Input and Output; verify clipboard and toasts.
   - Switch to Raw tab; copy Raw Request/Response JSON; verify JSON validity and content.
   - Verify error logs include error object in Raw Response and Error section in Pretty.
   - Try with empty output; copying still works.

## Risks and mitigations

- Clipboard API quirks → show error toast on failure; consider optional fallback if needed.
- Misinterpretation of Raw JSON → add helper text making clear it’s reconstructed and sanitized/truncated.

## Out of scope

- Persisting raw request/response in DB.
- Adding new filters/endpoints.
- Provider-specific raw shapes.
