---
name: dashboard-shell-setup
description: This skill should be used when setting up a production-ready dashboard shell with resizable sidebar, two-level navigation (Sections → Pages), mobile drawer, user menu with organization switcher, and localStorage persistence in a Next.js application. Use this skill when implementing a responsive dashboard layout with react-resizable-panels, shadcn/ui components, and server-first data fetching patterns.
---

# Dashboard Shell Setup

## Overview

Implement a complete, production-ready dashboard shell for Next.js applications featuring:
- Resizable sidebar with drag handle (15-35% viewport width)
- Collapsible icon-only mode (~4% width)
- Two-level navigation: Sections → Pages
- Mobile-responsive drawer (Sheet component)
- User menu with profile, organization switcher, and sign out
- LocalStorage persistence per user (width + collapsed state)
- Server-first data fetching pattern
- Full keyboard accessibility
- Support for multi-tenant organizations (optional)
- Badge counts for notifications/unread items
- Role-based page filtering

This implementation prioritizes flexibility, performance, and excellent UX across all device sizes.

## When to Use This Skill

Use this skill when:
- Building a dashboard layout for a Next.js application
- Implementing a resizable sidebar with navigation
- Creating multi-tenant applications with organization context
- Setting up responsive navigation for protected routes
- Need localStorage-persisted UI preferences per user
- Questions about this dashboard shell pattern's architecture

Do **not** use this skill when:
- Building public marketing pages (no dashboard needed)
- Implementing simple single-page layouts
- Using third-party admin templates (Material-UI, Ant Design, etc.)
- Need deep tree navigation (this implements 2-level; 3+ requires extensions)

## Quick Start

For rapid setup, follow these steps in order:

1. **Install dependencies**
   ```bash
   npm install react-resizable-panels lucide-react
   npx shadcn@latest add button sheet dropdown-menu avatar scroll-area
   ```
   See `references/dependencies.md` for complete details.

2. **Create component files**
   - Copy `DashboardShell` component from `references/component_implementation.md`
   - Copy `Sidebar` component from `references/component_implementation.md`
   - Place in `components/features/dashboard/`

3. **Set up server layout**
   - Follow patterns in `references/layout_integration.md`
   - Create `app/(protected)/layout.tsx` (or equivalent)
   - Fetch user data and navigation server-side
   - Render `<DashboardShell>` with props

4. **Create protected pages**
   - Add pages under `app/(protected)/`
   - Pages automatically render inside dashboard shell
   - Example: `app/(protected)/dashboard/page.tsx`

5. **Test responsive behavior**
   - Desktop: Test resize, collapse/expand
   - Mobile: Test drawer open/close
   - Verify localStorage persistence
   - Check user menu functionality

## Architecture Overview

### Component Hierarchy

```
Server Layout (app/(protected)/layout.tsx)
└── DashboardShell (client component)
    ├── Sheet (mobile drawer)
    │   └── Sidebar (expanded, closes on navigate)
    └── PanelGroup (desktop)
        ├── Panel (sidebar)
        │   └── Sidebar (collapsed or expanded)
        ├── PanelResizeHandle (drag handle)
        └── Panel (main content)
            ├── Top Bar
            │   ├── Menu button (mobile)
            │   └── Right-side actions
            └── Main content area
                └── {children}
```

### Data Flow

**Server → Client:**
1. Server layout fetches user and navigation data
2. Props passed to `DashboardShell` client component
3. Client component renders UI with state management

**State Management:**
- `width`: Sidebar width percentage (localStorage)
- `collapsed`: Sidebar collapsed state (localStorage)
- `mobileOpen`: Mobile drawer open state (React state)
- `organizations`: User's orgs (client-side fetch)

**Navigation:**
- `sections`: Top-level groups (e.g., "Main", "Settings")
- `pages`: Individual navigation items with hrefs
- Active page determined by `usePathname()`

### Responsive Behavior

**Desktop (≥768px):**
- Resizable sidebar (15-35% width)
- Collapse button → icon-only mode (~4% width)
- Drag handle for manual resizing
- State persists to localStorage

**Mobile (<768px):**
- Sidebar hidden by default
- Menu button in top bar opens Sheet drawer
- Sidebar always expanded in drawer
- Closes automatically on page navigation

## Two-Level Navigation Model

### Data Structure

```typescript
type Section = {
  id: string;
  label: string;
  icon?: React.ReactNode;
};

type Page = {
  id: string;
  label: string;
  href: string;
  badgeCount?: number;
  sectionId: string;
};
```

