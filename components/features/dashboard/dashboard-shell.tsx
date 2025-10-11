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

export type DashboardShellProps = {
  userId: string;
  userEmail: string;
  sections: Section[];
  pages: Page[];
  children: React.ReactNode;
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
}: DashboardShellProps): JSX.Element {
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
