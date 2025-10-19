# Customization Guide

Advanced customization patterns and feature extensions for the dashboard shell.

## Styling Customization

### Theme Colors

The dashboard shell uses shadcn/ui theme variables. Customize in `globals.css`:

```css
@layer base {
  :root {
    /* Customize sidebar background */
    --sidebar-background: 0 0% 98%;

    /* Customize active item color */
    --sidebar-active: 222.2 47.4% 11.2%;
    --sidebar-active-foreground: 210 40% 98%;

    /* Customize border color */
    --sidebar-border: 214.3 31.8% 91.4%;
  }
}
```

Update component classes:

```typescript
// In sidebar.tsx, replace:
className="border-r bg-background"

// With custom variables:
className="border-r bg-[hsl(var(--sidebar-background))]"
```

### Custom Sidebar Width

Adjust default widths in `dashboard-shell.tsx`:

```typescript
const DEFAULT_WIDTH = 25;  // 25% instead of 20%
const MIN_WIDTH = 18;      // 18% instead of 15%
const MAX_WIDTH = 40;      // 40% instead of 35%
const COLLAPSED_WIDTH = 5; // 5% instead of 4%
```

### Top Bar Customization

Add custom content to the top bar:

```typescript
// In dashboard-shell.tsx
<div className="border-b p-4 flex items-center justify-between gap-2">
  <Button
    variant="ghost"
    size="icon"
    className="md:hidden"
    onClick={() => setMobileOpen(true)}
  >
    <Menu className="h-5 w-5" />
  </Button>

  {/* Add breadcrumbs */}
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <span>Dashboard</span>
    <ChevronRight className="h-4 w-4" />
    <span className="text-foreground">Analytics</span>
  </div>

  <div className="flex-1 max-md:hidden" />

  {/* Add custom actions */}
  <div className="flex items-center gap-2">
    <Button variant="ghost" size="icon">
      <Bell className="h-5 w-5" />
    </Button>
    <Button variant="ghost" size="icon">
      <Search className="h-5 w-5" />
    </Button>
  </div>
</div>
```

## Navigation Enhancements

### Search/Command Entry Point

Add a search button to the sidebar header:

```typescript
// In sidebar.tsx, after the header
<div className="p-3 border-b">
  <Button
    variant="outline"
    className="w-full justify-start text-muted-foreground"
    onClick={() => {
      // Trigger command palette
      setCommandOpen(true);
    }}
  >
    <Search className="mr-2 h-4 w-4" />
    Search...
    <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
      <span className="text-xs">⌘</span>K
    </kbd>
  </Button>
</div>
```

### Nested Pages (3+ Levels)

Extend the Page type to support children:

```typescript
export type Page = {
  id: string;
  label: string;
  href: string;
  badgeCount?: number;
  sectionId: string;
  children?: Page[]; // Add nested pages
};

// In sidebar rendering
{sectionPages.map((page) => (
  <div key={page.id}>
    <Link href={page.href}>
      <Button variant={isActive ? "secondary" : "ghost"}>
        {page.label}
      </Button>
    </Link>

    {/* Render children with indent */}
    {page.children && (
      <div className="ml-4 mt-1 space-y-1">
        {page.children.map((child) => (
          <Link key={child.id} href={child.href}>
            <Button
              variant="ghost"
              className="w-full justify-start text-sm"
            >
              {child.label}
            </Button>
          </Link>
        ))}
      </div>
    )}
  </div>
))}
```

### Collapsible Sections

Add expand/collapse for each section:

```typescript
// In sidebar.tsx
const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
  new Set(sections.map((s) => s.id))
);

function toggleSection(sectionId: string) {
  setExpandedSections((prev) => {
    const next = new Set(prev);
    if (next.has(sectionId)) {
      next.delete(sectionId);
    } else {
      next.add(sectionId);
    }
    return next;
  });
}

// In rendering
<div className="px-3 py-2 flex items-center justify-between">
  <h3 className="text-xs font-semibold text-muted-foreground uppercase">
    {section.label}
  </h3>
  <Button
    variant="ghost"
    size="icon"
    className="h-4 w-4"
    onClick={() => toggleSection(section.id)}
  >
    <ChevronDown
      className={cn(
        "h-3 w-3 transition-transform",
        !expandedSections.has(section.id) && "-rotate-90"
      )}
    />
  </Button>
</div>

{expandedSections.has(section.id) && (
  <div className="space-y-1">
    {/* Render pages */}
  </div>
)}
```

