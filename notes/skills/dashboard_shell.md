# Dashboard Shell Implementation (Reusable for Next.js Apps)

This guide documents a generic, reusable “dashboard shell” pattern for Next.js App Router apps, based on the implementation in this repo. It focuses on a two-level navigation (Sections → Pages), a resizable and collapsible sidebar, mobile drawer behavior, and a minimal profile menu.

It is written to be portable: you can lift the code and adapt the data contracts for any app domain (e.g., CRM, analytics, docs, admin).

## Baseline and Principles

- Next.js App Router (server-first) + React + TypeScript (strict)
- Tailwind CSS + Shadcn/Radix UI primitives
- Icons: Lucide
- Sidebar: resizable via `react-resizable-panels`
- Persistence: localStorage with namespaced keys and user scoping
- Mobile navigation: left Sheet/Drawer
- Auth-integrated: protected layout fetches server-side data and user; UI shell is a client component
- Accessibility: leverage Radix; include pointer-events cleanup on nested Dialog/Dropdown flows

Notes

- Two-level nav by default (Sections → Pages). See “Variants” for deeper trees.
- Use server components to fetch initial nav data; pass to client shell.
- Keep DB and secrets server-side; never import server-only code into client components.

## Dependencies

Runtime

- Lucide icons (e.g., `lucide-react`)
- Shadcn/Radix UI (e.g., `@radix-ui/react-*` via shadcn setup)
- `react-resizable-panels`

Optional (if you adopt the same extras)

- Command palette and quick actions providers/components
- Toasts/notifications (e.g., `sonner`)

Installation (example with npm)

```bash
npm i lucide-react react-resizable-panels
# Ensure shadcn/radix primitives were scaffolded in your project
```

## Data Contracts (generic)

Two-level navigation model:

- Section: `{ id: string; label: string; icon?: ReactNode }`
- Page: `{ id: string; label: string; href: string; badgeCount?: number; sectionId: string }`

Shell props:

- `userId: string` – Used for localStorage scoping
- `userEmail: string` – For the user menu avatar and display
- `sections: Section[]` – Top-level left nav sections
- `pages: Page[]` – Pages grouped by `sectionId`
- `children: React.ReactNode` – Main area content

Success criteria

- Desktop: Resizable/collapsible sidebar; main area with a top bar and content outlet
- Mobile: Sidebar appears in a left sheet; closes on navigation
- State persists per user (width + collapsed)
- Accessible menus/dialogs without “dead screen” issues

## Server-first Wiring (Protected Layout)

Pattern: Fetch user and navigation data in a server layout, then render a client shell component with props.

Key practices

- Keep data fetching server-side (DB access in Node runtime)
- Wrap shell with any providers your app needs (e.g., command/search)
- Pass serializable props only (IDs/labels/URLs/counts)

Example sketch

- `app/(protected)/layout.tsx` (Server Component)
  - Get the current user (e.g., from JWT or session)
  - Fetch sections/pages (or your domain data) for initial render
  - Render `<DashboardShell userId userEmail sections pages>{children}</DashboardShell>`
  - Optionally mount providers like `CommandSearchProvider`, `QuickActionsProvider`

Auth/middleware notes

- Use middleware to gate `/dashboard` and other protected routes with JWT signature checks
- Server components should revalidate the user/session if needed (e.g., compare sessionVersion)

## Client Shell Component

Responsibilities

- Layout: PanelGroup (sidebar + main) with resize handle
- Sidebar: header, search/command entry point, nav list, footer user menu
- Top bar: mobile menu button, optional quick actions, right-side controls
- Mobile: Sheet/Drawer for the sidebar
- Persistence: store width and collapsed state in localStorage with namespaced keys

Core behaviors

- Collapsible desktop sidebar (icon-only when collapsed)
- Responsive: sidebar is always expanded in mobile drawer
- Close mobile drawer on route changes
- Keyboard shortcuts (e.g., ⌘K for search, ⌘⇧N for quick actions)

Persistence keys

- `${APP_NAMESPACE}.v1.sidebar.width:${userId}`
- `${APP_NAMESPACE}.v1.sidebar.collapsed:${userId}`

Recommended defaults

- DEFAULT_WIDTH: 20 (% of viewport)
- MIN_WIDTH: 15; MAX_WIDTH: 35; COLLAPSED_WIDTH: ~4 (icon rail)

Accessibility and guardrails

- Use Radix components for menus/dialogs/sheets
- When opening Dialog from within Dropdown/ContextMenu, ensure pointer-events are restored after close:
  - In `onOpenChange`: when `!open`, run `setTimeout(() => document.body.style.pointerEvents = "", 300)`

## Sidebar (Two-level Nav)

Data rendering

- Group `pages` by `sectionId`
- In expanded mode: show section label + icon; list child pages with active styling
- In collapsed mode: show icon-only buttons with tooltips; page badges can appear as small counters

Active styling

- Use `usePathname()` and optional query string for determining selected page

Mobile drawer

- Wrap the same sidebar content in a left Sheet/Drawer for small screens
- Close on navigation (listen to history changes or rely on router transitions)

Footer user menu (minimal)

- Show avatar fallback (e.g., first letter of email)
- Items: Profile, Sign out
- Sign out: `POST /api/auth/signout`, then `router.replace("/login")` (or `/`), handle errors gracefully

## Top Bar

- Mobile: Menu button to open the sheet
- Spacer or page title area
- Right-side: optional Quick Actions button, shortcuts helper, or other app controls

