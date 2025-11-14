import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";
import { requireMembership, scopeTenant, getOrgBySlug } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/categories
 * List all categories for an organization
 * Members and admins can view
 */
export async function GET(
  request: Request,
  {  params }: { params: Promise<{ orgSlug: string }> }
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

    // Get all categories for this organization
    const categories = await db.category.findMany({
      where: scopeTenant({}, org.id),
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orgs/[orgSlug]/categories
 * Create a new category
 * Members and admins can create
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

    // Require membership (members and admins can manage categories)
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Validate request body
    const categorySchema = z.object({
      name: z.string().min(1, "Name is required").max(255),
      type: z.enum(["INCOME", "EXPENSE"]),
      parentId: z.string().optional(),
      color: z.string().max(50).optional(),
      icon: z.string().max(50).optional(),
      includeInPnL: z.boolean().default(true),
      active: z.boolean().default(true),
    });

    const body = await request.json();
    const validation = categorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // If parentId is provided, validate that parent exists and has same type
    if (data.parentId) {
      const parent = await db.category.findUnique({
        where: { id: data.parentId },
      });

      if (!parent || parent.organizationId !== org.id) {
        return NextResponse.json(
          { error: "Parent category not found" },
          { status: 400 }
        );
      }

      if (parent.type !== data.type) {
        return NextResponse.json(
          { error: "Parent category must have the same type" },
          { status: 400 }
        );
      }
    }

    // Create category
    const category = await db.category.create({
      data: {
        organizationId: org.id,
        name: data.name,
        type: data.type,
        parentId: data.parentId || null,
        color: data.color || null,
        icon: data.icon || null,
        includeInPnL: data.includeInPnL,
        active: data.active,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
