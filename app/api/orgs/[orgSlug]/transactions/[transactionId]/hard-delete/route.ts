import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * DELETE /api/orgs/[orgSlug]/transactions/[transactionId]/hard-delete
 * Permanently delete a soft-deleted transaction
 * Members and admins can permanently delete
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; transactionId: string }> }
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
        { error: "Transaction must be soft-deleted before permanent deletion" },
        { status: 400 }
      );
    }

    // Permanently delete transaction
    // Note: If there are related records (e.g., transaction-document links),
    // they should be deleted first or have cascade delete configured
    await db.transaction.delete({
      where: { id: transactionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error permanently deleting transaction:", error);
    return NextResponse.json(
      { error: "Failed to permanently delete transaction" },
      { status: 500 }
    );
  }
}
