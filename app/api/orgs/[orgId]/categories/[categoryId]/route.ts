import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";
import { requireMembership } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * PATCH /api/orgs/[orgId]/categories/[categoryId]
 * Update a category
 * Members and admins can update
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgId: string; categoryId: string }> }
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

    const { orgId, categoryId } = await params;

    // Require membership
    try {
      await requireMembership(user.id, orgId);
    } catch {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Verify category belongs to this org
    const existing = await db.category.findUnique({
      where: { id: categoryId },
    });

    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Validate request body
    const updateCategorySchema = z.object({
      name: z.string().min(1).max(255).optional(),
      parentId: z.string().nullable().optional(),
      color: z.string().max(50).nullable().optional(),
      icon: z.string().max(50).nullable().optional(),
      includeInPnL: z.boolean().optional(),
      active: z.boolean().optional(),
    });

    const body = await request.json();
    const validation = updateCategorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // If parentId is being changed, validate parent
    if (data.parentId !== undefined && data.parentId !== null) {
      const parent = await db.category.findUnique({
        where: { id: data.parentId },
      });

      if (!parent || parent.organizationId !== orgId) {
        return NextResponse.json(
          { error: "Parent category not found" },
          { status: 400 }
        );
      }

      if (parent.type !== existing.type) {
        return NextResponse.json(
          { error: "Parent category must have the same type" },
          { status: 400 }
        );
      }

      // Prevent circular reference
      if (parent.id === categoryId) {
        return NextResponse.json(
          { error: "Category cannot be its own parent" },
          { status: 400 }
        );
      }
    }

    // Update category
    const category = await db.category.update({
      where: { id: categoryId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.parentId !== undefined && {
          parentId: data.parentId,
        }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.includeInPnL !== undefined && {
          includeInPnL: data.includeInPnL,
        }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}
