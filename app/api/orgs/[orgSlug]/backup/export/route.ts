/**
 * Organization Backup Export API
 * POST: Export full organization data as JSON or CSV ZIP
 * Requires: Admin or Superadmin
 */

import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { exportOrganizationBackup, type BackupFormat } from "@/lib/backup-export";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const exportSchema = z.object({
  format: z.enum(["json", "csv"]),
  includeDocumentReferences: z.boolean().default(false),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

/**
 * POST /api/orgs/[orgSlug]/backup/export
 * Export full organization backup
 */
export async function POST(
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

    // Verify user is admin or superadmin
    try {
      await requireAdminOrSuperadmin(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Admin or superadmin access required" },
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
    const validationResult = exportSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { format, includeDocumentReferences, dateFrom, dateTo } = validationResult.data;

    // Parse dates
    const dateFromParsed = dateFrom ? new Date(dateFrom) : undefined;
    const dateToParsed = dateTo ? new Date(dateTo) : undefined;

    // Validate dates
    if (dateFromParsed && isNaN(dateFromParsed.getTime())) {
      return NextResponse.json(
        { error: "Invalid dateFrom format" },
        { status: 400 }
      );
    }

    if (dateToParsed && isNaN(dateToParsed.getTime())) {
      return NextResponse.json(
        { error: "Invalid dateTo format" },
        { status: 400 }
      );
    }

    // Export data
    const result = await exportOrganizationBackup(
      org.id,
      org.slug,
      org.name,
      {
        format: format as BackupFormat,
        includeDocumentReferences,
        dateFrom: dateFromParsed,
        dateTo: dateToParsed,
      }
    );

    // Create audit log
    await db.auditLog.create({
      data: {
        action: "org_backup_export",
        userId: user.id,
        organizationId: org.id,
        metadata: {
          format,
          includeDocumentReferences,
          dateFrom: dateFromParsed?.toISOString(),
          dateTo: dateToParsed?.toISOString(),
          filename: result.filename,
        },
      },
    });

    // Return file as download
    return new Response(result.buffer, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": result.buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error exporting backup:", error);
    return NextResponse.json(
      {
        error: "Failed to export backup",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
