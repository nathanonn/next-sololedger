import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * POST /api/orgs/[orgSlug]/transactions/[transactionId]/restore
 * Restore a soft-deleted transaction
 * Members and admins can restore
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; transactionId: string }> }
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

    const { orgSlug, transactionId } = await params;

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

    // Verify transaction belongs to this org
    const existing = await db.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!existing || existing.organizationId !== org.id) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (!existing.deletedAt) {
      return NextResponse.json(
        { error: "Transaction is not deleted" },
        { status: 400 }
      );
    }

    // Restore transaction
    const transaction = await db.transaction.update({
      where: { id: transactionId },
      data: { deletedAt: null },
      include: {
        category: true,
        account: true,
        vendor: true,
        client: true,
      },
    });

    return NextResponse.json({ transaction });
  } catch (error) {
    console.error("Error restoring transaction:", error);
    return NextResponse.json(
      { error: "Failed to restore transaction" },
      { status: 500 }
    );
  }
}
