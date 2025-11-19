import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/user/organizations
 * Get all organizations the current user belongs to
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // If API key auth, return only the scoped organization
    if (user.apiKeyOrganizationId) {
      const org = await db.organization.findUnique({
        where: { id: user.apiKeyOrganizationId },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });

      if (!org) {
        return NextResponse.json(
          { error: "not_found", message: "Organization not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ organizations: [org] }, { status: 200 });
    }

    // Cookie-based auth: return all memberships
    const memberships = await db.membership.findMany({
      where: {
        userId: user.id,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        organization: {
          name: "asc",
        },
      },
    });

    const organizations = memberships.map((m) => m.organization);

    return NextResponse.json({ organizations }, { status: 200 });
  } catch (error) {
    console.error("Get user organizations error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to get organizations" },
      { status: 500 }
    );
  }
}
