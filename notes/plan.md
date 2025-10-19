# Superadmin Organization Settings Tabs — Implementation Plan

Short description: We will refactor the superadmin organization detail view into subrouted tabs under `app/admin/organizations/[orgSlug]/(tabs)`. A shared tabs layout will render the header and a TabsList with General and Members. The General tab will SSR org metadata and include a clearly marked Danger zone with delete. The Members tab will fetch its list client‑side via the existing API and support client‑driven pagination that updates the URL. The root `[orgSlug]` page will redirect to `/general`. This approach improves clarity, performance, and extensibility to add future tabs with minimal churn.

## Scope

- Phase 1: Superadmin area only (`/admin/organizations/[orgSlug]`) converted to tabs using subroutes: `/general` and `/members`.
- Phase 2 (optional): Mirror this pattern for org‑scoped settings under `/o/[orgSlug]/settings` later, without changing feature behavior.

## Finalized decisions (confirmed)

- Do both admin and org‑scoped in phases (admin first).
- Use subroutes for tabs: `/general`, `/members` (SSR friendly, sharable URLs).
- SSR org + members count in layout; fetch members list client‑side when on Members tab.
- Client‑driven pagination in Members; update URL `page`/`pageSize` without full reload.
- Default tab: General.
- Danger zone: dedicated Card with destructive styling and slug confirmation.
- Members table shows Role only (Admin/Member); no capability matrix.
- Admin list may include a “View members” action deep‑linking to `/members`; default “View” links to `/general`.
- After delete: redirect to `/admin/organizations` with success toast.
- Tabs below header (title + slug), above content.
- Members tab shows count badge; Invite button placed above the table; after slug change, auto‑navigate to new slug route; default pageSize=20.

## Routing and files

- app/admin/organizations/[orgSlug]/(tabs)/layout.tsx — Server layout
  - Loads: organization by slug; members count for badge.
  - Renders: header (Back, org name, slug), TabsList, active styling based on segment, and `children`.
- app/admin/organizations/[orgSlug]/(tabs)/general/page.tsx — Server page
  - Shows org metadata and edit controls; Danger zone Card with `DeleteOrganizationDialog`.
- app/admin/organizations/[orgSlug]/(tabs)/members/page.tsx — Client page
  - Fetches members via `GET /api/orgs/[orgSlug]/members`; renders table, Invite, edit role, remove; client pagination synced to URL.
- app/admin/organizations/[orgSlug]/page.tsx — Redirect
  - Redirects to `/admin/organizations/[orgSlug]/general` to maintain compatibility.

## Components and reuse

- Use `components/ui/tabs.tsx` for TabsList and content triggers.
- Reuse existing admin feature components:
  - `EditOrganizationButton`
  - `DeleteOrganizationDialog`
  - `InviteMemberDialog`
  - `EditMemberDialog` (or role select) and `RemoveMemberButton`
- Continue using shadcn/ui primitives (`Table`, `Button`, `Badge`, `Card`, `Dialog`).
- Use Sonner for toasts; no additional Toaster.

## Data fetching and state

- Layout SSR: `db.organization.findUnique` for org; `db.membership.count` for count badge.
- Members tab: client fetch list from `/api/orgs/[orgSlug]/members?page=…&pageSize=…`.
- URL is source of truth for pagination; update via router without full page reload.
- Error handling via Sonner; empty states preserved.

## Tabs behavior and deep links

- Tabs values: `general`, `members`.
- Links use Next `Link` to `/admin/organizations/[orgSlug]/general` and `/members`.
- Active state based on selected layout segment.
- Deep links supported: e.g., `/admin/organizations/acme-inc/members?page=2`.

## General tab specifics

- Show org name and slug; editing via `EditOrganizationButton`.
- Danger zone Card:
  - Title “Danger zone”, destructive border/background accents.
  - Clear text: irreversible deletion; removes memberships and invitations.
  - `DeleteOrganizationDialog` with slug confirmation.
  - On success: redirect to `/admin/organizations` with success toast.

## Members tab specifics

- Primary “Invite member” button above table.
- Table: Name, Email, Role, Joined, Actions.
- Role edit and remove actions with last‑admin protection preserved.
- Pagination controls update URL and re‑fetch; defaults pageSize=20.

## Access control and security

- Superadmin guard remains enforced by `app/admin/layout.tsx`.
- All mutations continue via Node runtime API; no client secrets or DB calls exposed.
- CSRF and rate limiting remain in effect for API routes.

## Phase 2 (optional) — org‑scoped settings

- Introduce `app/o/[orgSlug]/settings/(tabs)/layout.tsx` and subroutes `/general` and `/members`.
- Enforce admin/superadmin via existing settings layouts.
- Migrate existing `organization` and `members` pages into tabs without behavior change.

## Edge cases and empty states

- No members: show informative empty state with invite prompt.
- Slug change: auto‑navigate to new route; ensure links update seamlessly.
- Last admin cannot be demoted/removed; preserve messaging.
- 404 if org not found; handle gracefully with notFound/redirect.

## QA checklist

- `/admin/organizations/[slug]/general` renders org details and Danger zone.
- `/admin/organizations/[slug]/members?page=2` renders Members with page 2; pagination doesn’t cause full reload.
- Members count badge appears on the Members tab.
- Edit org name/slug flows work; route updates on slug change.
- Delete organization redirects to `/admin/organizations` with success toast.
- Last admin protection enforced; messaging visible.
- Tabs appear below header; mobile usability acceptable.

## Risks and mitigations

- Route churn: Add redirect from root `[orgSlug]` to `/general` to avoid broken links.
- Data duplication: Keep SSR minimal (org + count), defer lists to client to avoid over‑fetching.
- Slug update: Ensure UI navigates to new slug to prevent 404 on refresh.

## Effort estimate

- Implementation: ~0.5–1 day
- QA and polish: ~0.5 day
