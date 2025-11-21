/**
 * CSV Import Commit API
 * POST: Commit CSV import - actually create transactions
 * Stateless - re-validates the file before import
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
  type ImportTemplateConfig,
} from "@/lib/import/transactions-csv";
import { upsertTagsForOrg, sanitizeTagNames } from "@/lib/tag-helpers";

export const runtime = "nodejs";

// Max file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Batch size for transaction creation
const BATCH_SIZE = 100;

/**
 * Find or create vendor by name
 */
async function findOrCreateVendor(
  organizationId: string,
  name: string
): Promise<string> {
  const nameLower = name.toLowerCase().trim();

  // Try to find existing
  let vendor = await db.vendor.findUnique({
    where: {
      organizationId_nameLower: {
        organizationId,
        nameLower,
      },
    },
  });

  if (!vendor) {
    // Create new vendor
    vendor = await db.vendor.create({
      data: {
        organizationId,
        name: name.trim(),
        nameLower,
        active: true,
      },
    });
  }

  return vendor.id;
}

/**
 * Find or create client by name
 */
async function findOrCreateClient(
  organizationId: string,
  name: string
): Promise<string> {
  const nameLower = name.toLowerCase().trim();

  // Try to find existing
  let client = await db.client.findUnique({
    where: {
      organizationId_nameLower: {
        organizationId,
        nameLower,
      },
    },
  });

  if (!client) {
    // Create new client
    client = await db.client.create({
      data: {
        organizationId,
        name: name.trim(),
        nameLower,
        active: true,
      },
    });
  }

  return client.id;
}

/**
 * POST /api/orgs/[orgSlug]/transactions/import/commit
 * Commit CSV import
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
    const decisionsJson = formData.get("decisions") as string | null;

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

    // Parse decisions
    let decisions: Record<number, "import" | "skip"> = {};
    if (decisionsJson) {
      try {
        decisions = JSON.parse(decisionsJson);
      } catch {
        return NextResponse.json(
          { error: "Invalid decisions JSON" },
          { status: 400 }
        );
      }
    }

    // Parse mapping config (same logic as preview)
    let mappingConfig: ImportTemplateConfig;
    try {
      const parsed = JSON.parse(mappingConfigJson);

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

    // Re-run the full pipeline (stateless design)
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

    const rawRows = applyColumnMapping(
      parsedData,
      mappingConfig.columnMapping,
      mappingConfig.parsingOptions.directionMode
    );

    const normalizedRows = await normalizeAndValidateRows(
      rawRows,
      org.id,
      settings
    );

    const rowsWithDuplicates = await detectDuplicates(
      normalizedRows,
      org.id
    );

    // Determine which rows to import
    const rowsToImport = rowsWithDuplicates.filter((row) => {
      // Always skip invalid rows
      if (row.status === "invalid") return false;

      // Check duplicate decision
      if (row.isDuplicateCandidate) {
        const decision = decisions[row.rowIndex];
        // Default to "skip" for safety
        if (decision === "import") return true;
        return false;
      }

      // Valid and not duplicate
      return true;
    });

    // Import transactions in batches
    let importedCount = 0;
    const skippedInvalidCount = normalizedRows.filter(
      (r) => r.status === "invalid"
    ).length;
    const skippedDuplicateCount = rowsWithDuplicates.filter(
      (r) =>
        r.isDuplicateCandidate &&
        decisions[r.rowIndex] !== "import"
    ).length;

    // Process in batches
    for (let i = 0; i < rowsToImport.length; i += BATCH_SIZE) {
      const batch = rowsToImport.slice(i, i + BATCH_SIZE);

      for (const row of batch) {
        if (!row.normalized) continue;

        const { normalized } = row;

        // Resolve vendor/client IDs (auto-create if needed)
        let vendorId: string | undefined;
        let clientId: string | undefined;

        if (normalized.type === "EXPENSE" && normalized.vendorName) {
          vendorId = await findOrCreateVendor(org.id, normalized.vendorName);
        }

        if (normalized.type === "INCOME" && normalized.clientName) {
          clientId = await findOrCreateClient(org.id, normalized.clientName);
        }

        // Upsert tags if present
        let tags: { id: string }[] = [];
        if (normalized.tagNames && normalized.tagNames.length > 0) {
          const upsertedTags = await upsertTagsForOrg(
            org.id,
            sanitizeTagNames(normalized.tagNames)
          );
          tags = upsertedTags;
        }

        // Create transaction
        const transaction = await db.transaction.create({
          data: {
            organizationId: org.id,
            accountId: normalized.accountId,
            categoryId: normalized.categoryId,
            userId: user.id,
            type: normalized.type,
            status: "POSTED",
            amountBase: normalized.amountBase,
            currencyBase: normalized.currencyBase,
            amountSecondary: normalized.amountSecondary,
            currencySecondary: normalized.currencySecondary,
            amountOriginal: normalized.amountOriginal,
            currencyOriginal: normalized.currencyOriginal,
            exchangeRateToBase: normalized.exchangeRateToBase,
            date: normalized.date,
            description: normalized.description,
            vendorId,
            vendorName: normalized.vendorName,
            clientId,
            clientName: normalized.clientName,
            notes: normalized.notes,
          },
        });

        // Link tags
        if (tags.length > 0) {
          await db.transactionTag.createMany({
            data: tags.map((tag) => ({
              transactionId: transaction.id,
              tagId: tag.id,
            })),
          });
        }

        importedCount++;
      }
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        action: "transaction_import_commit",
        userId: user.id,
        organizationId: org.id,
        metadata: {
          filename: file.name,
          importedCount,
          skippedInvalidCount,
          skippedDuplicateCount,
          totalRows: rowsWithDuplicates.length,
        },
      },
    });

    return NextResponse.json({
      importedCount,
      skippedInvalidCount,
      skippedDuplicateCount,
      totalRows: rowsWithDuplicates.length,
    });
  } catch (error) {
    console.error("Error committing CSV import:", error);
    return NextResponse.json(
      {
        error: "Failed to commit import",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
