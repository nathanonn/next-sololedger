import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/transactions
 * List transactions with optional filters
 * Members and admins can view
 */
export async function GET(
  request: Request,
  {  params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgSlug } = await params;

    // Get organization
    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Require membership
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: org.id,
      deletedAt: null,
    };

    if (type && (type === "INCOME" || type === "EXPENSE")) {
      where.type = type;
    }

    if (status && (status === "DRAFT" || status === "POSTED")) {
      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) {
        (where.date as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.date as Record<string, unknown>).lte = new Date(dateTo);
      }
    }

    // Get transactions
    const transactions = await db.transaction.findMany({
      where,
      include: {
        category: true,
        account: true,
        vendor: true,
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orgs/[orgSlug]/transactions
 * Create a new transaction
 * Members and admins can create
 */
export async function POST(
  request: Request,
  {  params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    // CSRF validation
    const csrfError = await validateCsrf(request);
    if (csrfError) {
      return NextResponse.json({ error: csrfError }, { status: 403 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgSlug } = await params;

    // Get organization
    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Require membership
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Validate request body
    const transactionSchema = z.object({
      type: z.enum(["INCOME", "EXPENSE"]),
      status: z.enum(["DRAFT", "POSTED"]),
      amountOriginal: z.number().positive("Amount must be greater than 0"),
      currencyOriginal: z
        .string()
        .length(3)
        .transform((val) => val.toUpperCase()),
      exchangeRateToBase: z.number().positive(),
      date: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid date",
      }),
      description: z.string().min(1, "Description is required"),
      categoryId: z.string().min(1, "Category is required"),
      accountId: z.string().min(1, "Account is required"),
      vendorId: z.string().nullable().optional(),
      vendorName: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    });

    const body = await request.json();
    const validation = transactionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;
    const transactionDate = new Date(data.date);
    const now = new Date();

    // Validate date rules
    if (data.status === "POSTED") {
      // Posted transactions cannot be in the future
      if (transactionDate > now) {
        return NextResponse.json(
          { error: "Posted transactions cannot have a future date" },
          { status: 400 }
        );
      }
    }

    // Verify category exists and belongs to org
    const category = await db.category.findUnique({
      where: { id: data.categoryId },
    });

    if (!category || category.organizationId !== org.id) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 400 }
      );
    }

    // Verify category type matches transaction type
    if (category.type !== data.type) {
      return NextResponse.json(
        { error: "Category type must match transaction type" },
        { status: 400 }
      );
    }

    // Verify account exists and belongs to org
    const account = await db.account.findUnique({
      where: { id: data.accountId },
    });

    if (!account || account.organizationId !== org.id) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 400 }
      );
    }

    // Handle vendor: use provided vendorId or auto-create from vendorName
    let finalVendorId = data.vendorId;

    if (!finalVendorId && data.vendorName && data.vendorName.trim()) {
      // If vendorId not provided but vendorName is, look up or create vendor
      const vendorName = data.vendorName.trim();

      // Look for existing vendor (case-insensitive)
      let vendor = await db.vendor.findFirst({
        where: {
          organizationId: org.id,
          name: {
            equals: vendorName,
            mode: "insensitive",
          },
        },
      });

      // Create vendor if it doesn't exist
      if (!vendor) {
        vendor = await db.vendor.create({
          data: {
            organizationId: org.id,
            name: vendorName,
            active: true,
          },
        });
      }

      finalVendorId = vendor.id;
    }

    // Verify vendorId if provided
    if (finalVendorId) {
      const vendor = await db.vendor.findUnique({
        where: { id: finalVendorId },
      });

      if (!vendor || vendor.organizationId !== org.id) {
        return NextResponse.json(
          { error: "Vendor not found" },
          { status: 400 }
        );
      }
    }

    // Calculate base amount
    const amountBase = data.amountOriginal * data.exchangeRateToBase;

    // Create transaction
    const transaction = await db.transaction.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        type: data.type,
        status: data.status,
        amountOriginal: data.amountOriginal,
        currencyOriginal: data.currencyOriginal,
        exchangeRateToBase: data.exchangeRateToBase,
        amountBase,
        date: transactionDate,
        description: data.description,
        categoryId: data.categoryId,
        accountId: data.accountId,
        vendorId: finalVendorId || null,
        vendorName: data.vendorName || null,
        notes: data.notes || null,
      },
      include: {
        category: true,
        account: true,
        vendor: true,
      },
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
