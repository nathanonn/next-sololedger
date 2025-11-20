/**
 * Document AI Extraction Detail API
 * GET: Get a specific extraction with full payload
 * PATCH: Update extraction (save as draft)
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getOrgBySlug, requireMembership } from '@/lib/org-helpers';
import { db } from '@/lib/db';
import { DocumentExtractionV1Schema } from '@/lib/ai/document-schemas';

export const runtime = 'nodejs';

/**
 * GET /api/orgs/[orgSlug]/documents/[documentId]/ai/extractions/[extractionId]
 * Get full details of a specific extraction including payload
 *
 * Response:
 * - Full extraction metadata + payload
 */
export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      orgSlug: string;
      documentId: string;
      extractionId: string;
    }>;
  }
): Promise<Response> {
  try {
    const { orgSlug, documentId, extractionId } = await params;
    const user = await getCurrentUser(request);

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
    // Validate API key organization access
    if (!validateApiKeyOrgAccess(user, org.id)) {
      return NextResponse.json(
        { error: "API key not authorized for this organization" },
        { status: 403 }
      );
    }


    // Fetch extraction with full payload
    const extraction = await db.documentExtraction.findFirst({
      where: {
        id: extractionId,
        documentId,
        organizationId: org.id,
      },
    });

    if (!extraction) {
      return NextResponse.json(
        { error: 'Extraction not found' },
        { status: 404 }
      );
    }

    // Format response with full payload
    return NextResponse.json(
      {
        id: extraction.id,
        documentId: extraction.documentId,
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
        summaryTransactionDate:
          extraction.summaryTransactionDate?.toISOString() || null,
        isActive: extraction.isActive,
        payload: extraction.payload,
        appliedTransactionIds: extraction.appliedTransactionIds,
        createdAt: extraction.createdAt.toISOString(),
        updatedAt: extraction.updatedAt.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching extraction:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch extraction',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/orgs/[orgSlug]/documents/[documentId]/ai/extractions/[extractionId]
 * Update extraction payload (save as reviewed draft)
 *
 * Request body:
 * - payload: DocumentExtractionV1 (updated extraction data)
 *
 * Response:
 * - Updated extraction metadata
 */
export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      orgSlug: string;
      documentId: string;
      extractionId: string;
    }>;
  }
): Promise<Response> {
  try {
    const { orgSlug, documentId, extractionId } = await params;
    const user = await getCurrentUser(request);

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

    // Validate API key organization access
    if (!validateApiKeyOrgAccess(user, org.id)) {
      return NextResponse.json(
        { error: "API key not authorized for this organization" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { payload, status, appliedTransactionIds } = body;

    if (!payload) {
      return NextResponse.json(
        { error: 'Missing payload in request body' },
        { status: 400 }
      );
    }

    // Validate payload against schema
    const parsed = DocumentExtractionV1Schema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid payload format',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Verify extraction exists and belongs to this org/document
    const existingExtraction = await db.documentExtraction.findFirst({
      where: {
        id: extractionId,
        documentId,
        organizationId: org.id,
      },
    });

    if (!existingExtraction) {
      return NextResponse.json(
        { error: 'Extraction not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      payload: parsed.data as any,
      status: status || 'REVIEWED_DRAFT',
      // Update summary fields from payload
      summaryTotalAmount: parsed.data.totals.grandTotal?.value ?? null,
      summaryCurrency: parsed.data.currencyCode,
      summaryTransactionDate: parsed.data.transactionDate
        ? new Date(parsed.data.transactionDate)
        : null,
      overallConfidence: parsed.data.overallConfidence,
    };

    // Add appliedTransactionIds if provided
    if (appliedTransactionIds) {
      updateData.appliedTransactionIds = appliedTransactionIds;
    }

    // Update extraction with new payload and status
    const updatedExtraction = await db.documentExtraction.update({
      where: {
        id: extractionId,
      },
      data: updateData,
    });

    // Log audit event
    await db.auditLog.create({
      data: {
        action: updatedExtraction.status === 'APPLIED'
          ? 'document.extraction.apply.createTransaction'
          : 'document.extraction.review.save',
        userId: user.id,
        organizationId: org.id,
        metadata: {
          documentId,
          extractionId: updatedExtraction.id,
          status: updatedExtraction.status,
          appliedTransactionIds: updatedExtraction.appliedTransactionIds,
        },
      },
    });

    // Return updated extraction
    return NextResponse.json(
      {
        id: updatedExtraction.id,
        documentId: updatedExtraction.documentId,
        status: updatedExtraction.status,
        templateKey: updatedExtraction.templateKey,
        customPrompt: updatedExtraction.customPrompt,
        provider: updatedExtraction.provider,
        modelName: updatedExtraction.modelName,
        overallConfidence: updatedExtraction.overallConfidence
          ? Number(updatedExtraction.overallConfidence)
          : null,
        summaryTotalAmount: updatedExtraction.summaryTotalAmount
          ? Number(updatedExtraction.summaryTotalAmount)
          : null,
        summaryCurrency: updatedExtraction.summaryCurrency,
        summaryTransactionDate:
          updatedExtraction.summaryTransactionDate?.toISOString() || null,
        isActive: updatedExtraction.isActive,
        createdAt: updatedExtraction.createdAt.toISOString(),
        updatedAt: updatedExtraction.updatedAt.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating extraction:', error);

    return NextResponse.json(
      {
        error: 'Failed to update extraction',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
