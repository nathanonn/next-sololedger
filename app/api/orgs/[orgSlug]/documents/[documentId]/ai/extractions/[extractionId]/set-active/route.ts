/**
 * Document AI Extraction Set Active API
 * POST: Set an extraction as the active one for a document
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getOrgBySlug, requireMembership } from '@/lib/org-helpers';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * POST /api/orgs/[orgSlug]/documents/[documentId]/ai/extractions/[extractionId]/set-active
 * Set this extraction as active and deactivate all others
 *
 * Response:
 * - Success message
 */
export async function POST(
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

    // Verify extraction exists and belongs to this org/document
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

    // Set this extraction as active and deactivate all others in a transaction
    await db.$transaction(async (tx) => {
      // Deactivate all extractions for this document
      await tx.documentExtraction.updateMany({
        where: {
          documentId,
          organizationId: org.id,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      // Activate the selected extraction
      await tx.documentExtraction.update({
        where: {
          id: extractionId,
        },
        data: {
          isActive: true,
        },
      });
    });

    // Log audit event
    await db.auditLog.create({
      data: {
        action: 'document.extraction.setActive',
        userId: user.id,
        organizationId: org.id,
        metadata: {
          documentId,
          extractionId,
        },
      },
    });

    return NextResponse.json(
      { message: 'Extraction set as active' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error setting active extraction:', error);

    return NextResponse.json(
      {
        error: 'Failed to set active extraction',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
