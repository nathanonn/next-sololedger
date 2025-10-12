# Reddit API Integration (Portable for Next.js App Router)

This guide documents a reusable, provider-agnostic pattern to integrate Reddit OAuth2 and content fetching into any Next.js App Router app. It is based on production-ready patterns in this repo and is designed to be copied/adapted.

Goals

- OAuth2: Connect a user’s Reddit account via OAuth (permanent refresh tokens)
- Secure token storage: AES‑256‑GCM encryption at rest; never persist access tokens
- Fetching: Read subreddit metadata, posts, and comments; optional user subscriptions
- Robustness: Zod validation, typed errors, rate limiting, retry/backoff
- Security: CSRF/Origin checks on mutating routes, JWT session gating, ownership
- Observability: Structured errors and correlation IDs

Assumptions and choices (selected)

- Data model: Separate RedditConnection table (single-tenant app credentials)
- Scopes: identity read
- Redirect paths: consolidated under a single Reddit router subtree → /api/reddit/oauth/authorize, /api/reddit/oauth/callback, /api/reddit/oauth/disconnect
- Tokens: Persist refresh token only (encrypted); refresh access token on each use
- Rate limiting: Queue with conservative caps; respect Retry-After; exponential backoff

Quickstart checklist

1. Create a Reddit app (web app)
   - https://www.reddit.com/prefs/apps
   - App type: “web app”
   - Redirect URI: https://your-app.com/api/oauth/reddit/callback (add http://localhost:3000 for dev)
   - Save Client ID and Client Secret
2. Configure environment
   - REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REDIRECT_URI, REDDIT_SCOPES="identity read", REDDIT_USER_AGENT
   - APP_ENCRYPTION_KEY (base64 32 bytes) for AES‑GCM token encryption
3. Add data model (RedditConnection) and token crypto helpers
4. Implement routes: authorize → callback → disconnect; gated read routes (/me, /subreddit/[name], /posts)
5. Add OAuth + public Reddit clients, a rate limiter, and a small RedditService orchestrator
6. Add Settings → Integrations → Reddit UI with Connect/Test/Disconnect

## Environment & Secrets

Required env vars (single-tenant)