### Page Icons

Add custom icons to pages:

```typescript
export type Page = {
  id: string;
  label: string;
  href: string;
  icon?: React.ReactNode; // Add icon support
  badgeCount?: number;
  sectionId: string;
};

// In layout
const pages = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
    sectionId: "main",
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/analytics",
    icon: <BarChart className="h-4 w-4" />,
    sectionId: "main",
  },
];

// In sidebar rendering
<Button variant={isActive ? "secondary" : "ghost"}>
  {page.icon && <span className="mr-2">{page.icon}</span>}
  <span className="flex-1 text-left">{page.label}</span>
</Button>
```

## Advanced Features

### Keyboard Shortcuts

Add global keyboard shortcuts:

```typescript
// In dashboard-shell.tsx
React.useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    // Ignore if typing in input
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    // ⌘K or Ctrl+K for command palette
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setCommandOpen(true);
    }

    // ⌘B or Ctrl+B to toggle sidebar
    if ((e.metaKey || e.ctrlKey) && e.key === "b") {
      e.preventDefault();
      setCollapsed(!collapsed);
    }

    // ⌘[ to collapse, ⌘] to expand
    if ((e.metaKey || e.ctrlKey) && e.key === "[") {
      e.preventDefault();
      setCollapsed(true);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "]") {
      e.preventDefault();
      setCollapsed(false);
    }
  }

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [collapsed, setCollapsed]);
```

### Command Palette Integration

Add a command palette using shadcn/ui Command component:

```typescript
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// In dashboard-shell.tsx
const [commandOpen, setCommandOpen] = React.useState(false);

// Keyboard shortcut
React.useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setCommandOpen(true);
    }
  }
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, []);

// Render
<CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
  <CommandInput placeholder="Type a command or search..." />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Navigation">
      {pages.map((page) => (
        <CommandItem
          key={page.id}
          onSelect={() => {
            router.push(page.href);
            setCommandOpen(false);
          }}
        >
          {page.label}
        </CommandItem>
      ))}
    </CommandGroup>
  </CommandList>
</CommandDialog>
```

### Notifications/Toast Integration

Add toast notifications for user actions:

```typescript
import { toast } from "sonner";

// In sidebar.tsx
async function handleSignOut(): Promise<void> {
  try {
    await fetch("/api/auth/signout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    toast.success("Signed out successfully");
    router.replace("/login");
  } catch (error) {
    console.error("Sign out error:", error);
    toast.error("Failed to sign out");
  }
}

function handleSwitchOrg(org: CurrentOrg): void {
  document.cookie = `${lastOrgCookieName}=${org.slug}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Strict`;

  toast.success(`Switched to ${org.name}`);
  router.push(`/o/${org.slug}/dashboard`);
  if (onNavigate) onNavigate();
}
```

### Multi-Panel Layouts

Add additional panels for advanced layouts:

```typescript
// Three-panel layout: sidebar | main | inspector
<PanelGroup direction="horizontal">
  <Panel defaultSize={20} minSize={15} maxSize={35}>
    <Sidebar {...props} />
  </Panel>

  <PanelResizeHandle className="w-1 bg-border" />

  <Panel defaultSize={60}>
    <main>{children}</main>
  </Panel>

  <PanelResizeHandle className="w-1 bg-border" />

  <Panel defaultSize={20} minSize={15} maxSize={40}>
    <Inspector /> {/* Custom inspector panel */}
  </Panel>
</PanelGroup>
```

### Sidebar Footer Extensions

Add additional footer actions:

```typescript
// In sidebar.tsx, before user menu
<div className="p-3 border-t space-y-2">
  {/* Help & Support */}
  <Button variant="ghost" className="w-full justify-start">
    <HelpCircle className="mr-2 h-4 w-4" />
    Help & Support
  </Button>

  {/* Keyboard shortcuts */}
  <Button
    variant="ghost"
    className="w-full justify-start"
    onClick={() => setShortcutsOpen(true)}
  >
    <Keyboard className="mr-2 h-4 w-4" />
    Keyboard Shortcuts
  </Button>
</div>

{/* User menu below */}
<div className="p-3 border-t">
  {/* Existing user menu */}
</div>
```

