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

export type SidebarProps = {
  userId: string;
  userEmail: string;
  sections: Section[];
  pages: Page[];
  collapsed: boolean;
  currentOrg?: CurrentOrg;
  lastOrgCookieName?: string;
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
    if (isSuperadmin && pathname?.startsWith('/admin') && lastOrgCookieName) {
      // Read cookie client-side
      const cookies = document.cookie.split('; ');
      const lastOrgCookie = cookies.find(c => c.startsWith(`${lastOrgCookieName}=`));
      if (lastOrgCookie) {
        const slug = lastOrgCookie.split('=')[1];
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
            data.organizations.map(
              (org: {
                id: string;
                name: string;
                slug: string;
                role: string;
              }) => ({
                id: org.id,
                name: org.name,
                slug: org.slug,
                role: org.role,
              })
            )
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
    // Set last_org cookie and navigate (using configured cookie name)
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
                (currentOrg.role === "admin" ||
                  currentOrg.role === "superadmin") && (
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(`/o/${currentOrg.slug}/settings/members`)
                    }
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Members
                  </DropdownMenuItem>
                )}
              {isSuperadmin && pathname?.startsWith('/admin') && lastOrgSlug && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => router.push(`/o/${lastOrgSlug}/dashboard`)}
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
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
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
            {currentOrg &&
              (currentOrg.role === "admin" ||
                currentOrg.role === "superadmin") && (
                <>
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(`/o/${currentOrg.slug}/settings/organization`)
                    }
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Organization
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(`/o/${currentOrg.slug}/settings/members`)
                    }
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Members
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
