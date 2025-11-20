/**
 * Single Document API
 * GET: Get document details
 * PATCH: Update document metadata
 * DELETE: Soft delete document (move to trash)
 */

import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const updateSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  type: z.enum(["RECEIPT", "INVOICE", "BANK_STATEMENT", "OTHER"]).optional(),
  documentDate: z.string().optional().nullable(),
});

/**
 * GET /api/orgs/[orgSlug]/documents/[documentId]
 * Get document details with linked transactions
 */
export async function GET(
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

    // Verify user is a member
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Membership required" },
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


    // Get document with linked transactions
    const document = await db.document.findFirst({
      where: {
        id: documentId,
        organizationId: org.id,
      },
      include: {
        uploadedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        transactions: {
          include: {
            transaction: {
              include: {
                category: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                  },
                },
                vendor: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                client: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: document.id,
      filenameOriginal: document.filenameOriginal,
      displayName: document.displayName,
      mimeType: document.mimeType,
      fileSizeBytes: document.fileSizeBytes,
      type: document.type,
      documentDate: document.documentDate,
      uploadedAt: document.uploadedAt,
      uploadedBy: document.uploadedByUser,
      deletedAt: document.deletedAt,
      linkedTransactions: document.transactions.map((td) => ({
        id: td.transaction.id,
        date: td.transaction.date,
        description: td.transaction.description,
        amountBase: td.transaction.amountBase,
        currencyBase: td.transaction.currencyBase,
        type: td.transaction.type,
        status: td.transaction.status,
        category: td.transaction.category,
        vendor: td.transaction.vendor,
        client: td.transaction.client,
        linkedAt: td.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/orgs/[orgSlug]/documents/[documentId]
 * Update document metadata
 */
export async function PATCH(
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

    // Verify user is a member
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Membership required" },
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

    // Parse and validate body
    const body = await request.json();
    const validationResult = updateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const updateData = validationResult.data;

    // Verify document exists and belongs to org
    const existingDocument = await db.document.findFirst({
      where: {
        id: documentId,
        organizationId: org.id,
      },
    });

    if (!existingDocument) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Update document
    const document = await db.document.update({
      where: { id: documentId },
      data: {
        ...(updateData.displayName && { displayName: updateData.displayName }),
        ...(updateData.type && { type: updateData.type }),
        ...(updateData.documentDate !== undefined && {
          documentDate: updateData.documentDate ? new Date(updateData.documentDate) : null,
        }),
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

    return NextResponse.json({
      id: document.id,
      filenameOriginal: document.filenameOriginal,
      displayName: document.displayName,
      mimeType: document.mimeType,
      fileSizeBytes: document.fileSizeBytes,
      type: document.type,
      documentDate: document.documentDate,
      uploadedAt: document.uploadedAt,
      uploadedBy: document.uploadedByUser,
      deletedAt: document.deletedAt,
    });
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orgs/[orgSlug]/documents/[documentId]
 * Soft delete document (move to trash)
 * Removes all transaction links
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

    // Verify user is a member
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Membership required" },
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

    // Verify document exists and belongs to org (not already deleted)
    const document = await db.document.findFirst({
      where: {
        id: documentId,
        organizationId: org.id,
        deletedAt: null,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found or already deleted" },
        { status: 404 }
      );
    }

    // Soft delete: set deletedAt and remove all transaction links
    await db.$transaction([
      db.transactionDocument.deleteMany({
        where: { documentId: document.id },
      }),
      db.document.update({
        where: { id: document.id },
        data: { deletedAt: new Date() },
      }),
    ]);

    // Log audit event
    await db.auditLog.create({
      data: {
        action: "document.delete",
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
      message: "Document moved to trash",
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