- REDDIT_CLIENT_ID
- REDDIT_CLIENT_SECRET
- REDDIT_REDIRECT_URI (e.g., http://localhost:3000/api/oauth/reddit/callback)
- REDDIT_SCOPES: "identity read"
- REDDIT_USER_AGENT: e.g., "web:your-app:1.0.0 (by u/yourusername)"
- APP_ENCRYPTION_KEY: base64-encoded 32-byte key for AES‑256‑GCM

Notes

- Do not commit secrets. Use .env.local and a secrets manager in prod.
- You can namespace env names if needed, but the above names are conventional and portable.

## Data Model (Prisma sketch)

Recommended dedicated table (supports multiple providers or multi-account if extended):

```prisma
model RedditConnection {
	id               String   @id @default(cuid())
	userId           String   @unique
	redditUserId     String
	redditUsername   String
	refreshTokenEnc  String   // AES-GCM encrypted refresh token
	scope            String?
	connectedAt      DateTime @default(now())
	updatedAt        DateTime @updatedAt

	user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Variant (columns on User)

- If you want fewer tables, you can store `redditId`, `redditUsername`, `redditRefreshTokenEncrypted`, `redditConnectedAt` on `User` as seen in this repo. The rest of the guide still applies; adjust query helpers accordingly.

## Token Encryption (AES‑256‑GCM)

Contract

- Input: plaintext refresh token
- Output: base64 JSON envelope { v: 1, iv, ct, tag }
- Key: APP_ENCRYPTION_KEY (base64 32 bytes)

Guidelines

- Encrypt on write; decrypt only on server (Node runtime) when needed
- Never store access tokens; they are short‑lived and refreshed per call

## OAuth2 Flow

Endpoints (consolidated router)

- GET /api/reddit/oauth/authorize → redirects to Reddit with state
- GET /api/reddit/oauth/callback → exchanges code, stores encrypted refresh token, updates session
- POST /api/reddit/oauth/disconnect → revokes refresh token and clears DB; updates session

Security

- Use CSRF state (random 32‑byte hex) stored as an httpOnly cookie (10 min)
- Set `duration=permanent` to request a refresh token
- Scope: `identity read` (least privilege to read identity and sub content)
- Gate endpoints with JWT sessions; use Next’s `cookies()` to read httpOnly token
- Mark routes as Node runtime: `export const runtime = "nodejs"`

Authorize

1. Validate session
2. Generate state; set httpOnly cookie
3. Build URL: https://www.reddit.com/api/v1/authorize?client_id=...&response_type=code&state=...&redirect_uri=...&duration=permanent&scope=identity%20read
4. Redirect

Callback

1. Verify state against cookie; clear cookie
2. Exchange `code` for tokens at https://www.reddit.com/api/v1/access_token using basic auth header for client credentials
3. Call `GET https://oauth.reddit.com/api/v1/me` with access token to verify and get username/id
4. Encrypt and persist refresh token; store redditUserId/username; update JWT claim that user is connected
5. Redirect back to app (e.g., /dashboard?reddit=connected)

Disconnect

1. Fetch encrypted refresh token; decrypt
2. POST https://www.reddit.com/api/v1/revoke_token with `token_type_hint=refresh_token`
3. Clear DB fields / delete RedditConnection; update JWT claim
4. Return success even if revoke fails (log warning)

## Token Handling Strategy

- Never persist access tokens
- On each API call: look up encrypted refresh token → refresh access token (POST access_token with grant_type=refresh_token) → use access token for the actual Reddit call
- If Reddit ever returns a new `refresh_token` (rare for Reddit), re‑encrypt and persist it (rotate)
- Implement helper utilities:
  - buildRedditAuthUrl(state)
  - exchangeCodeForTokens(code)
  - refreshRedditTokens(refreshToken)
  - revokeRedditTokens(refreshToken)
  - makeRedditAPICall(endpoint, accessToken, options) → includes one retry for 401/429 honoring Retry‑After, and applies User‑Agent

## Client Abstraction

- Public RedditClient: calls `https://www.reddit.com` JSON endpoints; protected by a rate limiter (queue)
- OAuth RedditOAuthClient: wraps `https://oauth.reddit.com` calls; obtains a fresh access token via refresh, with optional fallback to public endpoints for non-user-scoped contexts
- Service layer (RedditService): orchestrates info/posts/comments fetching, parsing, filtering, pagination (after), and stats

Benefits

- Swap or reuse clients in other apps
- Centralize retry/backoff and response parsing

## Rate Limiting & Backoff

Reddit rate limits are opaque and may vary. Use conservative limits.

- Queue: p-queue with concurrency=1, intervalCap≈50/min, small burst≈5
- Respect `x-ratelimit-remaining`, `x-ratelimit-reset`, and `Retry-After`
- Exponential backoff on 5xx and network errors (e.g., 1s, 2s, 4s, capped)
- Space out paginated requests (e.g., 300–500 ms) and batch work sequentially

## Fetching Contracts (portable HTTP APIs)

1. GET /api/reddit/me

- Purpose: verify connection and return minimal user info
- Response: { success: boolean; user?: { name; id; link_karma?; comment_karma? } }
- Errors: 401 when not connected; 500 on provider failure

2. GET /api/reddit/subreddit/:name

- Purpose: validate subreddit and return basic info
- Response: { success, valid, subreddit? }
- Errors: 404 SUBREDDIT_NOT_FOUND; 403 PRIVATE/FORBIDDEN; 429 RATE_LIMIT_EXCEEDED; 500

3. POST /api/reddit/posts

- Body: { subredditName: string; count?: number; timeRange?: 'hour'|'day'|'week'|'month'|'year'|'all'; sortMethod?: 'hot'|'new'|'top'|'rising'; includeNSFW?: boolean; includeComments?: boolean; maxCommentsPerPost?: number }
- Behavior: uses OAuth client; if count>25 perform multi-page with `after`
- Response: { success: true; data: { posts, comments, subredditInfo, statistics } }
- Errors: Zod 400; 404/403/429 mapped; 500 generic fallback

4. GET /api/reddit/subscriptions

- Purpose: list user’s subscribed subreddits; requires OAuth scope `read`
- Response: { success: true; items: Array<{ display_name; public_description }> }
- Errors: 401/429/500

Validation & Errors

- Validate inputs with Zod (e.g., subreddit name rules)
- Return structured codes: SUBREDDIT_NOT_FOUND, PRIVATE_SUBREDDIT, RATE_LIMIT_EXCEEDED, TIMEOUT_ERROR
- Attach `x-correlation-id` to request/response; log it internally

## Security Guardrails

- Runtime: use Node (DB/secrets)
- CSRF/Origin checks on state-changing routes
- AuthZ: ensure the authenticated user owns the RedditConnection being mutated
- Secrets: never expose client secret to the browser; never expose refresh tokens
- Access: only call OAuth endpoints from the server

## UI Placement (Settings → Integrations → Reddit)

Provide a card with:

- Connect button (opens authorize)
- Status pill (Connected / Not connected)
- Test connection (/api/reddit/me)
- Disconnect
- Subscriptions list picker (see below)

## Subscriptions Picker

- Endpoint: GET /api/reddit/subscriptions via OAuth client ("/subreddits/mine/subscriber")
- UI: searchable list with “Add to my tracked subreddits” CTA

## Testing and Local Dev

- Configure a Reddit app “redirect URI” for localhost
- Use a dev `REDDIT_USER_AGENT` that follows Reddit’s guidelines
- Simulate rate limits by lowering interval caps
- For E2E, stub Reddit APIs or use a test Reddit account

## Failure Modes & Handling

- 401: expired/invalid access token → refresh once; if still 401, require reconnect
- 403: private/restricted subreddit → return structured error; guide the user
- 404: missing subreddit → structured error for UX
- 429: use Retry-After; surface “try again later” UX with backoff
- 5xx/network/timeout: retry with exponential backoff; soften UX copy

## Reuse Notes

- Keep clients under `lib/reddit/*`, service under `services/reddit-service.ts`, and API routes under `app/api/reddit/*`
- Use path aliases (`@/*`) and Node runtime for server-only files
- If your app stores connections on `User`, map RedditConnection queries to column reads/writes

## Appendix: Minimal route outlines

- /api/reddit/oauth/authorize: validate session → set state cookie → redirect to Reddit
- /api/reddit/oauth/callback: validate state → exchange code → fetch /me → save connection → update JWT → redirect
- /api/reddit/oauth/disconnect: revoke refresh token → clear connection → update JWT → 200
- /api/reddit/me: refresh access token → call /api/v1/me → 200/401/500
- /api/reddit/subreddit/[name]: validate name with OAuth client → map errors → 200/4xx/500
- /api/reddit/posts: Zod-parse body → service.fetchSubredditData → 200 or mapped errors
