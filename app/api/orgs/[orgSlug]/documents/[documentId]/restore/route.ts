/**
 * Document Restore API
 * POST: Restore a soft-deleted document from trash
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership } from "@/lib/org-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/orgs/[orgSlug]/documents/[documentId]/restore
 * Restore a document from trash
 * Note: Does NOT restore previous transaction links (per requirements)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; documentId: string }> }
): Promise<Response> {
  try {
    const { orgSlug, documentId } = await params;
    const user = await getCurrentUser();

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

    // Verify user is a member
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Membership required" },
        { status: 403 }
      );
    }

    // Verify document exists, belongs to org, and is soft-deleted
    const document = await db.document.findFirst({
      where: {
        id: documentId,
        organizationId: org.id,
        deletedAt: { not: null },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found in trash" },
        { status: 404 }
      );
    }

    // Restore: clear deletedAt
    const restoredDocument = await db.document.update({
      where: { id: document.id },
      data: { deletedAt: null },
      include: {
        uploadedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Log audit event
    await db.auditLog.create({
      data: {
        action: "document.restore",
        userId: user.id,
        organizationId: org.id,
        metadata: {
          documentId: document.id,
          filename: document.filenameOriginal,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Document restored",
      document: {
        id: restoredDocument.id,
        filenameOriginal: restoredDocument.filenameOriginal,
        displayName: restoredDocument.displayName,
        mimeType: restoredDocument.mimeType,
        fileSizeBytes: restoredDocument.fileSizeBytes,
        type: restoredDocument.type,
        documentDate: restoredDocument.documentDate,
        uploadedAt: restoredDocument.uploadedAt,
        uploadedBy: restoredDocument.uploadedByUser,
        deletedAt: restoredDocument.deletedAt,
      },
    });
  } catch (error) {
    console.error("Error restoring document:", error);
    return NextResponse.json(
      { error: "Failed to restore document" },
      { status: 500 }
    );
  }
}
