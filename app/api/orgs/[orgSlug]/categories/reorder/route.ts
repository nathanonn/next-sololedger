import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";
import { z } from "zod";

export const runtime = "nodejs";

const reorderItemSchema = z.object({
  id: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

const reorderSchema = z.object({
  categories: z.array(reorderItemSchema).min(1, "At least one category required"),
});

/**
 * POST /api/orgs/[orgSlug]/categories/reorder
 * Reorder categories within their groups (type + parentId)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgSlug } = await params;

    // Get organization
    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Require membership (members and admins can manage categories)
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = reorderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { categories } = validation.data;

    // Get all categories to verify they belong to the org and to validate grouping
    const categoryIds = categories.map((c) => c.id);
    const dbCategories = await db.category.findMany({
      where: {
        id: { in: categoryIds },
      },
      select: {
        id: true,
        organizationId: true,
        type: true,
        parentId: true,
      },
    });

    // Validate all categories exist
    if (dbCategories.length !== categories.length) {
      return NextResponse.json(
        { error: "One or more categories not found" },
        { status: 404 }
      );
    }

    // Validate all categories belong to this organization
    const invalidCategories = dbCategories.filter(
      (cat) => cat.organizationId !== org.id
    );
    if (invalidCategories.length > 0) {
      return NextResponse.json(
        { error: "All categories must belong to this organization" },
        { status: 400 }
      );
    }

    // Group categories by (type, parentId) to ensure reordering is within groups
    const categoryMap = new Map(dbCategories.map((cat) => [cat.id, cat]));
    const groups = new Map<string, Array<{ id: string; sortOrder: number }>>();

    for (const category of categories) {
      const dbCat = categoryMap.get(category.id);
      if (!dbCat) continue;

      const groupKey = `${dbCat.type}:${dbCat.parentId ?? "null"}`;
      const existing = groups.get(groupKey) || [];
      existing.push({ id: category.id, sortOrder: category.sortOrder });
      groups.set(groupKey, existing);
    }

    // For each group, reassign sortOrder sequentially (0, 1, 2, ...)
    // This ensures no gaps or duplicates and validates sibling-level ordering
    const updates: Array<{ id: string; sortOrder: number }> = [];

    for (const groupCategories of groups.values()) {
      // Sort by the requested sortOrder
      groupCategories.sort((a, b) => a.sortOrder - b.sortOrder);

      // Reassign sequential sortOrder values
      groupCategories.forEach((cat, index) => {
        updates.push({
          id: cat.id,
          sortOrder: index,
        });
      });
    }

    // Perform updates in a transaction
    await db.$transaction(
      updates.map((update) =>
        db.category.update({
          where: { id: update.id },
          data: { sortOrder: update.sortOrder },
        })
      )
    );

    return NextResponse.json({
      message: "Categories reordered successfully",
      updated: categories.length,
    });
  } catch (error) {
    console.error("Error reordering categories:", error);
    return NextResponse.json(
      { error: "Failed to reorder categories" },
      { status: 500 }
    );
  }
}