Keyboard shortcuts

- Command palette: ⌘K / Ctrl+K
- Quick actions: ⌘⇧N / Ctrl+Shift+N
- Ignore shortcuts when focus is inside inputs/textareas/contenteditable

## Example Component Map

Suggest file structure (rename to match your app):

- `app/(protected)/layout.tsx` – server layout that renders the shell
- `components/features/dashboard/dashboard-shell.tsx` – client shell
- `components/features/dashboard/sidebar.tsx` – two-level nav rendering
- `components/features/dashboard/providers/{command-search,quick-actions}.tsx` – optional
- `components/ui/*` – shadcn components (Button, Sheet, DropdownMenu, Avatar, etc.)

## Security and Server-only Boundaries

- DB access must run in Node runtime; keep it in server components or route handlers
- Do not import server-only modules into client components
- Keep secrets on the server; client shell receives serializable data only

## Variants and Extensions

- Deeper nav (3+ levels): Add expand/collapse per item and lazy-load children
- Document lists in-tree: Add a toggle (persist with localStorage) to show/hide deep items
- Additional profile actions: API Keys, Usage, Help, etc.
- Command palette & quick actions: Provide context/providers and action sheets

Tip: This repo’s `SidebarTree` demonstrates a deeper, lazy-loaded tree (folders → projects → documents) you can use as a reference if you need to scale beyond two levels.

## Minimal Pseudocode

Server layout

```tsx
// app/(protected)/layout.tsx (server)
import { DashboardShell } from "@/components/features/dashboard/dashboard-shell";
import { getCurrentUser } from "@/lib/auth-helpers"; // or your auth util

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const sections = await getSectionsForUser(user.id); // [{ id, label, icon }]
  const pages = await getPagesForUser(user.id); // [{ id, label, href, sectionId, badgeCount? }]

  return (
    <DashboardShell
      userId={user.id}
      userEmail={user.email}
      sections={sections}
      pages={pages}
    >
      {children}
    </DashboardShell>
  );
}
```

Client shell (key ideas)

```tsx
// components/features/dashboard/dashboard-shell.tsx (client)
"use client";
import * as React from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./sidebar";
import { Menu } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage"; // or inline
import { useIsMobile } from "@/hooks/use-mobile"; // or a simple matchMedia hook

const DEFAULT_WIDTH = 20,
  MIN = 15,
  MAX = 35,
  COLLAPSED = 4;

export function DashboardShell(props: {
  userId: string;
  userEmail: string;
  sections: { id: string; label: string; icon?: React.ReactNode }[];
  pages: {
    id: string;
    label: string;
    href: string;
    badgeCount?: number;
    sectionId: string;
  }[];
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [width, setWidth] = useLocalStorage<number>(
    `app.v1.sidebar.width:${props.userId}`,
    DEFAULT_WIDTH
  );
  const [collapsed, setCollapsed] = useLocalStorage<boolean>(
    `app.v1.sidebar.collapsed:${props.userId}`,
    false
  );
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const effectiveCollapsed = isMobile ? false : collapsed;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-80 md:hidden">
          <Sidebar
            {...props}
            collapsed={false}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <PanelGroup
        direction="horizontal"
        onLayout={(sizes) =>
          !effectiveCollapsed && sizes[0] && setWidth(sizes[0])
        }
        className="flex-1"
      >
        <Panel
          defaultSize={effectiveCollapsed ? COLLAPSED : width}
          minSize={effectiveCollapsed ? COLLAPSED : MIN}
          maxSize={effectiveCollapsed ? COLLAPSED : MAX}
          className="relative max-md:hidden"
        >
          <Sidebar
            {...props}
            collapsed={effectiveCollapsed}
            onToggleCollapse={() => setCollapsed(!collapsed)}
          />
        </Panel>
        {!effectiveCollapsed && (
          <PanelResizeHandle className="w-1 bg-border hover:bg-accent transition-colors max-md:hidden" />
        )}
        <Panel defaultSize={effectiveCollapsed ? 96 : 80 - width}>
          <div className="h-full flex flex-col">
            <div className="border-b p-4 flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex-1 max-md:hidden" />
              {/* Right-side actions: Quick Actions, etc. */}
            </div>
            <main className="flex-1 overflow-y-auto">{props.children}</main>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
```

## Edge Cases to Consider

- Very narrow screens: ensure COLLAPSED width remains usable (hit targets ≥ 44px)
- Long labels: truncate and show tooltips in collapsed mode
- Large nav sets: add scroll areas; consider search/filter
- Keyboard traps: verify focus handling within Sheet/Dropdown/Dialog
- Pointer-events cleanup after nested menus open dialogs

## Performance Notes

- Server render the initial nav to avoid layout shift
- Defer heavy client code until needed (e.g., command palette)
- Keep sidebar items simple; lazy-load deep trees (if implemented)

## Minimal Route & File Map

- `middleware.ts` – protects routes, redirects unauthenticated users
- `app/(protected)/layout.tsx` – server: fetch user and nav; render shell
- `app/(protected)/dashboard/page.tsx` – an example protected page
- `components/features/dashboard/dashboard-shell.tsx` – client shell
- `components/features/dashboard/sidebar.tsx` – nav rendering (expanded/collapsed)
- `components/ui/*` – shadcn primitives (Button, Sheet, DropdownMenu, Avatar, etc.)
