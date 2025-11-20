/**
 * Document Hard Delete API
 * DELETE: Permanently delete a document (requires admin/superadmin)
 */

import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { getDocumentStorage } from "@/lib/document-storage";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * DELETE /api/orgs/[orgSlug]/documents/[documentId]/hard
 * Permanently delete a document
 * Requires admin or superadmin role
 * Deletes file from storage and all database records
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; documentId: string }> }
): Promise<Response> {
  try {
    const { orgSlug, documentId } = await params;
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Verify user is admin or superadmin
    try {
      await requireAdminOrSuperadmin(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Admin or superadmin access required" },
        { status: 403 }
      );
    }
    // Validate API key organization access
    if (!validateApiKeyOrgAccess(user, org.id)) {
      return NextResponse.json(
        { error: "API key not authorized for this organization" },
        { status: 403 }
      );
    }


    // Get document (must exist and belong to org)
    // Defensive check: should be soft-deleted, but not strictly required
    const document = await db.document.findFirst({
      where: {
        id: documentId,
        organizationId: org.id,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Delete file from storage
    const storage = getDocumentStorage();
    try {
      await storage.delete({
        organizationId: org.id,
        storageKey: document.storageKey,
      });
    } catch (storageError) {
      console.error("Error deleting file from storage:", storageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete database records (transaction links and document)
    await db.$transaction([
      db.transactionDocument.deleteMany({
        where: { documentId: document.id },
      }),
      db.document.delete({
        where: { id: document.id },
      }),
    ]);

    // Log audit event
    await db.auditLog.create({
      data: {
        action: "document.hard_delete",
        userId: user.id,
        organizationId: org.id,
        metadata: {
          documentId: document.id,
          filename: document.filenameOriginal,
          storageKey: document.storageKey,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Document permanently deleted",
    });
  } catch (error) {
    console.error("Error hard deleting document:", error);
    return NextResponse.json(
      { error: "Failed to permanently delete document" },
      { status: 500 }
    );
  }
}
