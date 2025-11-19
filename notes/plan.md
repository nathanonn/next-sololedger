We’ll update the auth helpers to accept both Request and NextRequest, then systematically pass the incoming request object into getCurrentUser for all organization-scoped API routes and /api/user/organizations, while leaving server components and account-only endpoints cookie-based. We’ll also relax CSRF checks for Bearer-token requests so personal API keys can be used for both reads and writes, and finally outline how to validate the behavior with a mix of manual checks and (if you choose to add a test runner) unit and integration tests.

**Plan**

- **Tighten auth helper typing and behavior**
  - Update lib/auth-helpers.ts so getAuthFromRequest and getCurrentUser accept request?: Request | NextRequest (importing NextRequest as a type) while keeping their runtime logic unchanged.
  - Keep the default “cookies-only” behavior when request is omitted, so server components and any existing cookie-only flows remain unaffected.
  - Optionally widen getClientIp’s parameter type to Request | NextRequest as well, for consistency and to avoid TS friction where NextRequest is used.
- **Align CSRF behavior with API-key/Bearer usage**
  - In lib/csrf.ts, update validateCsrf(request) so that when request.headers.get("authorization") starts with "Bearer ", it returns null immediately (skipping Origin/Referer checks).
  - Keep the existing Origin-based validation for all cookie-based browser requests (no Authorization header), preserving current CSRF protections.
  - Review routes that use validateCsrf (e.g. transactions, org updates) to confirm that this header-based bypass is applied consistently wherever Bearer clients should be supported.
- **Define the exact set of endpoints that support API keys**
  - Treat all organization-scoped routes under app/api/orgs/\*\* as eligible for personal API key access (transactions, vendors, clients, documents, reports, integrations, org settings, invitations, members, etc.).
  - Confirm that /api/user/organizations continues to support Bearer tokens (it already calls getCurrentUser(request)), so API key clients can discover their scoped organization.
  - Leave account-/profile-focused endpoints such as /api/auth/profile/change-password and /api/auth/profile/set-password as cookie-only, not passing request into getCurrentUser there.
- **Update route handlers to pass the request into getCurrentUser**
  - For all app/api/orgs/\*\* route files that currently import getCurrentUser and define handlers like export async function GET(request: Request, { params } ...), change internal calls from await getCurrentUser() to await getCurrentUser(request).
  - For handlers using NextRequest (e.g. P&L and other report/export endpoints: req: NextRequest), pass that object directly: await getCurrentUser(req), relying on the union type in getCurrentUser.
  - Ensure all handlers in multi-method files are updated (e.g. GET, POST, PATCH, DELETE in the same file) so they consistently support Bearer tokens wherever they currently require authentication.
- **Handle any indirect getCurrentUser usage in helpers**
  - Search for non-route usages of getCurrentUser in libraries that might be shared between routes and server components.
  - Where such a helper needs to be used from both a route and a server component, add an optional request?: Request | NextRequest parameter to that helper, thread it through to getCurrentUser(request), and update only the route call sites to pass the request while leaving server components calling it without arguments.
  - Verify there are no background jobs or scripts that depend on getCurrentUser in a context without a request; if any exist, keep them cookie-only (or have them pass undefined explicitly for clarity).
- **Leave server components as cookie-only**
  - Do not change any getCurrentUser() usage in server components and layouts (e.g. app/page.tsx, app/o/[orgSlug]/layout.tsx, dashboard/report pages) so they continue to rely entirely on cookies set by the browser.
  - Optionally add/adjust brief comments in lib/auth-helpers.ts DocBlocks to clarify that the request parameter is for Route Handlers/API usage and that omitting it is the intended pattern for server components.
- **Verification and testing strategy**
  - Manual smoke tests:
    - Log in via the UI to get cookies and confirm that key org routes (e.g. transactions, vendors, reports, org settings) still work in the browser after the change.
    - Generate an API key, exchange it via /api/auth/api-key/exchange to obtain a Bearer token, and use that token (without cookies) against several representative endpoints (e.g. /api/orgs/[orgSlug]/transactions, /vendors, /reports/pnl, /documents) to confirm non-401 responses and correct org scoping.
    - Verify that account/password endpoints still reject Bearer-only requests as intended.
  - Automated tests (once a test runner is chosen/added):
    - Add unit tests around getAuthFromRequest and getCurrentUser to cover: cookie-only, Bearer-only, both present (header wins), and invalid token cases, using a fake Request/NextRequest with appropriate headers.
    - Add a small number of integration-style tests for a few representative routes (/api/orgs/[orgSlug]/transactions, /api/orgs/[orgSlug]/reports/pnl, /api/orgs/[orgSlug]/integrations, /api/user/organizations) to exercise both cookie-based and Bearer-based authentication paths.
    - Wire these tests into whatever test framework you choose (e.g. Vitest or Node’s built-in test runner) and add a "test" script in package.json so they can be run in CI.
