import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";
import { requireAdminOrSuperadmin, getOrgBySlug } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * PATCH /api/orgs/[orgSlug]/accounts/[accountId]
 * Update an account
 * Admin-only access
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; accountId: string }> }
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

    const { orgSlug, accountId } = await params;

    // Get organization
    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Require admin access
    try {
      await requireAdminOrSuperadmin(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Verify account belongs to this org
    const existing = await db.account.findUnique({
      where: { id: accountId },
    });

    if (!existing || existing.organizationId !== org.id) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Validate request body
    const updateAccountSchema = z.object({
      name: z.string().min(1).max(255).optional(),
      description: z.string().max(1000).nullable().optional(),
      isDefault: z.boolean().optional(),
      active: z.boolean().optional(),
    });

    const body = await request.json();
    const validation = updateAccountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // If setting as default, clear default flag from other accounts
    if (data.isDefault === true) {
      await db.account.updateMany({
        where: {
          organizationId: org.id,
          isDefault: true,
          id: { not: accountId },
        },
        data: { isDefault: false },
      });
    }

    // Update account
    const account = await db.account.update({
      where: { id: accountId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });

    return NextResponse.json({ account });
  } catch (error) {
    console.error("Error updating account:", error);
    return NextResponse.json(
      { error: "Failed to update account" },
      { status: 500 }
    );
  }
}
