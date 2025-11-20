import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { env } from "@/lib/env";
import { isIntegrationAllowed } from "@/lib/integrations/providers";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/integrations/linkedin/analytics
 * Get basic LinkedIn analytics (recent posts)
 * Note: Advanced analytics require Marketing Developer Program approval
 * Requires: Admin or Superadmin role, linkedin enabled
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    if (!env.INTEGRATIONS_ENABLED) {
      return NextResponse.json(
        { error: "Integrations are disabled" },
        { status: 404 }
      );
    }

    // Verify linkedin is enabled
    if (!isIntegrationAllowed("linkedin")) {
      return NextResponse.json(
        { error: "LinkedIn integration is not enabled" },
        { status: 400 }
      );
    }

    const { orgSlug } = await params;
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Verify user is admin or superadmin
    try {
      await requireAdminOrSuperadmin(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Admin or superadmin access required" },
        { status: 403 }
      );
    }

    // Note: LinkedIn's UGC Posts API has limited analytics without Marketing Developer Program
    // We can fetch recent posts, but detailed metrics (likes, comments, shares) may be restricted

    // For now, return a basic response indicating limited analytics
    // In the future, with Marketing Developer Program approval, we can fetch:
    // - /organizationalEntityShareStatistics for detailed metrics
    // - /ugcPosts with author filter for recent posts

    return NextResponse.json({
      ok: true,
      analytics: {
        note: "Basic analytics available. Advanced metrics require Marketing Developer Program approval.",
        recentPosts: [],
      },
      message: "LinkedIn analytics endpoint ready. Contact your administrator to enable advanced analytics.",
    });
  } catch (error) {
    console.error("Error fetching LinkedIn analytics:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch analytics";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
