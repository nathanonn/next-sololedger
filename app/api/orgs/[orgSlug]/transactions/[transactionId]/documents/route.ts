/**
 * Transaction-Document Link API
 * POST: Link documents to a transaction
 * DELETE: Unlink documents from a transaction
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const linkSchema = z.object({
  documentIds: z.array(z.string()).min(1, "At least one document ID required"),
});

/**
 * POST /api/orgs/[orgSlug]/transactions/[transactionId]/documents
 * Link documents to a transaction
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; transactionId: string }> }
): Promise<Response> {
  try {
    const { orgSlug, transactionId } = await params;
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

    // Parse and validate body
    const body = await request.json();
    const validationResult = linkSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { documentIds } = validationResult.data;

    // Verify transaction exists and belongs to organization
    const transaction = await db.transaction.findFirst({
      where: {
        id: transactionId,
        organizationId: org.id,
        deletedAt: null,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Fetch documents to verify they exist and belong to org (excluding deleted)
    const documents = await db.document.findMany({
      where: {
        id: { in: documentIds },
        organizationId: org.id,
        deletedAt: null,
      },
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

    if (documents.length !== documentIds.length) {
      return NextResponse.json(
        { error: "One or more documents not found or already deleted" },
        { status: 404 }
      );
    }

    // Create links (use createMany with skipDuplicates to handle already-linked docs)
    await db.transactionDocument.createMany({
      data: documents.map((doc) => ({
        transactionId: transaction.id,
        documentId: doc.id,
      })),
      skipDuplicates: true,
    });

    // Log audit events for each link
    for (const doc of documents) {
      await db.auditLog.create({
        data: {
          action: "document.link",
          userId: user.id,
          organizationId: org.id,
          metadata: {
            documentId: doc.id,
            transactionId: transaction.id,
            filename: doc.filenameOriginal,
          },
        },
      });
    }

    // Fetch and return all currently linked documents
    const linkedDocuments = await db.transactionDocument.findMany({
      where: { transactionId: transaction.id },
      include: {
        document: {
          include: {
            uploadedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      linkedDocuments: linkedDocuments.map((td) => ({
        id: td.document.id,
        filenameOriginal: td.document.filenameOriginal,
        displayName: td.document.displayName,
        mimeType: td.document.mimeType,
        fileSizeBytes: td.document.fileSizeBytes,
        type: td.document.type,
        documentDate: td.document.documentDate,
        uploadedAt: td.document.uploadedAt,
        uploadedBy: td.document.uploadedByUser,
        linkedAt: td.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error linking documents to transaction:", error);
    return NextResponse.json(
      { error: "Failed to link documents" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orgs/[orgSlug]/transactions/[transactionId]/documents
 * Unlink documents from a transaction
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; transactionId: string }> }
): Promise<Response> {
  try {
    const { orgSlug, transactionId } = await params;
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

    // Parse and validate body
    const body = await request.json();
    const validationResult = linkSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { documentIds } = validationResult.data;

    // Verify transaction exists and belongs to organization
    const transaction = await db.transaction.findFirst({
      where: {
        id: transactionId,
        organizationId: org.id,
        deletedAt: null,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Delete the links
    await db.transactionDocument.deleteMany({
      where: {
        transactionId: transaction.id,
        documentId: { in: documentIds },
      },
    });

    // Log audit events for each unlink
    for (const documentId of documentIds) {
      await db.auditLog.create({
        data: {
          action: "document.unlink",
          userId: user.id,
          organizationId: org.id,
          metadata: {
            documentId,
            transactionId: transaction.id,
          },
        },
      });
    }

    // Fetch and return remaining linked documents
    const linkedDocuments = await db.transactionDocument.findMany({
      where: { transactionId: transaction.id },
      include: {
        document: {
          include: {
            uploadedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      linkedDocuments: linkedDocuments.map((td) => ({
        id: td.document.id,
        filenameOriginal: td.document.filenameOriginal,
        displayName: td.document.displayName,
        mimeType: td.document.mimeType,
        fileSizeBytes: td.document.fileSizeBytes,
        type: td.document.type,
        documentDate: td.document.documentDate,
        uploadedAt: td.document.uploadedAt,
        uploadedBy: td.document.uploadedByUser,
        linkedAt: td.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error unlinking documents from transaction:", error);
    return NextResponse.json(
      { error: "Failed to unlink documents" },
      { status: 500 }
    );
  }
}
