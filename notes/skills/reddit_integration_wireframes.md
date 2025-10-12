# Reddit Integration UX Flow and Wireframes

Portable UX flow and ASCII wireframes for integrating Reddit OAuth and fetching subreddit content in any Next.js App Router app. Aligns with `reddit_integration.md`.

## Flow map

- Entry: Settings → Integrations → Reddit

  - Authenticate user (JWT) → check connection status
  - Actions: Connect (OAuth), Test (/me), Disconnect
  - Optional: Load Subscriptions (list user’s subs)

- Entry: Subreddits (content)
  - Validate subreddit by name → show info (title, members, nsfw, type)
  - Fetch posts with filters (sort/time range/count, NSFW toggle)
  - Inspect errors/rate limit messages

Security & guardrails

- All mutations require CSRF + Origin/Referer checks
- Ownership enforced on read/mutate endpoints
- Rate limiting and backoff surfaced in UI messages

## Screen 1: Settings / Integrations / Reddit

Goal: Manage Reddit OAuth connection, test, and disconnect.

+-----------------------------------------------------------------------------------+
| Settings / Integrations | Reddit |
+-----------------------------------------------------------------------------------+
| Status: [ Connected ✓ ] / [ Not connected ] |
|-----------------------------------------------------------------------------------|
| [ Connect to Reddit ] [ Test connection ] [ Disconnect ] |
|-----------------------------------------------------------------------------------|
| Details (when connected) |
| User: u/username Connected: 2025-10-12 Scope: identity read |
|-----------------------------------------------------------------------------------|
| Notes: |
| - Connect opens Reddit OAuth with least-privilege scopes (identity read). |
| - Test calls /api/reddit/me and shows karma/user info. |
| - Disconnect revokes the refresh token and clears stored credentials. |
+-----------------------------------------------------------------------------------+

States

- Not connected → Show Connect primary button; Test/Disconnect disabled
- Connected → Show user info, last tested timestamp; actions enabled
- Error → Show alert with structured error (auth required, rate limited, etc.)

## Screen 1a: Connect to Reddit (OAuth)

+-------------------------------------------+
| Redirecting to Reddit… |
| |
| You’ll be asked to authorize read access. |
| Scope: identity read |
| |
| [Cancel] |
+-------------------------------------------+

On return

- Success → toast “Connected as u/username” and status pill updates
- Error (state invalid, access_denied) → show structured message, retry CTA

## Screen 1b: Test Connection

+-------------------------------------------+
| Test Reddit Connection |
|-------------------------------------------|
| [ Running… ] GET /api/reddit/me |
| Result: Connected as u/username |
| Karma: link 12,345 | comment 8,765 |
| Time: 2025-10-12 14:28:02 |
+-------------------------------------------+

Errors

- 401 → “Reddit auth expired. Reconnect.” [Connect]
- 429 → “Rate limit exceeded. Try again later.”
- 5xx/net → “Provider error. Please retry.”

## Screen 1c: Disconnect

+-------------------------------------------+
| Disconnect Reddit |
|-------------------------------------------|
| Are you sure? This removes access. |
| |
| [Cancel] [ Disconnect ] |
+-------------------------------------------+

Result: POST /api/oauth/reddit/disconnect → success toast; status becomes Not connected.

## Screen 2: Validate Subreddit

Goal: Verify that a subreddit exists and is accessible; show basic info.

+-----------------------------------------------------------------------------------+
| Subreddits / Validate |
+-----------------------------------------------------------------------------------+
| Subreddit | [ technology ] [ Validate ] |
|-----------------------------------------------------------------------------------|
| Info: |
| Title: r/technology |
| Members: 13,245,981 Active: 12,400 |
| Type: public NSFW: No |
| Description: … |
+-----------------------------------------------------------------------------------+
| Errors (if any): |
| - SUBREDDIT_NOT_FOUND | PRIVATE_SUBREDDIT | RATE_LIMIT_EXCEEDED |
+-----------------------------------------------------------------------------------+

Notes

- Input validated client-side (Zod): letters, numbers, underscores; max 21 chars; must start with a letter
- Server validates via OAuth client; maps 404/403/429 to structured codes

## Screen 3: Fetch Posts

Goal: Fetch posts from a subreddit with filters and show a compact preview.

+-----------------------------------------------------------------------------------+
| Subreddits / Fetch Posts |
+-----------------------------------------------------------------------------------+
| r/[ technology ] Sort [ hot v ] Time [ day v ] Count [ 25 ] NSFW [ ] |
| [ Include comments ] [ Max comments per post: 5 ] |
|-----------------------------------------------------------------------------------|
| [ Fetch ] |
|-----------------------------------------------------------------------------------|
| Results: Posts 25 | Comments 78 | Time: 842 ms |
|-----------------------------------------------------------------------------------|
| [Score] [Title] [Comments] [Age] [Flair] |
| 3.2k “Apple releases …” 512 12h News |
| 2.1k “Explain like …” 341 8h ELI5 |
| … |
+-----------------------------------------------------------------------------------+
| [ Save selection ] [ Generate summary ] [ Export ] |
+-----------------------------------------------------------------------------------+

Errors

- 403/private → “This subreddit is private or restricted.”
- 404/not found → “Subreddit does not exist.”
- 429/rate limit → “Too many requests; try later.”
- Generic → “Failed to fetch posts.”

## Screen 3a: Row Detail (optional)

+------------------------------------------------------------+
| Post: “Title …” |
|------------------------------------------------------------|
| Score: 3.2k | Comments: 512 | Age: 12h | NSFW: No |
| Flair: News | Author: u/foo |
|------------------------------------------------------------|
| Self-text / Link preview |
| “Lorem ipsum …” |
|------------------------------------------------------------|
| Top comments (sanitized & truncated) |
| 1) “Comment …” |
| 2) “Reply …” |
+------------------------------------------------------------+

## Interaction and Security Notes

- Connect/Test/Disconnect use server routes only; never expose secrets client-side
- Add `x-correlation-id` to responses and show copyable ID on error to help support
- Respect rate limits by spacing requests and showing friendly retry guidance

## Checklist

- [ ] Connect flow (authorize → callback)
- [ ] Test connection (/me)
- [ ] Disconnect (revoke + clear)
- [ ] Validate subreddit (with structured codes)
- [ ] Fetch posts with filters (hot/new/top/rising, time range, count)
- [ ] Optional: subscriptions list and picker
- [ ] CSRF + Origin checks; JWT-gated routes; encryption enabled
