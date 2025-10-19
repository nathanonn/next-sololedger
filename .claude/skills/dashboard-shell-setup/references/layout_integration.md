# Layout Integration Guide

Step-by-step guide for integrating the dashboard shell into your Next.js application's server layouts.

## Overview

The dashboard shell follows a server-first pattern:
1. **Server Layout** - Fetches user data and navigation structure
2. **Client Shell** - Renders the UI with resizable panels and sidebar
3. **Page Content** - Rendered as children inside the shell

## Server Layout Implementation

### Basic Protected Layout

Create a server layout that fetches user data and renders the dashboard shell.

**Location:** `app/(protected)/layout.tsx`

```typescript
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { DashboardShell } from "@/components/features/dashboard/dashboard-shell";
import { Home, Settings } from "lucide-react";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  // Validate session
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Define sections
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

  // Define pages
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

### Organization-Scoped Layout

For multi-tenant applications with organization context.

**Location:** `app/o/[orgSlug]/layout.tsx`

```typescript
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, getUserMembership, isSuperadmin } from "@/lib/org-helpers";
import { DashboardShell } from "@/components/features/dashboard/dashboard-shell";
import { env } from "@/lib/env";
import { Home, Settings, Users } from "lucide-react";
import { db } from "@/lib/db";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}): Promise<React.JSX.Element> {
  const { orgSlug } = await params;

  // Validate session
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/o/${orgSlug}`);
  }

  // Get organization
  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    redirect("/");
  }

  // Check if user is superadmin
  const userIsSuperadmin = await isSuperadmin(user.id);

  // Check membership (superadmins bypass)
  const membership = await getUserMembership(user.id, org.id);
  if (!membership && !userIsSuperadmin) {
    redirect("/?error=not_a_member");
  }

  // Determine user's role
  const userRole = userIsSuperadmin ? "superadmin" : membership?.role || "member";
  const isAdminOrSuperadmin = userRole === "admin" || userRole === "superadmin";

  // Compute canCreateOrganizations
  let canCreateOrganizations = false;
  if (userIsSuperadmin) {
    canCreateOrganizations = true;
  } else if (env.ORG_CREATION_ENABLED) {
    const orgCount = await db.organization.count({
      where: { createdById: user.id },
    });
    canCreateOrganizations = orgCount < env.ORG_CREATION_LIMIT;
  }

  // Define sections
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

  // Build all pages
  const allPages = [
    {
      id: "dashboard",
      label: "Dashboard",
      href: `/o/${orgSlug}/dashboard`,
      sectionId: "main",
    },
    {
      id: "profile",
      label: "Profile",
      href: `/o/${orgSlug}/settings/profile`,
      sectionId: "settings",
    },
    {
      id: "organization",
      label: "Organization",
      href: `/o/${orgSlug}/settings/organization`,
      sectionId: "settings",
      adminOnly: true,
    },
    {
      id: "members",
      label: "Members",
      href: `/o/${orgSlug}/settings/members`,
      sectionId: "settings",
      icon: <Users className="h-4 w-4" />,
      adminOnly: true,
    },
  ];

  // Filter pages based on role
  const pages = allPages.filter((page) => {
    if (page.adminOnly && !isAdminOrSuperadmin) {
      return false;
    }
    return true;
  });

  return (
    <DashboardShell
      userId={user.id}
      userEmail={user.email}
      sections={sections}
      pages={pages}
      currentOrg={{
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: userRole,
      }}
      lastOrgCookieName={env.LAST_ORG_COOKIE_NAME}
      canCreateOrganizations={canCreateOrganizations}
      isSuperadmin={userIsSuperadmin}
    >
      {children}
    </DashboardShell>
  );
}
```

## Dynamic Navigation Patterns

### Role-Based Filtering

Filter pages based on user roles or permissions:

```typescript
// Define pages with role requirements
type PageWithRole = Page & {
  adminOnly?: boolean;
  permissions?: string[];
};

const allPages: PageWithRole[] = [
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
    sectionId: "main",
    permissions: ["view_analytics"],
  },
  {
    id: "admin",
    label: "Admin Panel",
    href: "/admin",
    sectionId: "settings",
    adminOnly: true,
  },
];

// Filter based on user role
const pages = allPages.filter((page) => {
  if (page.adminOnly && !user.isAdmin) return false;
  if (page.permissions && !hasPermissions(user, page.permissions)) return false;
  return true;
});
```

### Dynamic Badge Counts

Add notification or unread counts to pages:

```typescript
// Fetch counts from database
const unreadMessages = await db.message.count({
  where: { recipientId: user.id, readAt: null },
});

const pendingTasks = await db.task.count({
  where: { assigneeId: user.id, status: "pending" },
});

// Add counts to pages
const pages = [
  {
    id: "messages",
    label: "Messages",
    href: "/messages",
    sectionId: "main",
    badgeCount: unreadMessages,
  },
  {
    id: "tasks",
    label: "Tasks",
    href: "/tasks",
    sectionId: "main",
    badgeCount: pendingTasks,
  },
];
```

### Database-Driven Navigation

Fetch navigation structure from database:

```typescript
// Fetch sections and pages from database
const dbSections = await db.navSection.findMany({
  where: { enabled: true },
  orderBy: { order: "asc" },
});

const dbPages = await db.navPage.findMany({
  where: { enabled: true },
  orderBy: { order: "asc" },
});

// Transform to required format
const sections = dbSections.map((section) => ({
  id: section.id,
  label: section.label,
  icon: getIconComponent(section.iconName), // Helper to get Lucide icon
}));

const pages = dbPages.map((page) => ({
  id: page.id,
  label: page.label,
  href: page.href,
  sectionId: page.sectionId,
  badgeCount: page.showBadge ? getBadgeCount(page.id) : undefined,
}));
```

## Helper Functions

### getCurrentUser

Fetch and validate the current user's session:

```typescript
// lib/auth-helpers.ts
import { cookies } from "next/headers";
import { db } from "./db";
import { verifyToken } from "./jwt";
import { env } from "./env";

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(env.JWT_ACCESS_COOKIE_NAME)?.value;
    const refreshToken = cookieStore.get(env.JWT_REFRESH_COOKIE_NAME)?.value;

    if (!accessToken && !refreshToken) return null;

    const token = accessToken || refreshToken;
    if (!token) return null;

    const payload = await verifyToken(token);

    const user = await db.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.sessionVersion !== payload.tokenVersion) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}
```

### Organization Helpers

Helper functions for multi-tenant applications:

```typescript
// lib/org-helpers.ts
import { db } from "./db";

export async function getOrgBySlug(slug: string) {
  return db.organization.findUnique({
    where: { slug },
  });
}

export async function getUserMembership(userId: string, orgId: string) {
  return db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: orgId,
      },
    },
  });
}

export async function isSuperadmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "superadmin";
}
```

## Environment Configuration

Required environment variables for multi-tenant features:

```bash
# .env
LAST_ORG_COOKIE_NAME=__last_org
ORG_CREATION_ENABLED=false
ORG_CREATION_LIMIT=1
```

Environment validation (lib/env.ts):

```typescript
import { z } from "zod";

const envSchema = z.object({
  LAST_ORG_COOKIE_NAME: z.string().default("__last_org"),
  ORG_CREATION_ENABLED: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  ORG_CREATION_LIMIT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default("1"),
  // ... other env vars
});

export const env = envSchema.parse(process.env);
```

## API Endpoints

### Organization List Endpoint

Required for organization switcher functionality:

**Location:** `app/api/orgs/route.ts`

```typescript
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's organizations
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  const organizations = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
  }));

  // If user is superadmin, include all organizations
  if (user.role === "superadmin") {
    const allOrgs = await db.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    // Add any missing orgs with superadmin role
    allOrgs.forEach((org) => {
      if (!organizations.find((o) => o.id === org.id)) {
        organizations.push({
          id: org.id,
          name: org.name,
          slug: org.slug,
          role: "superadmin",
        });
      }
    });
  }

  return Response.json({ organizations });
}
```

## Route Groups

Organize routes using Next.js route groups:

```
app/
├── (public)/              # Public routes (no shell)
│   └── login/
├── (protected)/           # Protected routes with basic shell
│   ├── layout.tsx        # DashboardShell wrapper
│   └── dashboard/
└── o/[orgSlug]/           # Organization-scoped routes
    ├── layout.tsx         # DashboardShell with org context
    ├── dashboard/
    └── settings/
```

## Best Practices

### Server-Side Data Fetching

**Do:**
- Fetch user data in server layouts
- Query database in Node.js runtime
- Pass serializable props to client components
- Handle redirects for unauthorized access

**Don't:**
- Import server-only code in client components
- Fetch data in client components when it can be done server-side
- Expose sensitive data to client bundles

### Navigation Structure

**Do:**
- Keep navigation flat (2 levels max for this implementation)
- Use meaningful section and page IDs
- Provide clear, concise labels
- Add icons to improve scannability

**Don't:**
- Create deeply nested navigation (requires tree implementation)
- Use long page labels (they truncate in collapsed mode)
- Forget to filter pages by user permissions

### Performance

**Do:**
- Use React.memo for expensive components
- Memoize page grouping logic
- Lazy load heavy features (command palette, etc.)
- Keep server layout queries efficient

**Don't:**
- Fetch all user data upfront
- Re-render entire shell on state changes
- Block rendering waiting for badge counts

## Troubleshooting

### User menu not showing organizations

**Problem:** Organization switcher is empty
**Solution:** Ensure `/api/orgs` endpoint is implemented and returns correct data

### Pages not filtered by role

**Problem:** Admin-only pages visible to regular users
**Solution:** Verify filtering logic in server layout before passing to shell

### Redirect loop on protected routes

**Problem:** Continuously redirecting to login
**Solution:** Check `getCurrentUser()` implementation and middleware configuration

### Sidebar width not persisting

**Problem:** Sidebar resets to default width on refresh
**Solution:** Verify `userId` prop is consistent and localStorage is available