## Responsive Enhancements

### Tablet Optimization

Add tablet-specific breakpoints:

```typescript
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      // Mobile: < 768px, Tablet: 768-1024px, Desktop: > 1024px
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

// Add tablet-specific styling
<Panel className="relative max-md:hidden lg:block">
  <Sidebar {...props} />
</Panel>
```

### Touch Gestures

Add swipe to open/close on mobile:

```typescript
import { useSwipeable } from "react-swipeable";

// In dashboard-shell.tsx
const handlers = useSwipeable({
  onSwipedRight: () => {
    if (isMobile) setMobileOpen(true);
  },
  onSwipedLeft: () => {
    if (isMobile) setMobileOpen(false);
  },
  trackMouse: false,
});

<div {...handlers} className="flex h-screen overflow-hidden bg-background">
  {/* Shell content */}
</div>
```

## Performance Optimization

### Memoization

Optimize re-renders with React.memo:

```typescript
export const DashboardShell = React.memo(function DashboardShell({
  userId,
  userEmail,
  sections,
  pages,
  children,
  // ...other props
}: DashboardShellProps) {
  // Component implementation
});

export const Sidebar = React.memo(function Sidebar({
  userEmail,
  sections,
  pages,
  collapsed,
  // ...other props
}: SidebarProps) {
  // Component implementation
});
```

### Lazy Loading

Lazy load heavy components:

```typescript
import dynamic from "next/dynamic";

const CommandPalette = dynamic(() => import("./command-palette"), {
  ssr: false,
});

const QuickActions = dynamic(() => import("./quick-actions"), {
  ssr: false,
});

// Only load when needed
{commandOpen && <CommandPalette />}
{quickActionsOpen && <QuickActions />}
```

### Virtual Scrolling

For very long navigation lists:

```typescript
import { VirtualScroller } from "@/components/ui/virtual-scroller";

<VirtualScroller
  items={allPages}
  itemHeight={40}
  renderItem={(page) => (
    <Link href={page.href}>
      <Button>{page.label}</Button>
    </Link>
  )}
/>
```

## Accessibility Enhancements

### Skip to Content

Add skip link for keyboard navigation:

```typescript
// In dashboard-shell.tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:border focus:rounded"
>
  Skip to content
</a>

<main id="main-content" className="flex-1 overflow-y-auto p-6">
  {children}
</main>
```

### ARIA Labels

Enhance screen reader support:

```typescript
<Button
  variant="ghost"
  size="icon"
  onClick={onToggleCollapse}
  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
>
  {collapsed ? <ChevronRight /> : <ChevronLeft />}
</Button>

<nav aria-label="Main navigation">
  <ScrollArea>
    {/* Navigation items */}
  </ScrollArea>
</nav>
```

### Focus Management

Manage focus when opening/closing drawer:

```typescript
const drawerButtonRef = React.useRef<HTMLButtonElement>(null);

// When closing drawer, return focus
React.useEffect(() => {
  if (!mobileOpen && drawerButtonRef.current) {
    drawerButtonRef.current.focus();
  }
}, [mobileOpen]);

<Button
  ref={drawerButtonRef}
  variant="ghost"
  size="icon"
  onClick={() => setMobileOpen(true)}
>
  <Menu />
</Button>
```

## Testing Considerations

### Component Testing

Test shell behavior with React Testing Library:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { DashboardShell } from "./dashboard-shell";

test("collapses sidebar when button clicked", () => {
  const { container } = render(
    <DashboardShell
      userId="test"
      userEmail="test@example.com"
      sections={[]}
      pages={[]}
    >
      <div>Content</div>
    </DashboardShell>
  );

  const collapseButton = screen.getByRole("button", { name: /collapse/i });
  fireEvent.click(collapseButton);

  // Assert sidebar is collapsed
  expect(container.querySelector(".collapsed")).toBeInTheDocument();
});
```

### E2E Testing

Test navigation flows with Playwright:

```typescript
import { test, expect } from "@playwright/test";

test("navigation works correctly", async ({ page }) => {
  await page.goto("/dashboard");

  // Click sidebar item
  await page.click('text="Analytics"');

  // Verify navigation
  await expect(page).toHaveURL("/analytics");

  // Verify active state
  const activeItem = page.locator('[aria-current="page"]');
  await expect(activeItem).toContainText("Analytics");
});
```
