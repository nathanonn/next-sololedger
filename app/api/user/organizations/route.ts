import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/user/organizations
 * Get all organizations the current user belongs to
 */
export async function GET(): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // Get all memberships with organization details
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
