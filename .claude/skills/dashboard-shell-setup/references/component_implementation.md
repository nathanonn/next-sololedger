# Component Implementation

Complete implementation code for the dashboard shell components.

## File Structure

```
components/features/dashboard/
├── dashboard-shell.tsx    # Main shell with resizable panels
└── sidebar.tsx            # Two-level navigation sidebar
```

## DashboardShell Component

**Location:** `components/features/dashboard/dashboard-shell.tsx`

This is the main client component that provides the resizable panel layout, mobile drawer, and top bar.

```typescript
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";

/**
 * Dashboard shell with resizable sidebar
 * Implements the pattern from dashboard_shell.md
 */

const DEFAULT_WIDTH = 20;
const MIN_WIDTH = 15;
const MAX_WIDTH = 35;
const COLLAPSED_WIDTH = 4;

export type Section = {
  id: string;
  label: string;
  icon?: React.ReactNode;
};

export type Page = {
  id: string;
  label: string;
  href: string;
  badgeCount?: number;
  sectionId: string;
};

export type CurrentOrg = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export type DashboardShellProps = {
  userId: string;
  userEmail: string;
  sections: Section[];
  pages: Page[];
  children: React.ReactNode;
  currentOrg?: CurrentOrg;
  lastOrgCookieName?: string;
  defaultOrgSlug?: string;
  canCreateOrganizations?: boolean;
  isSuperadmin?: boolean;
};

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

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

export function DashboardShell({
  userId,
  userEmail,
  sections,
  pages,
  children,
  currentOrg,
  lastOrgCookieName = "__last_org",
  defaultOrgSlug,
  canCreateOrganizations = false,
  isSuperadmin = false,
}: DashboardShellProps): React.JSX.Element {
  const isMobile = useIsMobile();
  const pathname = usePathname();

  const [width, setWidth] = useLocalStorage<number>(
    `app.v1.sidebar.width:${userId}`,
    DEFAULT_WIDTH
  );

  const [collapsed, setCollapsed] = useLocalStorage<boolean>(
    `app.v1.sidebar.collapsed:${userId}`,
    false
  );

  const [mobileOpen, setMobileOpen] = React.useState(false);

  const effectiveCollapsed = isMobile ? false : collapsed;

  // Close mobile drawer on navigation
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-80 md:hidden">
          <Sidebar
            userId={userId}
            userEmail={userEmail}
            sections={sections}
            pages={pages}
            collapsed={false}
            currentOrg={currentOrg}
            lastOrgCookieName={lastOrgCookieName}
            defaultOrgSlug={defaultOrgSlug}
            canCreateOrganizations={canCreateOrganizations}
            isSuperadmin={isSuperadmin}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Desktop Layout */}
      <PanelGroup
        direction="horizontal"
        onLayout={(sizes) => {
          if (!effectiveCollapsed && sizes[0]) {
            setWidth(sizes[0]);
          }
        }}
        className="flex-1"
      >
        {/* Sidebar Panel */}
        <Panel
          defaultSize={effectiveCollapsed ? COLLAPSED_WIDTH : width}
          minSize={effectiveCollapsed ? COLLAPSED_WIDTH : MIN_WIDTH}
          maxSize={effectiveCollapsed ? COLLAPSED_WIDTH : MAX_WIDTH}
          className="relative max-md:hidden"
        >
          <Sidebar
            userId={userId}
            userEmail={userEmail}
            sections={sections}
            pages={pages}
            collapsed={effectiveCollapsed}
            currentOrg={currentOrg}
            lastOrgCookieName={lastOrgCookieName}
            defaultOrgSlug={defaultOrgSlug}
            canCreateOrganizations={canCreateOrganizations}
            isSuperadmin={isSuperadmin}
            onToggleCollapse={() => setCollapsed(!collapsed)}
          />
        </Panel>

        {/* Resize Handle */}
        {!effectiveCollapsed && (
          <PanelResizeHandle className="w-1 bg-border hover:bg-accent transition-colors max-md:hidden" />
        )}

        {/* Main Content Panel */}
        <Panel defaultSize={effectiveCollapsed ? 96 : 80 - width}>
          <div className="h-full flex flex-col">
            {/* Top Bar */}
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
              {/* Right-side actions placeholder */}
              <div className="flex items-center gap-2">
                {/* Add Quick Actions, notifications, etc. here */}
              </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-6">
              {children}
            </main>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
```