### Example Navigation

```typescript
const sections = [
  {
    id: "main",
    label: "Main",
    icon: <Home className="h-4 w-4" />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings className="h-4 w-4" />,
  },
];

const pages = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    sectionId: "main",
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/analytics",
    badgeCount: 3, // Unread items
    sectionId: "main",
  },
  {
    id: "profile",
    label: "Profile",
    href: "/settings/profile",
    sectionId: "settings",
  },
];
```

### Navigation Rendering

**Expanded Mode:**
```
Main
├─ Dashboard
└─ Analytics [3]

Settings
└─ Profile
```

**Collapsed Mode:**
```
[D]      (Dashboard)
[A] •    (Analytics with badge)
[P]      (Profile)
```

## Server Layout Integration

### Basic Protected Layout

```typescript
// app/(protected)/layout.tsx
import { getCurrentUser } from "@/lib/auth-helpers";
import { DashboardShell } from "@/components/features/dashboard/dashboard-shell";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sections = [
    { id: "main", label: "Main" },
    { id: "settings", label: "Settings" },
  ];

  const pages = [
    {
      id: "dashboard",
      label: "Dashboard",
      href: "/dashboard",
      sectionId: "main",
    },
    {
      id: "profile",
      label: "Profile",
      href: "/settings/profile",
      sectionId: "settings",
    },
  ];

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

See `references/layout_integration.md` for:
- Organization-scoped layouts
- Role-based page filtering
- Dynamic badge counts
- Database-driven navigation

## Component Features

### DashboardShell Component

**Location:** `components/features/dashboard/dashboard-shell.tsx`

**Key Features:**
- PanelGroup with horizontal orientation
- Sidebar panel (resizable or fixed collapsed width)
- Main content panel with top bar and content area
- Mobile Sheet drawer
- Custom hooks: `useLocalStorage`, `useIsMobile`
- Automatic drawer close on pathname change

**Props:**
```typescript
type DashboardShellProps = {
  userId: string;
  userEmail: string;
  sections: Section[];
  pages: Page[];
  children: React.ReactNode;
  currentOrg?: CurrentOrg;           // Multi-tenant support
  lastOrgCookieName?: string;        // Cookie for org switching
  defaultOrgSlug?: string;            // Fallback org
  canCreateOrganizations?: boolean;  // Show "Create Org" option
  isSuperadmin?: boolean;            // Superadmin features
};
```

### Sidebar Component

**Location:** `components/features/dashboard/sidebar.tsx`

**Key Features:**
- Two rendering modes: expanded and collapsed
- Navigation grouped by sections
- Active page highlighting via `usePathname()`
- User menu with dropdown
- Organization switcher (when currentOrg provided)
- Client-side org fetching via `/api/orgs`
- Sign out functionality
- Badge count display

**Props:**
```typescript
type SidebarProps = {
  userId: string;
  userEmail: string;
  sections: Section[];
  pages: Page[];
  collapsed: boolean;
  currentOrg?: CurrentOrg;
  lastOrgCookieName?: string;
  defaultOrgSlug?: string;
  canCreateOrganizations?: boolean;
  isSuperadmin?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
};
```

## LocalStorage Persistence

### Storage Keys

The dashboard shell persists UI state per user:

```
app.v1.sidebar.width:{userId}     → number (percentage)
app.v1.sidebar.collapsed:{userId}  → boolean
```

**Example:**
```
app.v1.sidebar.width:user123    → 22
app.v1.sidebar.collapsed:user123 → false
```

### useLocalStorage Hook

Built-in hook implementation:

```typescript
function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  };

  return [storedValue, setValue];
}
```

**Benefits:**
- SSR-safe (checks `typeof window`)
- Error handling for quota exceeded
- Per-user scoping
- Survives page refreshes

## Multi-Tenant Organization Support

### Organization Context

When `currentOrg` prop is provided, the sidebar adds:

**Header:**
- Organization name display
- User's role (Member/Admin/Superadmin)

**User Menu:**
- Organization settings link
- Members management (admins only)
- Organization switcher (when user has multiple orgs)
- Create organization option (when allowed)
- Manage organizations (superadmins only)

### Organization Data Structure

```typescript
type CurrentOrg = {
  id: string;
  name: string;
  slug: string;
  role: string; // "member" | "admin" | "superadmin"
};
```

### Organization Switching

Flow:
1. User clicks org in dropdown menu
2. Cookie set: `{lastOrgCookieName}={org.slug}`
3. Navigate to: `/o/{org.slug}/dashboard`
4. Server layout validates membership
5. Renders shell with new org context

### API Endpoint Required

**Location:** `app/api/orgs/route.ts`

```typescript
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { organization: true },
  });

  const organizations = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
  }));

  return Response.json({ organizations });
}
```

See `references/layout_integration.md` for complete implementation.

## Implementation Workflow

### Step-by-Step Guide

**Phase 1: Dependencies & Setup (15-30 minutes)**
1. Install react-resizable-panels and lucide-react
2. Add required shadcn/ui components (Button, Sheet, DropdownMenu, Avatar, ScrollArea)
3. Verify Tailwind CSS configuration
4. Create component directory: `components/features/dashboard/`

**Phase 2: Component Implementation (45-60 minutes)**
1. Create `dashboard-shell.tsx` with complete code from `references/component_implementation.md`
2. Create `sidebar.tsx` with complete code from `references/component_implementation.md`
3. Verify imports and type exports
4. Test components in isolation (optional)

**Phase 3: Server Layout Integration (30-45 minutes)**
1. Create protected layout: `app/(protected)/layout.tsx`
2. Implement `getCurrentUser()` helper (or use existing)
3. Define sections and pages structure
4. Render `<DashboardShell>` with props
5. Test with a sample protected page

**Phase 4: Navigation & Pages (30-45 minutes)**
1. Create protected pages (e.g., `/dashboard`, `/settings/profile`)
2. Add more sections and pages as needed
3. Implement role-based filtering (if needed)
4. Add badge counts (if needed)

**Phase 5: Optional Features (30-60 minutes)**
1. Multi-tenant support (if needed)
2. Organization switcher implementation
3. Create `/api/orgs` endpoint
4. Test org switching flow
5. Add keyboard shortcuts (optional)

**Phase 6: Testing & Polish (30-45 minutes)**
1. Test desktop resize and collapse
2. Test mobile drawer behavior
3. Verify localStorage persistence
4. Test user menu and sign out
5. Test org switching (if applicable)
6. Check accessibility (keyboard navigation, screen readers)

**Total estimated time:** 3-5 hours for complete implementation

### Common Implementation Patterns

**Protected Page Pattern:**
```typescript
// app/(protected)/dashboard/page.tsx
import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div>
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p>Welcome, {user.email}!</p>
    </div>
  );
}
```

**Dynamic Badge Counts:**
```typescript
// In server layout
const unreadCount = await db.notification.count({
  where: { userId: user.id, readAt: null },
});

