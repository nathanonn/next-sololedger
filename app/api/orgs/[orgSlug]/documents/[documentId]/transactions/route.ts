/**
 * Document-Transaction Link API
 * POST: Link a document to transactions
 * DELETE: Unlink a document from transactions
 */

import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const linkSchema = z.object({
  transactionIds: z.array(z.string()).min(1, "At least one transaction ID required"),
});

/**
 * POST /api/orgs/[orgSlug]/documents/[documentId]/transactions
 * Link a document to one or more transactions
 */
export async function POST(
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
    const validationResult = linkSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { transactionIds } = validationResult.data;

    // Verify document exists and belongs to organization (not deleted)
    const document = await db.document.findFirst({
      where: {
        id: documentId,
        organizationId: org.id,
        deletedAt: null,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Fetch transactions to verify they exist and belong to org (excluding deleted)
    const transactions = await db.transaction.findMany({
      where: {
        id: { in: transactionIds },
        organizationId: org.id,
        deletedAt: null,
      },
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
    });

    if (transactions.length !== transactionIds.length) {
      return NextResponse.json(
        { error: "One or more transactions not found or already deleted" },
        { status: 404 }
      );
    }

    // Create links (use createMany with skipDuplicates to handle already-linked)
    await db.transactionDocument.createMany({
      data: transactions.map((txn) => ({
        transactionId: txn.id,
        documentId: document.id,
      })),
      skipDuplicates: true,
    });

    // Log audit events for each link
    for (const txn of transactions) {
      await db.auditLog.create({
        data: {
          action: "document.link",
          userId: user.id,
          organizationId: org.id,
          metadata: {
            documentId: document.id,
            transactionId: txn.id,
            filename: document.filenameOriginal,
          },
        },
      });
    }

    // Fetch and return all currently linked transactions
    const linkedTransactions = await db.transactionDocument.findMany({
      where: { documentId: document.id },
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
    });

    return NextResponse.json({
      linkedTransactions: linkedTransactions.map((td) => ({
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
    console.error("Error linking document to transactions:", error);
    return NextResponse.json(
      { error: "Failed to link document to transactions" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orgs/[orgSlug]/documents/[documentId]/transactions
 * Unlink a document from one or more transactions
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

    // Parse and validate body
    const body = await request.json();
    const validationResult = linkSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { transactionIds } = validationResult.data;

    // Verify document exists and belongs to organization
    const document = await db.document.findFirst({
      where: {
        id: documentId,
        organizationId: org.id,
        deletedAt: null,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Delete the links
    await db.transactionDocument.deleteMany({
      where: {
        documentId: document.id,
        transactionId: { in: transactionIds },
      },
    });

    // Log audit events for each unlink
    for (const transactionId of transactionIds) {
      await db.auditLog.create({
        data: {
          action: "document.unlink",
          userId: user.id,
          organizationId: org.id,
          metadata: {
            documentId: document.id,
            transactionId,
          },
        },
      });
    }

    // Fetch and return remaining linked transactions
    const linkedTransactions = await db.transactionDocument.findMany({
      where: { documentId: document.id },
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
    });

    return NextResponse.json({
      linkedTransactions: linkedTransactions.map((td) => ({
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
    console.error("Error unlinking document from transactions:", error);
    return NextResponse.json(
      { error: "Failed to unlink document from transactions" },
      { status: 500 }
    );
  }
}
