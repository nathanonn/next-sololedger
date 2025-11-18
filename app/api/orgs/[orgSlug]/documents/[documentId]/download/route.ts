/**
 * Document Download API
 * GET: Download or preview a document
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership } from "@/lib/org-helpers";
import { getDocumentStorage } from "@/lib/document-storage";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/documents/[documentId]/download
 * Download or preview a document
 *
 * Query params:
 * - mode: "attachment" | "inline" (default "attachment")
 */
export async function GET(
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

    // Get document (allow downloads from Trash, but verify org ownership)
    const document = await db.document.findFirst({
      where: {
        id: documentId,
        organizationId: org.id,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Get mode parameter
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "attachment";

    // Get file stream from storage
    const storage = getDocumentStorage();
    const fileStream = storage.getStream({
      organizationId: org.id,
      storageKey: document.storageKey,
    });

    // Log download event
    await db.auditLog.create({
      data: {
        action: "document.download",
        userId: user.id,
        organizationId: org.id,
        metadata: {
          documentId: document.id,
          filename: document.filenameOriginal,
          mode,
        },
      },
    });

    // Set content disposition header
    const disposition = mode === "inline" ? "inline" : "attachment";
    const filename = document.filenameOriginal;

    // Create response with file stream
    // Note: Next.js App Router supports streaming responses
    return new Response(fileStream as any, {
      status: 200,
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Content-Length": document.fileSizeBytes.toString(),
      },
    });
  } catch (error) {
    console.error("Error downloading document:", error);
    return NextResponse.json(
      { error: "Failed to download document" },
      { status: 500 }
    );
  }
}