const pages = [
  {
    id: "notifications",
    label: "Notifications",
    href: "/notifications",
    badgeCount: unreadCount,
    sectionId: "main",
  },
];
```

**Role-Based Filtering:**
```typescript
// In server layout
const isAdmin = user.role === "admin" || user.role === "superadmin";

const allPages = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", sectionId: "main" },
  { id: "admin", label: "Admin Panel", href: "/admin", sectionId: "main", adminOnly: true },
];

const pages = allPages.filter((page) => {
  if (page.adminOnly && !isAdmin) return false;
  return true;
});
```

## Customization

### Styling

**Sidebar Width Defaults:**
```typescript
// In dashboard-shell.tsx
const DEFAULT_WIDTH = 20;  // 20% of viewport
const MIN_WIDTH = 15;      // 15% minimum
const MAX_WIDTH = 35;      // 35% maximum
const COLLAPSED_WIDTH = 4; // ~4% when collapsed (icon-only)
```

**Theme Colors:**
Customize via CSS variables in `globals.css` (uses shadcn/ui theme system).

### Navigation Structure

**Adding Sections:**
```typescript
const sections = [
  { id: "main", label: "Main", icon: <Home className="h-4 w-4" /> },
  { id: "analytics", label: "Analytics", icon: <BarChart className="h-4 w-4" /> },
  { id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];
```

**Adding Pages:**
```typescript
const pages = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", sectionId: "main" },
  { id: "reports", label: "Reports", href: "/reports", sectionId: "analytics" },
  { id: "profile", label: "Profile", href: "/settings/profile", sectionId: "settings" },
];
```

### Top Bar Extensions

Add custom content to top bar:

```typescript
// In dashboard-shell.tsx
<div className="border-b p-4 flex items-center justify-between gap-2">
  <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}>
    <Menu className="h-5 w-5" />
  </Button>

  {/* Add breadcrumbs, search, notifications, etc. */}
  <div className="flex items-center gap-2">
    <Button variant="ghost" size="icon">
      <Bell className="h-5 w-5" />
    </Button>
  </div>
