/**
 * Document AI Extractions List API
 * GET: List all extractions for a document
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getOrgBySlug, requireMembership } from '@/lib/org-helpers';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/orgs/[orgSlug]/documents/[documentId]/ai/extractions
 * List all extractions for a document (most recent first)
 *
 * Response:
 * - Array of extraction metadata (without full payload)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; documentId: string }> }
): Promise<Response> {
  try {
    const { orgSlug, documentId } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Verify user is a member
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: 'Membership required' },
        { status: 403 }
      );
    }

    // Verify document exists and belongs to this organization
    const document = await db.document.findFirst({
      where: {
        id: documentId,
        organizationId: org.id,
        deletedAt: null,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or has been deleted' },
        { status: 404 }
      );
    }

    // Fetch all extractions for this document (most recent first)
    const extractions = await db.documentExtraction.findMany({
      where: {
        documentId,
        organizationId: org.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        status: true,
        templateKey: true,
        customPrompt: true,
        provider: true,
        modelName: true,
        overallConfidence: true,
        summaryTotalAmount: true,
        summaryCurrency: true,
        summaryTransactionDate: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Format response
    const formattedExtractions = extractions.map((extraction) => ({
      id: extraction.id,
      status: extraction.status,
      templateKey: extraction.templateKey,
      customPrompt: extraction.customPrompt,
      provider: extraction.provider,
      modelName: extraction.modelName,
      overallConfidence: extraction.overallConfidence
        ? Number(extraction.overallConfidence)
        : null,
      summaryTotalAmount: extraction.summaryTotalAmount
        ? Number(extraction.summaryTotalAmount)
        : null,
      summaryCurrency: extraction.summaryCurrency,
      summaryTransactionDate: extraction.summaryTransactionDate?.toISOString() || null,
      isActive: extraction.isActive,
      createdAt: extraction.createdAt.toISOString(),
      updatedAt: extraction.updatedAt.toISOString(),
    }));

    return NextResponse.json(formattedExtractions, { status: 200 });
  } catch (error) {
    console.error('Error fetching extractions:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch extractions',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
