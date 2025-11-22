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
import { parseTransactionsZip } from "@/lib/import/zip-transactions";
import { validateImportDocumentsForZip } from "@/lib/import/transactions-documents";
import { normalizeDocumentPath, guessMimeType } from "@/lib/import/zip-transactions";
import { validateDocumentFile } from "@/lib/documents/validation";
import { getDocumentStorage } from "@/lib/documents/storage";
import { upsertTagsForOrg, sanitizeTagNames } from "@/lib/tag-helpers";
import type { DocumentType } from "@prisma/client";

export const runtime = "nodejs";

// Import mode type
export type ImportMode = "csv" | "zip_with_documents";

// Extended config with import mode
interface ExtendedImportConfig extends ImportTemplateConfig {
  importMode?: ImportMode;
}

// Max file size for CSV: 10 MB (no limit for ZIP)
const MAX_CSV_FILE_SIZE = 10 * 1024 * 1024;

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

    // Parse decisions first
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

    // Parse mapping config to determine import mode
    let mappingConfig: ExtendedImportConfig;
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

        mappingConfig = template.config as unknown as ExtendedImportConfig;

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
        // Allow importMode override from current wizard state
        if (parsed.importMode) {
          mappingConfig.importMode = parsed.importMode;
        }
      } else {
        mappingConfig = parsed as ExtendedImportConfig;
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid mapping configuration JSON" },
        { status: 400 }
      );
    }

    // Default to CSV mode for backward compatibility
    const importMode: ImportMode = mappingConfig.importMode || "csv";

    // Validate file based on import mode
    if (importMode === "csv") {
      // CSV mode: enforce 10MB limit and .csv extension
      if (file.size > MAX_CSV_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `File exceeds maximum size of ${MAX_CSV_FILE_SIZE / 1024 / 1024}MB`,
          },
          { status: 400 }
        );
      }

      if (!file.name.toLowerCase().endsWith(".csv")) {
        return NextResponse.json(
          { error: "Only CSV files are supported in CSV mode" },
          { status: 400 }
        );
      }
    } else if (importMode === "zip_with_documents") {
      // ZIP mode: require .zip extension, no size limit
      if (!file.name.toLowerCase().endsWith(".zip")) {
        return NextResponse.json(
          { error: "ZIP file required in advanced ZIP mode" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: `Invalid import mode: ${importMode}` },
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
    const fileBuffer = Buffer.from(arrayBuffer);

    // Parse based on import mode
    let csvBuffer: Buffer;
    let documentsByPath: Map<string, { buffer: Buffer; originalName: string }> | null = null;

    if (importMode === "zip_with_documents") {
      // ZIP mode: extract transactions.csv and documents
      try {
        const zipData = await parseTransactionsZip(fileBuffer);
        csvBuffer = zipData.transactionsCsv;
        documentsByPath = zipData.documentsByPath;
      } catch (error) {
        return NextResponse.json(
          {
            error: "Failed to parse ZIP file",
            details: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 400 }
        );
      }
    } else {
      // CSV mode: use file buffer directly
      csvBuffer = fileBuffer;
    }

    // Re-run the full pipeline (stateless design)
    let parsedData;
    try {
      parsedData = parseCsvBuffer(csvBuffer, mappingConfig.parsingOptions);
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

    let normalizedRows = await normalizeAndValidateRows(
      rawRows,
      org.id,
      settings,
      mappingConfig.parsingOptions
    );

    // Validate documents in ZIP mode
    if (importMode === "zip_with_documents" && documentsByPath) {
      normalizedRows = validateImportDocumentsForZip(
        normalizedRows,
        documentsByPath
      );
    }

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
    let documentsCreated = 0;
    let documentLinksCreated = 0;
    const skippedInvalidCount = normalizedRows.filter(
      (r) => r.status === "invalid"
    ).length;
    const skippedDuplicateCount = rowsWithDuplicates.filter(
      (r) =>
        r.isDuplicateCandidate &&
        decisions[r.rowIndex] !== "import"
    ).length;

    // Map to deduplicate documents (path -> document ID)
    const docPathToDocumentId = new Map<string, string>();

    // Get document storage instance (for ZIP mode)
    const documentStorage = getDocumentStorage();

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

        // Handle document upload and linking (ZIP mode only)
        if (importMode === "zip_with_documents" && row.documentPath && documentsByPath) {
          const normalizedPath = normalizeDocumentPath(row.documentPath);
          const documentEntry = documentsByPath.get(normalizedPath);

          if (documentEntry) {
            // Check if we've already uploaded this document
            let documentId = docPathToDocumentId.get(normalizedPath);

            if (!documentId) {
              // Upload and create document record
              const { buffer, originalName } = documentEntry;
              const mimeType = guessMimeType(originalName);

              if (mimeType) {
                // Double-check validation (should have passed in preview, but safety first)
                const validationError = validateDocumentFile({
                  mimeType,
                  sizeBytes: buffer.length,
                });

                if (!validationError) {
                  try {
                    // Save to storage
                    const savedDoc = await documentStorage.save(
                      buffer,
                      originalName,
                      mimeType
                    );

                    // Determine document type based on transaction type
                    let docType: DocumentType = "OTHER";
                    if (normalized.type === "INCOME") {
                      docType = "INVOICE";
                    } else if (normalized.type === "EXPENSE") {
                      docType = "RECEIPT";
                    }

                    // Extract filename without extension for display name
                    const displayName = originalName.replace(/\.[^/.]+$/, "");

                    // Create document record
                    const document = await db.document.create({
                      data: {
                        organizationId: org.id,
                        uploadedByUserId: user.id,
                        storageKey: savedDoc.storageKey,
                        filenameOriginal: originalName,
                        displayName,
                        mimeType: savedDoc.mimeType,
                        fileSizeBytes: savedDoc.fileSizeBytes,
                        type: docType,
                        documentDate: normalized.date,
                        textContent: null,
                      },
                    });

                    documentId = document.id;
                    docPathToDocumentId.set(normalizedPath, documentId);
                    documentsCreated++;
                  } catch (error) {
                    // Log error but don't fail the import
                    console.error(
                      `Failed to upload document ${originalName}:`,
                      error
                    );
                  }
                }
              }
            }

            // Link document to transaction if we have a document ID
            if (documentId) {
              try {
                await db.transactionDocument.create({
                  data: {
                    transactionId: transaction.id,
                    documentId,
                  },
                });
                documentLinksCreated++;
              } catch (error) {
                // Log error but don't fail the import
                console.error(
                  `Failed to link document to transaction ${transaction.id}:`,
                  error
                );
              }
            }
          }
        }

        importedCount++;
      }
    }

    // Create audit log
    const auditMetadata: Record<string, unknown> = {
      filename: file.name,
      importedCount,
      skippedInvalidCount,
      skippedDuplicateCount,
      totalRows: rowsWithDuplicates.length,
    };

    if (importMode === "zip_with_documents") {
      auditMetadata.importMode = "zip_with_documents";
      auditMetadata.documentsCreated = documentsCreated;
      auditMetadata.documentLinksCreated = documentLinksCreated;
    }

    await db.auditLog.create({
      data: {
        action: "transaction_import_commit",
        userId: user.id,
        organizationId: org.id,
        metadata: auditMetadata as any,
      },
    });

    // Return response
    const response: Record<string, unknown> = {
      importedCount,
      skippedInvalidCount,
      skippedDuplicateCount,
      totalRows: rowsWithDuplicates.length,
    };

    if (importMode === "zip_with_documents") {
      response.documentsCreated = documentsCreated;
      response.documentLinksCreated = documentLinksCreated;
    }

    return NextResponse.json(response);
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
