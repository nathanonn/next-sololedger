/**
 * Dashboard Layout API
 * Save and retrieve user's dashboard widget layout preferences
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, getUserMembership } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { DASHBOARD_WIDGETS } from "@/components/features/dashboard/dashboard-config";

export const runtime = "nodejs";

// Validation schema for dashboard layout
const DashboardLayoutItemSchema = z.object({
  widgetId: z.string(),
  visible: z.boolean(),
  order: z.number(),
});

const DashboardLayoutSchema = z.array(DashboardLayoutItemSchema);

/**
 * POST /api/orgs/[orgSlug]/dashboard/layout
 * Save user's dashboard layout
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string }> }
): Promise<NextResponse> {
  try {
    const { orgSlug } = await context.params;

    // Authenticate
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get organization
    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Verify membership
    const membership = await getUserMembership(user.id, org.id);
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    // Validate API key organization access
    if (!validateApiKeyOrgAccess(user, org.id)) {
      return NextResponse.json(
        { error: "API key not authorized for this organization" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();

    // Handle reset (empty or null layout)
    if (!body.layout || body.layout === null) {
      await db.membership.update({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: org.id,
          },
        },
        data: {
          dashboardLayout: null,
        },
      });

      return NextResponse.json({ success: true, layout: null });
    }

    // Validate layout structure
    const validationResult = DashboardLayoutSchema.safeParse(body.layout);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid layout format", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const layout = validationResult.data;

    // Validate all widget IDs exist in registry
    for (const item of layout) {
      if (!DASHBOARD_WIDGETS[item.widgetId]) {
        return NextResponse.json(
          { error: `Invalid widget ID: ${item.widgetId}` },
          { status: 400 }
        );
      }
    }

    // Save layout to membership
    await db.membership.update({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: org.id,
        },
      },
      data: {
        dashboardLayout: layout,
      },
    });

    return NextResponse.json({ success: true, layout });
  } catch (error) {
    console.error("Dashboard layout save error:", error);
    return NextResponse.json(
      { error: "Failed to save dashboard layout" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orgs/[orgSlug]/dashboard/layout
 * Get user's dashboard layout
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string }> }
): Promise<NextResponse> {
  try {
    const { orgSlug } = await context.params;

    // Authenticate
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get organization
    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get membership with layout
    const membership = await db.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: org.id,
        },
      },
      select: {
        dashboardLayout: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    return NextResponse.json({ layout: membership.dashboardLayout });
  } catch (error) {
    console.error("Dashboard layout fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard layout" },
      { status: 500 }
    );
  }
}