</div>
```

See `references/customization_guide.md` for:
- Advanced styling options
- Nested navigation (3+ levels)
- Keyboard shortcuts
- Command palette integration
- Performance optimizations
- Accessibility enhancements

## Testing

### Manual Testing Checklist

**Desktop:**
- [ ] Sidebar resizes smoothly via drag handle
- [ ] Collapse button switches to icon-only mode
- [ ] Expand button restores sidebar
- [ ] Width persists across page refreshes
- [ ] Collapsed state persists across sessions
- [ ] Active page highlights correctly
- [ ] User menu opens and functions
- [ ] Sign out works correctly

**Mobile:**
- [ ] Menu button opens drawer
- [ ] Sidebar displays in drawer (expanded)
- [ ] Drawer closes on navigation
- [ ] Drawer closes on outside click
- [ ] User menu works in drawer
- [ ] Navigation works in drawer

**Organization Features (if applicable):**
- [ ] Organization name displays in header
- [ ] User role displays correctly
- [ ] Organization switcher shows all orgs
- [ ] Switching orgs navigates correctly
- [ ] Cookie persists after switch
- [ ] Create org button appears when allowed
- [ ] Admin-only items hidden from members

**Accessibility:**
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Screen reader announces navigation
- [ ] Focus visible on interactive elements
- [ ] ARIA labels present on icon buttons

### Component Testing

```typescript
import { render, screen } from "@testing-library/react";
import { DashboardShell } from "./dashboard-shell";

test("renders navigation items", () => {
  const sections = [{ id: "main", label: "Main" }];
  const pages = [
    { id: "dashboard", label: "Dashboard", href: "/dashboard", sectionId: "main" },
  ];

  render(
    <DashboardShell
      userId="test"
      userEmail="test@example.com"
      sections={sections}
      pages={pages}
    >
      <div>Content</div>
    </DashboardShell>
  );

  expect(screen.getByText("Dashboard")).toBeInTheDocument();
});
```

## Troubleshooting

### Common Issues

**Sidebar width not persisting:**
- **Problem:** Width resets to default on refresh
- **Solution:** Verify `userId` prop is consistent and correct

**Collapse button not working:**
- **Problem:** Button clicks have no effect
- **Solution:** Ensure `onToggleCollapse` prop is passed to Sidebar

**Mobile drawer not closing:**
- **Problem:** Drawer stays open after navigation
- **Solution:** Verify `pathname` effect in DashboardShell closes drawer

**Organization switcher empty:**
- **Problem:** No organizations shown in dropdown
- **Solution:** Check `/api/orgs` endpoint implementation and response format

**Active page not highlighting:**
- **Problem:** No page appears selected
- **Solution:** Verify `pathname` matches page `href` exactly (including trailing slashes)

**Resize handle not visible:**
- **Problem:** Can't find drag handle
- **Solution:** Handle only shows when sidebar is expanded (not collapsed)

## Production Checklist

Before deploying:
- [ ] Test on actual mobile devices (not just browser responsive mode)
- [ ] Verify localStorage works across all target browsers
- [ ] Check performance with large navigation lists (50+ pages)
- [ ] Test with slow network conditions
- [ ] Verify user menu sign out works correctly
- [ ] Test organization switching (if applicable)
- [ ] Check accessibility with screen readers
- [ ] Verify keyboard shortcuts don't conflict with browser shortcuts
- [ ] Test dark mode support (if enabled)
- [ ] Optimize bundle size (lazy load heavy features)

## Resources

This skill includes comprehensive reference documentation:

### references/dependencies.md
All runtime dependencies (react-resizable-panels, lucide-react, shadcn/ui components), framework requirements, Tailwind CSS configuration, and browser compatibility notes.

### references/component_implementation.md
Complete implementation code for DashboardShell and Sidebar components with all features, hooks (useLocalStorage, useIsMobile), type definitions, and utility functions.

### references/layout_integration.md
Step-by-step guide for integrating dashboard shell into server layouts with examples for basic protected layouts, organization-scoped layouts, role-based filtering, dynamic badge counts, helper functions, and API endpoints.

### references/customization_guide.md
Advanced customization patterns including styling options, navigation enhancements (search, nested pages, collapsible sections, icons), advanced features (keyboard shortcuts, command palette, notifications), responsive enhancements, performance optimizations, accessibility improvements, and testing strategies.

**Using references:** Reference files contain detailed implementation code and advanced patterns. The main SKILL.md provides the workflow and architecture; references provide the specifics.
