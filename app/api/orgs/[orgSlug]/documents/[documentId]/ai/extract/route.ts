/**
 * Document AI Extraction API
 * POST: Run AI extraction on a document
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getOrgBySlug, requireMembership } from '@/lib/org-helpers';
import { db } from '@/lib/db';
import { extractDocument } from '@/lib/ai/document-extraction';
import { ExtractDocumentRequestSchema } from '@/lib/ai/document-schemas';
import { AiConfigError } from '@/lib/ai/config';
import type { AiProvider } from '@/lib/ai/providers';
import type { DocumentExtractionStatus } from '@prisma/client';

export const runtime = 'nodejs';

/**
 * POST /api/orgs/[orgSlug]/documents/[documentId]/ai/extract
 * Run AI extraction on a document
 *
 * Request body:
 * - templateKey?: 'standard_receipt' | 'invoice' | 'bank_statement_page' | 'custom'
 * - customPrompt?: string
 * - provider?: 'openai' | 'gemini' | 'anthropic'
 * - modelName?: string
 * - documentTypeHint?: 'RECEIPT' | 'INVOICE' | 'BANK_STATEMENT' | 'OTHER'
 * - localeHint?: string
 *
 * Response:
 * - Extraction metadata + full payload
 */
export async function POST(
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

    // Verify user is a member (extraction requires membership)
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: 'Membership required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = ExtractDocumentRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      templateKey,
      customPrompt,
      provider,
      modelName,
      documentTypeHint,
      localeHint,
    } = parsed.data;

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

    // TODO: Implement rate limiting here
    // await checkExtractionRateLimit(org.id, user.id);

    // Run extraction
    const result = await extractDocument({
      orgId: org.id,
      userId: user.id,
      documentId,
      templateKey: templateKey || 'standard_receipt',
      customPrompt,
      provider: provider as AiProvider | undefined,
      modelName,
      documentTypeHint,
      localeHint,
    });

    // Extract summary fields from extraction result
    const summaryTotalAmount = result.extraction.totals.grandTotal?.value ?? null;
    const summaryCurrency = result.extraction.currencyCode;
    const summaryTransactionDate = result.extraction.transactionDate
      ? new Date(result.extraction.transactionDate)
      : null;
    const overallConfidence = result.extraction.overallConfidence;
    const extractedDocumentType = result.extraction.documentType;

    // Create DocumentExtraction record in a transaction
    // Set this as active and mark all others as inactive
    const extraction = await db.$transaction(async (tx) => {
      // Set all existing extractions for this document to inactive
      await tx.documentExtraction.updateMany({
        where: {
          documentId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      // Create new extraction as active
      return await tx.documentExtraction.create({
        data: {
          organizationId: org.id,
          documentId,
          createdByUserId: user.id,
          status: 'RAW' as DocumentExtractionStatus,
          templateKey: templateKey || 'standard_receipt',
          customPrompt,
          provider: result.provider,
          modelName: result.modelName,
          documentType: extractedDocumentType,
          summaryTotalAmount,
          summaryCurrency,
          summaryTransactionDate,
          overallConfidence,
          isActive: true,
          payload: result.extraction as any, // Prisma Json type
          appliedTransactionIds: null,
        },
      });
    });

    // Log audit event
    await db.auditLog.create({
      data: {
        action: 'document.extraction.run',
        userId: user.id,
        organizationId: org.id,
        metadata: {
          documentId,
          extractionId: extraction.id,
          provider: result.provider,
          modelName: result.modelName,
          templateKey: templateKey || 'standard_receipt',
          overallConfidence,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          latencyMs: result.latencyMs,
        },
      },
    });

    // Return extraction response
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
        summaryTransactionDate: extraction.summaryTransactionDate?.toISOString() || null,
        isActive: extraction.isActive,
        payload: extraction.payload,
        createdAt: extraction.createdAt.toISOString(),
        updatedAt: extraction.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error running extraction:', error);

    // Handle AI configuration errors with helpful messages
    if (error instanceof AiConfigError) {
      return NextResponse.json(
        {
          error: 'AI configuration error',
          message: error.message,
          code: error.code,
        },
        { status: 400 }
      );
    }

    // Handle other errors
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to run extraction';

    return NextResponse.json(
      {
        error: 'Extraction failed',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
