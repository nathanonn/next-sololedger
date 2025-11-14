import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";
import { requireAdminOrSuperadmin, scopeTenant } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgId]/accounts
 * List all accounts for an organization
 * Admin-only access
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;

    // Require admin access
    try {
      await requireAdminOrSuperadmin(user.id, orgId);
    } catch {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get all accounts for this organization
    const accounts = await db.account.findMany({
      where: scopeTenant({}, orgId),
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orgs/[orgId]/accounts
 * Create a new account
 * Admin-only access
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
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

    const { orgId } = await params;

    // Require admin access
    try {
      await requireAdminOrSuperadmin(user.id, orgId);
    } catch {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Validate request body
    const accountSchema = z.object({
      name: z.string().min(1, "Name is required").max(255),
      description: z.string().max(1000).optional(),
      isDefault: z.boolean().default(false),
      active: z.boolean().default(true),
    });

    const body = await request.json();
    const validation = accountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // If setting as default, clear default flag from other accounts
    if (data.isDefault) {
      await db.account.updateMany({
        where: { organizationId: orgId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Create account
    const account = await db.account.create({
      data: {
        organizationId: orgId,
        name: data.name,
        description: data.description || null,
        isDefault: data.isDefault,
        active: data.active,
      },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    console.error("Error creating account:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
