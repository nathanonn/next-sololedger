import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * POST /api/orgs/[orgSlug]/complete-onboarding
 * Mark onboarding as complete for an organization
 * Validates that all required setup is done
 */
export async function POST(
  request: Request,
  {  params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    // CSRF validation
    const csrfError = await validateCsrf(request);
    if (csrfError) {
      return NextResponse.json({ error: csrfError }, { status: 403 });
    }

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgSlug } = await params;

    // Get organization
    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Require membership
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Validate that at least one income and one expense category exist
    const incomeCategories = await db.category.count({
      where: {
        organizationId: org.id,
        type: "INCOME",
        active: true,
      },
    });

    const expenseCategories = await db.category.count({
      where: {
        organizationId: org.id,
        type: "EXPENSE",
        active: true,
      },
    });

    if (incomeCategories === 0 || expenseCategories === 0) {
      return NextResponse.json(
        {
          error:
            "You need at least one active income and one active expense category to complete onboarding",
        },
        { status: 400 }
      );
    }

    // Mark organization as onboarding complete
    const updatedOrg = await db.organization.update({
      where: { id: org.id },
      data: { onboardingComplete: true },
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: updatedOrg.id,
        slug: updatedOrg.slug,
        onboardingComplete: updatedOrg.onboardingComplete,
      },
    });
  } catch (error) {
    console.error("Error completing onboarding:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
