import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";
import { z } from "zod";

export const runtime = "nodejs";

const deleteWithReassignmentSchema = z.object({
  replacementCategoryId: z.string().min(1, "Replacement category ID is required"),
});

/**
 * POST /api/orgs/[orgSlug]/categories/[categoryId]/delete-with-reassignment
 * Delete a category and reassign all its transactions to another category
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; categoryId: string }> }
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgSlug, categoryId } = await params;

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
    const validation = deleteWithReassignmentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { replacementCategoryId } = validation.data;

    // Category cannot be reassigned to itself
    if (categoryId === replacementCategoryId) {
      return NextResponse.json(
        { error: "Cannot reassign category to itself" },
        { status: 400 }
      );
    }

    // Get both categories
    const [categoryToDelete, replacementCategory] = await Promise.all([
      db.category.findUnique({
        where: { id: categoryId },
      }),
      db.category.findUnique({
        where: { id: replacementCategoryId },
      }),
    ]);

    // Validate category to delete exists and belongs to org
    if (!categoryToDelete || categoryToDelete.organizationId !== org.id) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Validate replacement category exists and belongs to org
    if (
      !replacementCategory ||
      replacementCategory.organizationId !== org.id
    ) {
      return NextResponse.json(
        { error: "Replacement category not found" },
        { status: 404 }
      );
    }

    // Both categories must be active
    if (!categoryToDelete.active || !replacementCategory.active) {
      return NextResponse.json(
        { error: "Both categories must be active" },
        { status: 400 }
      );
    }

    // Types must match (INCOME vs EXPENSE)
    if (categoryToDelete.type !== replacementCategory.type) {
      return NextResponse.json(
        {
          error: `Category types must match. Cannot reassign ${categoryToDelete.type} to ${replacementCategory.type}`,
        },
        { status: 400 }
      );
    }

    // Perform reassignment and deletion in a transaction
    const result = await db.$transaction(async (tx) => {
      // Reassign all transactions to the replacement category
      const updateResult = await tx.transaction.updateMany({
        where: {
          organizationId: org.id,
          categoryId: categoryToDelete.id,
        },
        data: {
          categoryId: replacementCategoryId,
        },
      });

      // Hard delete the category
      await tx.category.delete({
        where: { id: categoryToDelete.id },
      });

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          action: "category.delete_with_reassignment",
          userId: user.id,
          email: user.email,
          organizationId: org.id,
          metadata: {
            deletedCategoryId: categoryToDelete.id,
            deletedCategoryName: categoryToDelete.name,
            deletedCategoryType: categoryToDelete.type,
            replacementCategoryId: replacementCategory.id,
            replacementCategoryName: replacementCategory.name,
            reassignedCount: updateResult.count,
          },
        },
      });

      return {
        reassignedCount: updateResult.count,
      };
    });

    return NextResponse.json({
      message: "Category deleted and transactions reassigned",
      ...result,
    });
  } catch (error) {
    console.error("Error deleting category with reassignment:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
