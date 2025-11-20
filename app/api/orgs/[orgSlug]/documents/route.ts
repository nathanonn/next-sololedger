/**
 * Document Upload and List API
 * POST: Upload documents (multipart/form-data)
 * GET: List documents with filters and pagination
 */

import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership } from "@/lib/org-helpers";
import { getDocumentStorage } from "@/lib/document-storage";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import path from "path";

export const runtime = "nodejs";

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "text/plain",
];

// Max file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface DocumentSummary {
  id: string;
  filenameOriginal: string;
  displayName: string;
  mimeType: string;
  fileSizeBytes: number;
  type: string;
  documentDate: Date | null;
  uploadedAt: Date;
  uploadedBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface FileError {
  filename: string;
  error: string;
}

/**
 * POST /api/orgs/[orgSlug]/documents
 * Upload one or more documents
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

    // Verify user is a member of the organization
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


    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    const documents: DocumentSummary[] = [];
    const errors: FileError[] = [];
    const storage = getDocumentStorage();

    // Process each file
    for (const file of files) {
      try {
        // Validate file
        if (!file.name) {
          errors.push({
            filename: "unknown",
            error: "File has no name",
          });
          continue;
        }

        if (file.size > MAX_FILE_SIZE) {
          errors.push({
            filename: file.name,
            error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          });
          continue;
        }

        const mimeType = file.type;
        if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
          errors.push({
            filename: file.name,
            error: `File type ${mimeType} not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
          });
          continue;
        }

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Save file to storage
        const storedMeta = await storage.save({
          organizationId: org.id,
          file: buffer,
          mimeType,
          originalName: file.name,
        });

        // Generate display name (filename without extension)
        const ext = path.extname(file.name);
        const displayName = ext
          ? file.name.substring(0, file.name.length - ext.length)
          : file.name;

        // Create document record in database
        const document = await db.document.create({
          data: {
            organizationId: org.id,
            uploadedByUserId: user.id,
            storageKey: storedMeta.storageKey,
            filenameOriginal: file.name,
            displayName,
            mimeType: storedMeta.mimeType,
            fileSizeBytes: storedMeta.fileSizeBytes,
            type: "OTHER", // Default type, can be changed later
            documentDate: null,
            textContent: null,
          },
          include: {
            uploadedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        // Log audit event
        await db.auditLog.create({
          data: {
            action: "document.upload",
            userId: user.id,
            organizationId: org.id,
            metadata: {
              documentId: document.id,
              filename: file.name,
              mimeType: document.mimeType,
              fileSizeBytes: document.fileSizeBytes,
            },
          },
        });

        documents.push({
          id: document.id,
          filenameOriginal: document.filenameOriginal,
          displayName: document.displayName,
          mimeType: document.mimeType,
          fileSizeBytes: document.fileSizeBytes,
          type: document.type,
          documentDate: document.documentDate,
          uploadedAt: document.uploadedAt,
          uploadedBy: document.uploadedByUser,
        });
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        errors.push({
          filename: file.name,
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    }

    return NextResponse.json({
      documents,
      errors,
      success: documents.length > 0,
    });
  } catch (error) {
    console.error("Error in document upload:", error);
    return NextResponse.json(
      { error: "Failed to upload documents" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orgs/[orgSlug]/documents
 * List and search documents with filters and pagination
 *
 * Query params:
 * - page: Page number (default 1)
 * - pageSize: Items per page (default 20)
 * - dateFrom: ISO date string (filter by document date or upload date)
 * - dateTo: ISO date string (filter by document date or upload date)
 * - linked: "all" | "linked" | "unlinked" (default "all")
 * - vendorId: Filter by linked transactions' vendor
 * - clientId: Filter by linked transactions' client
 * - amountMin: Minimum amount in base currency
 * - amountMax: Maximum amount in base currency
 * - fileType: "all" | "image" | "pdf" | "text" (default "all")
 * - uploaderId: Filter by uploader user ID
 * - q: Free-text search (filename, display name, text content, vendor/client names)
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const linked = searchParams.get("linked") || "all"; // all | linked | unlinked
    const vendorId = searchParams.get("vendorId");
    const clientId = searchParams.get("clientId");
    const amountMin = searchParams.get("amountMin");
    const amountMax = searchParams.get("amountMax");
    const fileType = searchParams.get("fileType") || "all"; // all | image | pdf | text
    const uploaderId = searchParams.get("uploaderId");
    const q = searchParams.get("q"); // Search query

    // Build where clause
    const where: Prisma.DocumentWhereInput = {
      organizationId: org.id,
      deletedAt: null,
    };

    // Date range filter (documentDate with fallback to uploadedAt)
    if (dateFrom || dateTo) {
      const dateConditions: Prisma.DocumentWhereInput[] = [];

      if (dateFrom && dateTo) {
        dateConditions.push({
          documentDate: { gte: new Date(dateFrom), lte: new Date(dateTo) },
        });
        dateConditions.push({
          documentDate: null,
          uploadedAt: { gte: new Date(dateFrom), lte: new Date(dateTo) },
        });
      } else if (dateFrom) {
        dateConditions.push({ documentDate: { gte: new Date(dateFrom) } });
        dateConditions.push({
          documentDate: null,
          uploadedAt: { gte: new Date(dateFrom) },
        });
      } else if (dateTo) {
        dateConditions.push({ documentDate: { lte: new Date(dateTo) } });
        dateConditions.push({
          documentDate: null,
          uploadedAt: { lte: new Date(dateTo) },
        });
      }

      if (dateConditions.length > 0) {
        where.OR = dateConditions;
      }
    }

    // Linked status filter
    if (linked === "linked") {
      where.transactions = { some: {} };
    } else if (linked === "unlinked") {
      where.transactions = { none: {} };
    }

    // Vendor filter (via linked transactions)
    if (vendorId) {
      where.transactions = {
        ...where.transactions,
        some: {
          ...where.transactions?.some,
          transaction: {
            ...where.transactions?.some?.transaction,
            vendorId,
          },
        },
      };
    }

    // Client filter (via linked transactions)
    if (clientId) {
      where.transactions = {
        ...where.transactions,
        some: {
          ...where.transactions?.some,
          transaction: {
            ...where.transactions?.some?.transaction,
            clientId,
          },
        },
      };
    }

    // Amount filter
    if (amountMin || amountMax) {
      const amountCondition: Prisma.DecimalFilter = {};
      if (amountMin) amountCondition.gte = parseFloat(amountMin);
      if (amountMax) amountCondition.lte = parseFloat(amountMax);

      // For linked docs, filter by transaction amount
      // For unlinked docs, search in text content (basic implementation)
      where.transactions = {
        ...where.transactions,
        some: {
          ...where.transactions?.some,
          transaction: {
            ...where.transactions?.some?.transaction,
            amountBase: amountCondition,
          },
        },
      };
    }

    // File type filter
    if (fileType === "image") {
      where.mimeType = { in: ["image/jpeg", "image/png"] };
    } else if (fileType === "pdf") {
      where.mimeType = "application/pdf";
    } else if (fileType === "text") {
      where.mimeType = "text/plain";
    }

    // Uploader filter
    if (uploaderId) {
      where.uploadedByUserId = uploaderId;
    }

    // Search query (filename, display name, text content, vendor/client names)
    if (q && q.trim()) {
      const searchTerm = q.trim();
      const searchConditions: Prisma.DocumentWhereInput[] = [
        { filenameOriginal: { contains: searchTerm, mode: "insensitive" } },
        { displayName: { contains: searchTerm, mode: "insensitive" } },
        { textContent: { contains: searchTerm, mode: "insensitive" } },
      ];

      // Search in linked transactions' vendor/client names
      searchConditions.push({
        transactions: {
          some: {
            transaction: {
              OR: [
                { vendor: { name: { contains: searchTerm, mode: "insensitive" } } },
                { client: { name: { contains: searchTerm, mode: "insensitive" } } },
              ],
            },
          },
        },
      });

      // Combine with existing conditions
      if (where.OR) {
        // If there's already an OR (from date range), wrap everything
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions },
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
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
          transactions: {
            include: {
              transaction: {
                select: {
                  id: true,
                  date: true,
                  description: true,
                  amountBase: true,
                  currencyBase: true,
                  type: true,
                  categoryId: true,
                  vendorId: true,
                  clientId: true,
                },
              },
            },
            take: 5, // Limit to first 5 linked transactions for preview
          },
        },
        orderBy: [
          { documentDate: "desc" },
          { uploadedAt: "desc" },
        ],
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
      uploadedBy: doc.uploadedByUser,
      isLinked: doc.transactions.length > 0,
      linkedTransactionCount: doc.transactions.length,
      linkedTransactions: doc.transactions.slice(0, 3).map((td) => ({
        id: td.transaction.id,
        date: td.transaction.date,
        description: td.transaction.description,
        amountBase: td.transaction.amountBase,
        currencyBase: td.transaction.currencyBase,
        type: td.transaction.type,
      })),
    }));

    return NextResponse.json({
      items,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      totalItems: total,
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
