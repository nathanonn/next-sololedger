/**
 * CSV Import Preview API
 * POST: Preview CSV import with validation and duplicate detection
 * Stateless - no database writes except reads
 */

import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import {
  parseCsvBuffer,
  applyColumnMapping,
  normalizeAndValidateRows,
  detectDuplicates,
  generateImportSummary,
  type ImportTemplateConfig,
  type DirectionMode,
} from "@/lib/import/transactions-csv";
import type { DateFormat, DecimalSeparator, ThousandsSeparator } from "@prisma/client";

export const runtime = "nodejs";

// Max file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * POST /api/orgs/[orgSlug]/transactions/import/preview
 * Preview CSV import
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

    // Verify user is a member
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Organization membership required" },
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

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mappingConfigJson = formData.get("mappingConfig") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!mappingConfigJson) {
      return NextResponse.json(
        { error: "Mapping configuration required" },
        { status: 400 }
      );
    }

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(
        { error: "Only CSV files are supported" },
        { status: 400 }
      );
    }

    // Parse mapping config
    let mappingConfig: ImportTemplateConfig;
    try {
      const parsed = JSON.parse(mappingConfigJson);

      // If template ID is provided, load template and merge overrides
      if (parsed.templateId) {
        const template = await db.csvImportTemplate.findFirst({
          where: {
            id: parsed.templateId,
            organizationId: org.id,
          },
        });

        if (!template) {
          return NextResponse.json(
            { error: "Template not found" },
            { status: 404 }
          );
        }

        mappingConfig = template.config as unknown as ImportTemplateConfig;

        // Merge any overrides
        if (parsed.columnMapping) {
          mappingConfig.columnMapping = {
            ...mappingConfig.columnMapping,
            ...parsed.columnMapping,
          };
        }
        if (parsed.parsingOptions) {
          mappingConfig.parsingOptions = {
            ...mappingConfig.parsingOptions,
            ...parsed.parsingOptions,
          };
        }
      } else {
        mappingConfig = parsed as ImportTemplateConfig;
      }
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid mapping configuration JSON" },
        { status: 400 }
      );
    }

    // Load organization settings
    const settings = await db.organizationSettings.findUnique({
      where: { organizationId: org.id },
    });

    if (!settings) {
      return NextResponse.json(
        { error: "Organization settings not found" },
        { status: 404 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse CSV
    let parsedData;
    try {
      parsedData = parseCsvBuffer(buffer, mappingConfig.parsingOptions);
    } catch (error) {
      return NextResponse.json(
        {
          error: "Failed to parse CSV",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 400 }
      );
    }

    // Apply column mapping
    const rawRows = applyColumnMapping(
      parsedData,
      mappingConfig.columnMapping,
      mappingConfig.parsingOptions.directionMode
    );

    // Normalize and validate
    const normalizedRows = await normalizeAndValidateRows(
      rawRows,
      org.id,
      settings
    );

    // Detect duplicates
    const rowsWithDuplicates = await detectDuplicates(
      normalizedRows,
      org.id
    );

    // Generate summary
    const summary = generateImportSummary(rowsWithDuplicates);

    // Prepare preview response (limit to first N rows for display)
    const PREVIEW_LIMIT = 100;
    const previewRows = rowsWithDuplicates.slice(0, PREVIEW_LIMIT).map((row) => ({
      rowIndex: row.rowIndex,
      raw: row.raw,
      status: row.status,
      errors: row.errors,
      normalized: row.normalized
        ? {
            type: row.normalized.type,
            date: row.normalized.date.toISOString(),
            amountBase: row.normalized.amountBase,
            currencyBase: row.normalized.currencyBase,
            amountSecondary: row.normalized.amountSecondary,
            currencySecondary: row.normalized.currencySecondary,
            description: row.normalized.description,
            vendorName: row.normalized.vendorName,
            clientName: row.normalized.clientName,
            notes: row.normalized.notes,
            tagNames: row.normalized.tagNames,
          }
        : undefined,
      isDuplicateCandidate: row.isDuplicateCandidate,
      duplicateMatches: row.duplicateMatches.map((m) => ({
        transactionId: m.transactionId,
        date: m.date.toISOString(),
        amount: m.amount,
        currency: m.currency,
        description: m.description,
        vendorName: m.vendorName,
        clientName: m.clientName,
      })),
    }));

    return NextResponse.json({
      headers: parsedData.headers,
      previewRows,
      summary,
      totalRowsParsed: rowsWithDuplicates.length,
      previewRowsShown: previewRows.length,
    });
  } catch (error) {
    console.error("Error previewing CSV import:", error);
    return NextResponse.json(
      {
        error: "Failed to preview import",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
