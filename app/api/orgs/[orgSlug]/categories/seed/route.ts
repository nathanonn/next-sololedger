import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * POST /api/orgs/[orgSlug]/categories/seed
 * Seed default categories for an organization
 * Only creates if no categories exist yet
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

    const user = await getCurrentUser();
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

    // Check if categories already exist
    const existingCount = await db.category.count({
      where: { organizationId: org.id },
    });

    if (existingCount > 0) {
      return NextResponse.json({
        message: "Categories already exist",
        seeded: false,
      });
    }

    // Create default categories
    const defaultCategories = [
      // Income categories
      {
        name: "General Income",
        type: "INCOME" as const,
        includeInPnL: true,
        sortOrder: 0,
      },
      {
        name: "Tax Collected",
        type: "INCOME" as const,
        includeInPnL: true,
        sortOrder: 1,
      },
      {
        name: "Owner Contributions",
        type: "INCOME" as const,
        includeInPnL: false,
        sortOrder: 2,
      },
      {
        name: "Transfers In",
        type: "INCOME" as const,
        includeInPnL: false,
        sortOrder: 3,
      },
      // Expense categories
      {
        name: "General Expense",
        type: "EXPENSE" as const,
        includeInPnL: true,
        sortOrder: 0,
      },
      {
        name: "Tax Paid",
        type: "EXPENSE" as const,
        includeInPnL: true,
        sortOrder: 1,
      },
      {
        name: "Owner Drawings",
        type: "EXPENSE" as const,
        includeInPnL: false,
        sortOrder: 2,
      },
      {
        name: "Transfers Out",
        type: "EXPENSE" as const,
        includeInPnL: false,
        sortOrder: 3,
      },
    ];

    // Create all categories in a transaction
    await db.$transaction(
      defaultCategories.map((cat) =>
        db.category.create({
          data: {
            organizationId: org.id,
            name: cat.name,
            type: cat.type,
            includeInPnL: cat.includeInPnL,
            sortOrder: cat.sortOrder,
            active: true,
          },
        })
      )
    );

    return NextResponse.json({
      message: "Default categories created",
      seeded: true,
      count: defaultCategories.length,
    });
  } catch (error) {
    console.error("Error seeding categories:", error);
    return NextResponse.json(
      { error: "Failed to seed categories" },
      { status: 500 }
    );
  }
}
