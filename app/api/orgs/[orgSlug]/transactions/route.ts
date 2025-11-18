import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";
import { isValidCurrencyCode } from "@/lib/currencies";

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
    const clientId = searchParams.get("clientId");
    const vendorId = searchParams.get("vendorId");
    const categoryIds = searchParams.get("categoryIds");
    const amountMin = searchParams.get("amountMin");
    const amountMax = searchParams.get("amountMax");
    const currency = searchParams.get("currency");

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

    if (clientId) {
      where.clientId = clientId;
    }

    if (vendorId) {
      where.vendorId = vendorId;
    }

    // Category multi-select filter (comma-separated IDs)
    if (categoryIds) {
      const categoryIdArray = categoryIds.split(",").filter((id) => id.trim());
      if (categoryIdArray.length > 0) {
        where.categoryId = { in: categoryIdArray };
      }
    }

    // Amount range filter (base currency)
    if (amountMin || amountMax) {
      where.amountBase = {};
      if (amountMin) {
        const min = parseFloat(amountMin);
        if (!isNaN(min)) {
          (where.amountBase as Record<string, unknown>).gte = min;
        }
      }
      if (amountMax) {
        const max = parseFloat(amountMax);
        if (!isNaN(max)) {
          (where.amountBase as Record<string, unknown>).lte = max;
        }
      }
    }

    // Currency filter
    // - "BASE" or org's base currency = base-only transactions (currencySecondary = null)
    // - Any other 3-letter code = dual-currency transactions with that secondary currency
    if (currency) {
      const upperCurrency = currency.toUpperCase();
      if (upperCurrency === "BASE" || upperCurrency === orgSettings.baseCurrency.toUpperCase()) {
        where.currencySecondary = null;
      } else if (currency.length === 3) {
        where.currencySecondary = upperCurrency;
      }
    }

    // Get transactions
    const transactions = await db.transaction.findMany({
      where,
      include: {
        category: true,
        account: true,
        vendor: true,
        client: true,
        _count: {
          select: {
            documents: true,
          },
        },
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

    // Load organization settings to get base currency
    const orgSettings = await db.organizationSettings.findUnique({
      where: { organizationId: org.id },
      select: { baseCurrency: true },
    });

    if (!orgSettings?.baseCurrency) {
      return NextResponse.json(
        { error: "Organization base currency not configured" },
        { status: 400 }
      );
    }

    const baseCurrency = orgSettings.baseCurrency.toUpperCase();

    // Validate request body - dual-currency model
    // NOTE: currencyBase is NOT accepted from client - always forced to org's baseCurrency
    const transactionSchema = z
      .object({
        type: z.enum(["INCOME", "EXPENSE"]),
        status: z.enum(["DRAFT", "POSTED"]),
        amountBase: z.number().positive("Base amount must be greater than 0"),
        amountSecondary: z.number().positive().nullable().optional(),
        currencySecondary: z
          .string()
          .length(3)
          .transform((val) => val.toUpperCase())
          .nullable()
          .optional(),
        date: z.string().refine((val) => !isNaN(Date.parse(val)), {
          message: "Invalid date",
        }),
        description: z.string().min(1, "Description is required"),
        categoryId: z.string().min(1, "Category is required"),
        accountId: z.string().min(1, "Account is required"),
        vendorId: z.string().nullable().optional(),
        vendorName: z.string().nullable().optional(),
        clientId: z.string().nullable().optional(),
        clientName: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
      .refine(
        (data) => {
          // If either secondary amount or currency is provided, both must be provided
          const hasSecondaryAmount = data.amountSecondary !== null && data.amountSecondary !== undefined;
          const hasSecondaryCurrency = data.currencySecondary !== null && data.currencySecondary !== undefined;
          return hasSecondaryAmount === hasSecondaryCurrency;
        },
        {
          message: "Both amountSecondary and currencySecondary must be provided together",
          path: ["amountSecondary"],
        }
      );

    const body = await request.json();
    const validation = transactionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Validate secondary currency code if provided
    if (data.currencySecondary && !isValidCurrencyCode(data.currencySecondary)) {
      return NextResponse.json(
        { error: `Invalid currency code: ${data.currencySecondary}` },
        { status: 400 }
      );
    }

    // Enforce strict per-type relationship rules (3/a)
    if (data.type === "INCOME") {
      // Income transactions can only have client, not vendor
      if (data.vendorId || data.vendorName) {
        return NextResponse.json(
          { error: "Income transactions cannot have vendors. Use clients instead." },
          { status: 400 }
        );
      }
    } else if (data.type === "EXPENSE") {
      // Expense transactions can only have vendor, not client
      if (data.clientId || data.clientName) {
        return NextResponse.json(
          { error: "Expense transactions cannot have clients. Use vendors instead." },
          { status: 400 }
        );
      }
    }

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

    // Handle client (for INCOME transactions)
    let finalClientId = data.clientId;
    let finalClientName = data.clientName;

    if (data.type === "INCOME") {
      if (!finalClientId && data.clientName && data.clientName.trim()) {
        // If clientId not provided but clientName is, look up or create client
        const clientName = data.clientName.trim();

        // Look for existing client (case-insensitive via nameLower)
        let client = await db.client.findFirst({
          where: {
            organizationId: org.id,
            nameLower: clientName.toLowerCase(),
          },
        });

        // Create client if it doesn't exist
        if (!client) {
          client = await db.client.create({
            data: {
              organizationId: org.id,
              name: clientName,
              nameLower: clientName.toLowerCase(),
              active: true,
            },
          });
        }

        finalClientId = client.id;
        finalClientName = client.name;
      }

      // Verify clientId if provided
      if (finalClientId) {
        const client = await db.client.findUnique({
          where: { id: finalClientId },
        });

        if (!client || client.organizationId !== org.id) {
          return NextResponse.json(
            { error: "Client not found" },
            { status: 400 }
          );
        }

        finalClientName = client.name;
      }
    }

    // Handle vendor (for EXPENSE transactions)
    let finalVendorId = data.vendorId;
    let finalVendorName = data.vendorName;

    if (data.type === "EXPENSE") {
      if (!finalVendorId && data.vendorName && data.vendorName.trim()) {
        // If vendorId not provided but vendorName is, look up or create vendor
        const vendorName = data.vendorName.trim();

        // Look for existing vendor (case-insensitive via nameLower)
        let vendor = await db.vendor.findFirst({
          where: {
            organizationId: org.id,
            nameLower: vendorName.toLowerCase(),
          },
        });

        // Create vendor if it doesn't exist
        if (!vendor) {
          vendor = await db.vendor.create({
            data: {
              organizationId: org.id,
              name: vendorName,
              nameLower: vendorName.toLowerCase(),
              active: true,
            },
          });
        }

        finalVendorId = vendor.id;
        finalVendorName = vendor.name;
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

        finalVendorName = vendor.name;
      }
    }

    // Prepare dual-currency fields
    const isDualCurrency = !!(data.amountSecondary && data.currencySecondary);

    // Calculate legacy fields for backward compatibility
    let legacyCurrencyOriginal: string;
    let legacyAmountOriginal: number;
    let legacyExchangeRateToBase: number;

    if (isDualCurrency) {
      // Dual-currency transaction: secondary is the "original" currency
      legacyCurrencyOriginal = data.currencySecondary!;
      legacyAmountOriginal = data.amountSecondary!;
      legacyExchangeRateToBase = data.amountBase / data.amountSecondary!;
    } else {
      // Base-only transaction: base is the "original" currency
      legacyCurrencyOriginal = baseCurrency;
      legacyAmountOriginal = data.amountBase;
      legacyExchangeRateToBase = 1.0;
    }

    // Create transaction
    const transaction = await db.transaction.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        type: data.type,
        status: data.status,
        // Dual-currency model fields - currencyBase is ALWAYS org's baseCurrency
        amountBase: data.amountBase,
        currencyBase: baseCurrency,
        amountSecondary: data.amountSecondary || null,
        currencySecondary: data.currencySecondary || null,
        // Legacy fields (for migration period)
        amountOriginal: legacyAmountOriginal,
        currencyOriginal: legacyCurrencyOriginal,
        exchangeRateToBase: legacyExchangeRateToBase,
        date: transactionDate,
        description: data.description,
        categoryId: data.categoryId,
        accountId: data.accountId,
        vendorId: finalVendorId || null,
        vendorName: finalVendorName || null,
        clientId: finalClientId || null,
        clientName: finalClientName || null,
        notes: data.notes || null,
      },
      include: {
        category: true,
        account: true,
        vendor: true,
        client: true,
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