### Key Features

**LocalStorage Persistence:**
- Sidebar width stored per user: `app.v1.sidebar.width:${userId}`
- Collapsed state stored per user: `app.v1.sidebar.collapsed:${userId}`
- State persists across sessions and page navigations

**Responsive Behavior:**
- Desktop: Resizable sidebar with collapse toggle
- Mobile: Sidebar in left drawer (Sheet)
- Automatic mobile detection via `useIsMobile` hook

**Panel Configuration:**
- Default width: 20% of viewport
- Min width: 15%, Max width: 35%
- Collapsed width: ~4% (icon-only rail)
- Smooth resize with drag handle

## Sidebar Component

**Location:** `components/features/dashboard/sidebar.tsx`

This component renders the two-level navigation (Sections → Pages) with support for both expanded and collapsed states.

```typescript
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  Building2,
  Plus,
  Settings,
  Users,
  LayoutDashboard,
} from "lucide-react";
import type { Section, Page, CurrentOrg } from "./dashboard-shell";

/**
 * Sidebar with two-level navigation (Sections → Pages)
 * Supports collapsed and expanded states
 */

type UserMenuContentProps = {
  userEmail: string;
  currentOrg?: CurrentOrg;
  organizations: CurrentOrg[];
  isSuperadmin: boolean;
  canCreateOrganizations: boolean;
  lastOrgSlug: string | null;
  defaultOrgSlug?: string;
  pathname: string | null;
  router: ReturnType<typeof useRouter>;
  handleSignOut: () => Promise<void>;
  handleSwitchOrg: (org: CurrentOrg) => void;
  handleCreateOrg: () => void;
};

/**
 * Reusable user menu content for both collapsed and expanded sidebar states
 */
function UserMenuContent({
  userEmail,
  currentOrg,
  organizations,
  isSuperadmin,
  canCreateOrganizations,
  lastOrgSlug,
  defaultOrgSlug,
  pathname,
  router,
  handleSignOut,
  handleSwitchOrg,
  handleCreateOrg,
}: UserMenuContentProps): React.JSX.Element {
  return (
    <>
      <DropdownMenuLabel className="font-normal">
        <div className="flex flex-col space-y-1">
          <p className="text-sm font-medium leading-none">Account</p>
          <p className="text-xs leading-none text-muted-foreground truncate">
            {userEmail}
          </p>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => {
          const profileUrl = currentOrg
            ? `/o/${currentOrg.slug}/settings/profile`
            : "/settings/profile";
          router.push(profileUrl);
        }}
      >
        <User className="mr-2 h-4 w-4" />
        Profile
      </DropdownMenuItem>
      {currentOrg && (
        <DropdownMenuItem
          onClick={() =>
            router.push(`/o/${currentOrg.slug}/settings/organization`)
          }
        >
          <Settings className="mr-2 h-4 w-4" />
          Organization
        </DropdownMenuItem>
      )}
      {currentOrg &&
        (currentOrg.role === "admin" || currentOrg.role === "superadmin") && (
          <DropdownMenuItem
            onClick={() =>
              router.push(`/o/${currentOrg.slug}/settings/members`)
            }
          >
            <Users className="mr-2 h-4 w-4" />
            Members
          </DropdownMenuItem>
        )}
      {isSuperadmin &&
        pathname?.startsWith("/admin") &&
        (lastOrgSlug || defaultOrgSlug) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                router.push(
                  `/o/${lastOrgSlug || defaultOrgSlug}/dashboard`
                )
              }
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Back to Organization Dashboard
            </DropdownMenuItem>
          </>
        )}
      {(isSuperadmin || currentOrg?.role === "superadmin") && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => router.push("/admin/organizations")}
          >
            <Building2 className="mr-2 h-4 w-4" />
            Manage Organizations
          </DropdownMenuItem>
        </>
      )}
      {currentOrg && organizations.length > 1 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
          {organizations
            .filter((org) => org.id !== currentOrg.id)
            .map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => handleSwitchOrg(org)}
              >
                <Building2 className="mr-2 h-4 w-4" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{org.name}</div>
                </div>
              </DropdownMenuItem>
            ))}
        </>
      )}
      {currentOrg && canCreateOrganizations && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCreateOrg}>
            <Plus className="mr-2 h-4 w-4" />
            Create Organization
          </DropdownMenuItem>
        </>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={handleSignOut}>
        <LogOut className="mr-2 h-4 w-4" />
        Sign out
      </DropdownMenuItem>
    </>
  );
}

export type SidebarProps = {
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

export function Sidebar({
  userEmail,
  sections,
  pages,
  collapsed,
  currentOrg,
  lastOrgCookieName = "__last_org",
  defaultOrgSlug,
  canCreateOrganizations = false,
  isSuperadmin = false,
  onToggleCollapse,
  onNavigate,
}: SidebarProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();

  const [organizations, setOrganizations] = React.useState<CurrentOrg[]>([]);
  const [lastOrgSlug, setLastOrgSlug] = React.useState<string | null>(null);

  // Read last org cookie for "Back to Organization Dashboard" link
  React.useEffect(() => {
    if (isSuperadmin && pathname?.startsWith("/admin") && lastOrgCookieName) {
      const cookies = document.cookie.split("; ");
      const lastOrgCookie = cookies.find((c) =>
        c.startsWith(`${lastOrgCookieName}=`)
      );
      if (lastOrgCookie) {
        const slug = lastOrgCookie.split("=")[1];
        setLastOrgSlug(slug || null);
      } else {
        setLastOrgSlug(null);
      }
    } else {
      setLastOrgSlug(null);
    }
  }, [isSuperadmin, pathname, lastOrgCookieName]);

  // Fetch user's organizations when currentOrg is available
  React.useEffect(() => {
    if (!currentOrg) return;

    async function fetchOrganizations() {
      try {
        const response = await fetch("/api/orgs");
        if (response.ok) {
          const data = await response.json();
          setOrganizations(
            data.organizations.map((org: {
              id: string;
              name: string;
              slug: string;
              role: string;
            }) => ({
              id: org.id,
              name: org.name,
              slug: org.slug,
              role: org.role,
            }))
          );
        }
      } catch (error) {
        console.error("Error fetching organizations:", error);
      }
    }

    fetchOrganizations();
  }, [currentOrg]);

  // Group pages by section
  const pagesBySection = React.useMemo(() => {
    const grouped = new Map<string, Page[]>();
    pages.forEach((page) => {
      const existing = grouped.get(page.sectionId) || [];
      grouped.set(page.sectionId, [...existing, page]);
    });
    return grouped;
  }, [pages]);

  async function handleSignOut(): Promise<void> {
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      router.replace("/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }

  function handleSwitchOrg(org: CurrentOrg): void {
    document.cookie = `${lastOrgCookieName}=${org.slug}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Strict`;
    router.push(`/o/${org.slug}/dashboard`);
    if (onNavigate) onNavigate();
  }

  function handleCreateOrg(): void {
    router.push("/onboarding/create-organization");
    if (onNavigate) onNavigate();
  }

  const userInitial = userEmail.charAt(0).toUpperCase();

  if (collapsed) {
    // Collapsed (icon-only) mode
    return (
      <div className="h-full flex flex-col border-r bg-background">
        {/* Header */}
        <div className="p-4 flex items-center justify-center border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1">
          <div className="py-4 space-y-1">
            {sections.map((section) => {
              const sectionPages = pagesBySection.get(section.id) || [];
              return (
                <div key={section.id} className="px-2 space-y-1">
                  {sectionPages.map((page) => {
                    const isActive = pathname === page.href;
                    return (
                      <Link key={page.id} href={page.href} onClick={onNavigate}>
                        <Button
                          variant={isActive ? "secondary" : "ghost"}
                          size="icon"
                          className={cn(
                            "w-full h-10 relative",
                            isActive && "bg-secondary"
                          )}
                          title={page.label}
                        >
                          <span className="text-sm font-medium">
                            {page.label.charAt(0)}
                          </span>
                          {page.badgeCount && page.badgeCount > 0 && (
                            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
                          )}
                        </Button>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer - User Menu */}
        <div className="p-2 border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-full h-10">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-56">
              <UserMenuContent
                userEmail={userEmail}
                currentOrg={currentOrg}
                organizations={organizations}
                isSuperadmin={isSuperadmin}
                canCreateOrganizations={canCreateOrganizations}
                lastOrgSlug={lastOrgSlug}
                defaultOrgSlug={defaultOrgSlug}
                pathname={pathname}
                router={router}
                handleSignOut={handleSignOut}
                handleSwitchOrg={handleSwitchOrg}
                handleCreateOrg={handleCreateOrg}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  // Expanded mode
  return (
    <div className="h-full flex flex-col border-r bg-background">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b">
        <div className="flex-1 min-w-0">
          {currentOrg ? (
            <div>
              <h2 className="text-lg font-semibold truncate">
                {currentOrg.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {currentOrg.role === "superadmin"
                  ? "Superadmin"
                  : currentOrg.role === "admin"
                    ? "Admin"
                    : "Member"}
              </p>
            </div>
          ) : (
            <h2 className="text-lg font-semibold">App</h2>
          )}
        </div>
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="h-8 w-8 flex-shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div className="py-4 px-3 space-y-6">
          {sections.map((section) => {
            const sectionPages = pagesBySection.get(section.id) || [];
            if (sectionPages.length === 0) return null;

            return (
              <div key={section.id} className="space-y-1">
                <div className="px-3 py-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {section.label}
                  </h3>
                </div>
                {sectionPages.map((page) => {
                  const isActive = pathname === page.href;
                  return (
                    <Link key={page.id} href={page.href} onClick={onNavigate}>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start",
                          isActive && "bg-secondary font-medium"
                        )}
                      >
                        <span className="flex-1 text-left">{page.label}</span>
                        {page.badgeCount && page.badgeCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground px-1.5">
                            {page.badgeCount}
                          </span>
                        )}
                      </Button>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer - User Menu */}
      <div className="p-3 border-t">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start h-auto py-2"
            >
              <Avatar className="h-8 w-8 mr-3">
                <AvatarFallback>{userInitial}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start flex-1 min-w-0">
                <span className="text-sm font-medium truncate w-full text-left">
                  Account
                </span>
                <span className="text-xs text-muted-foreground truncate w-full text-left">
                  {userEmail}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-56">
            <UserMenuContent
              userEmail={userEmail}
              currentOrg={currentOrg}
              organizations={organizations}
              isSuperadmin={isSuperadmin}
              canCreateOrganizations={canCreateOrganizations}
              lastOrgSlug={lastOrgSlug}
              defaultOrgSlug={defaultOrgSlug}
              pathname={pathname}
              router={router}
              handleSignOut={handleSignOut}
              handleSwitchOrg={handleSwitchOrg}
              handleCreateOrg={handleCreateOrg}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
```

### Key Features

**Two-Level Navigation:**
- Sections contain Pages (e.g., "Main" → "Dashboard", "Settings" → "Profile")
- Pages grouped by `sectionId` using memoized Map
- Active page highlighting based on pathname

**Collapsed Mode:**
- Icon-only buttons showing first letter of page label
- Badge indicators as small dots
- Tooltips on hover (via `title` attribute)
- Expand button in header

**Expanded Mode:**
- Full labels and section headers
- Badge counts displayed as pill elements
- Organization name/role in header
- Collapse button in header

**User Menu:**
- Reusable `UserMenuContent` component for both modes
- Profile, Organization, Members links (role-based)
- Organization switcher (when multiple orgs)
- Create organization option (when allowed)
- Superadmin features (admin dashboard access)
- Sign out functionality

**Organization Support:**
- Fetches user's organizations via `/api/orgs`
- Organization switcher with cookie persistence
- Role-based menu item visibility
- Superadmin bypass capabilities

## Utils Required

The components use a `cn` utility for className merging. Create `lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Install dependencies:
```bash
npm install clsx tailwind-merge
```
