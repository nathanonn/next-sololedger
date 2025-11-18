/**
 * Document AI Prompt History API
 * GET: Retrieve distinct prompt history for reuse
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getOrgBySlug, requireMembership } from '@/lib/org-helpers';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/orgs/[orgSlug]/documents/ai/prompt-history
 * Get distinct template+prompt combinations from past extractions
 *
 * Response:
 * - history: Array of { templateKey, customPrompt } objects
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    const { orgSlug } = await params;
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

    // Fetch distinct template+prompt combinations
    // Get last 20 extractions, then deduplicate
    const extractions = await db.documentExtraction.findMany({
      where: {
        organizationId: org.id,
      },
      select: {
        templateKey: true,
        customPrompt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    // Deduplicate by combining templateKey + customPrompt
    const seen = new Set<string>();
    const history: Array<{ templateKey: string | null; customPrompt: string | null }> = [];

    for (const extraction of extractions) {
      const key = `${extraction.templateKey || ''}|||${extraction.customPrompt || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        history.push({
          templateKey: extraction.templateKey,
          customPrompt: extraction.customPrompt,
        });
      }
    }

    return NextResponse.json({ history: history.slice(0, 10) }, { status: 200 });
  } catch (error) {
    console.error('Error fetching prompt history:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch prompt history',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
