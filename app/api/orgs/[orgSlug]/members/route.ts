import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/members
 * List all members of an organization with pagination
 * Requires: Admin or Superadmin role
 * Query params: page (default 1), pageSize (default 20)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
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

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const parsedPage = parseInt(searchParams.get("page") || "1", 10);
    const page = parsedPage > 0 && !isNaN(parsedPage) ? parsedPage : 1;

    const parsedPageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const validPageSizes = [10, 20, 50];
    const pageSize = validPageSizes.includes(parsedPageSize) ? parsedPageSize : 20;

    const excludeSuperadmins = searchParams.get("excludeSuperadmins") === "true";

    // Build where clause for memberships
    const whereClause = excludeSuperadmins
      ? {
          organizationId: org.id,
          user: {
            role: {
              not: "superadmin",
            },
          },
        }
      : { organizationId: org.id };

    // Get members with pagination
    const [memberships, total, adminCount] = await Promise.all([
      db.membership.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.membership.count({
        where: whereClause,
      }),
      db.membership.count({
        where: {
          organizationId: org.id,
          role: "admin",
        },
      }),
    ]);

    const members = memberships.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      joinedAt: m.createdAt,
    }));

    return NextResponse.json({
      members,
      total,
      adminCount,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}
