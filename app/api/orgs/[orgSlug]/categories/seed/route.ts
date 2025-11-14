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

    // Create default categories (tailored for solopreneurs, freelancers, agencies)
    const defaultCategories = [
      // Income categories
      {
        name: "Service Revenue",
        type: "INCOME" as const,
        includeInPnL: true,
        sortOrder: 0,
      },
      {
        name: "Consulting Income",
        type: "INCOME" as const,
        includeInPnL: true,
        sortOrder: 1,
      },
      {
        name: "Product Sales",
        type: "INCOME" as const,
        includeInPnL: true,
        sortOrder: 2,
      },
      {
        name: "Recurring Revenue",
        type: "INCOME" as const,
        includeInPnL: true,
        sortOrder: 3,
      },
      {
        name: "Affiliate Income",
        type: "INCOME" as const,
        includeInPnL: true,
        sortOrder: 4,
      },
      {
        name: "Other Income",
        type: "INCOME" as const,
        includeInPnL: true,
        sortOrder: 5,
      },
      {
        name: "Tax Collected",
        type: "INCOME" as const,
        includeInPnL: true,
        sortOrder: 6,
      },
      {
        name: "Owner Contributions",
        type: "INCOME" as const,
        includeInPnL: false,
        sortOrder: 7,
      },
      {
        name: "Transfers In",
        type: "INCOME" as const,
        includeInPnL: false,
        sortOrder: 8,
      },
      // Expense categories
      {
        name: "Software & Subscriptions",
        type: "EXPENSE" as const,
        includeInPnL: true,
        sortOrder: 0,
      },
      {
        name: "Professional Services",
        type: "EXPENSE" as const,
        includeInPnL: true,
        sortOrder: 1,
      },
      {
        name: "Marketing & Advertising",
        type: "EXPENSE" as const,
        includeInPnL: true,
        sortOrder: 2,
      },
      {
        name: "Office & Workspace",
        type: "EXPENSE" as const,
        includeInPnL: true,
        sortOrder: 3,
      },
      {
        name: "Equipment & Tech",
        type: "EXPENSE" as const,
        includeInPnL: true,
        sortOrder: 4,
      },
      {
        name: "Education & Training",
        type: "EXPENSE" as const,
        includeInPnL: true,
        sortOrder: 5,
      },
      {
        name: "Contractor Payments",
        type: "EXPENSE" as const,
        includeInPnL: true,
        sortOrder: 6,
      },
      {
        name: "Travel & Meals",
        type: "EXPENSE" as const,
        includeInPnL: true,
        sortOrder: 7,
      },
      {
        name: "Insurance",
        type: "EXPENSE" as const,
        includeInPnL: true,
        sortOrder: 8,
      },
      {
        name: "Taxes & Licenses",
        type: "EXPENSE" as const,
        includeInPnL: true,
        sortOrder: 9,
      },
      {
        name: "Other Expenses",
        type: "EXPENSE" as const,
        includeInPnL: true,
        sortOrder: 10,
      },
      {
        name: "Owner Drawings",
        type: "EXPENSE" as const,
        includeInPnL: false,
        sortOrder: 11,
      },
      {
        name: "Transfers Out",
        type: "EXPENSE" as const,
        includeInPnL: false,
        sortOrder: 12,
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
