/**
 * Documents Trash API
 * GET: List soft-deleted documents
 */

import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership } from "@/lib/org-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/documents/trash
 * List documents in trash (soft-deleted)
 *
 * Query params:
 * - page: Page number (default 1)
 * - pageSize: Items per page (default 20)
 * - q: Search query (filename, display name)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    const { orgSlug } = await params;
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


    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
    const q = searchParams.get("q");

    // Build where clause
    const where: any = {
      organizationId: org.id,
      deletedAt: { not: null },
    };

    // Search query
    if (q && q.trim()) {
      const searchTerm = q.trim();
      where.OR = [
        { filenameOriginal: { contains: searchTerm, mode: "insensitive" } },
        { displayName: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    // Fetch documents with pagination
    const [documents, total] = await Promise.all([
      db.document.findMany({
        where,
        include: {
          uploadedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { deletedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.document.count({ where }),
    ]);

    // Format response
    const items = documents.map((doc) => ({
      id: doc.id,
      filenameOriginal: doc.filenameOriginal,
      displayName: doc.displayName,
      mimeType: doc.mimeType,
      fileSizeBytes: doc.fileSizeBytes,
      type: doc.type,
      documentDate: doc.documentDate,
      uploadedAt: doc.uploadedAt,
      deletedAt: doc.deletedAt,
      uploadedBy: doc.uploadedByUser,
    }));

    return NextResponse.json({
      items,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      totalItems: total,
    });
  } catch (error) {
    console.error("Error fetching trash documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch trash documents" },
      { status: 500 }
    );
  }
}
