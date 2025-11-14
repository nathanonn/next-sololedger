import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";
import { z } from "zod";

export const runtime = "nodejs";

const createVendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required").max(255),
  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: z.string().max(50).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

/**
 * GET /api/orgs/[orgSlug]/vendors
 * List vendors with optional search and totals
 * Query params:
 * - query: search term for name (autocomplete)
 * - from/to: date range for transaction totals
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
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
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Require membership
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const searchQuery = url.searchParams.get("query");
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    // Build where clause for vendors
    const whereClause: {
      organizationId: string;
      active?: boolean;
      name?: { contains: string; mode: "insensitive" };
    } = {
      organizationId: org.id,
    };

    // If search query provided, filter by name (autocomplete mode)
    if (searchQuery) {
      whereClause.name = {
        contains: searchQuery,
        mode: "insensitive" as const,
      };
    }

    // Get vendors
    const vendors = await db.vendor.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        notes: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: "asc" },
      // Limit results for autocomplete
      ...(searchQuery ? { take: 20 } : {}),
    });

    // If date range provided, calculate transaction totals per vendor
    if (fromParam && toParam) {
      const from = new Date(fromParam);
      const to = new Date(toParam);

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format" },
          { status: 400 }
        );
      }

      // Get transaction totals grouped by vendor
      const transactionTotals = await db.transaction.groupBy({
        by: ["vendorId"],
        where: {
          organizationId: org.id,
          vendorId: { not: null },
          status: "POSTED",
          date: {
            gte: from,
            lte: to,
          },
          deletedAt: null,
        },
        _count: {
          id: true,
        },
        _sum: {
          amountBase: true,
        },
      });

      // Create a map of vendor totals
      const totalsMap = new Map(
        transactionTotals.map((t) => [
          t.vendorId!,
          {
            count: t._count.id,
            totalAmount: t._sum.amountBase ? Number(t._sum.amountBase) : 0,
          },
        ])
      );

      // Add totals to vendors
      const vendorsWithTotals = vendors.map((vendor) => ({
        ...vendor,
        totals: totalsMap.get(vendor.id) || {
          count: 0,
          totalAmount: 0,
        },
      }));

      return NextResponse.json({
        vendors: vendorsWithTotals,
        dateRange: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
      });
    }

    return NextResponse.json({ vendors });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendors" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orgs/[orgSlug]/vendors
 * Create a new vendor
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
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
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Require membership (members can manage vendors)
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = createVendorSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Check for existing vendor with same name (case-insensitive)
    const existingVendor = await db.vendor.findFirst({
      where: {
        organizationId: org.id,
        name: {
          equals: data.name,
          mode: "insensitive",
        },
      },
    });

    if (existingVendor) {
      return NextResponse.json(
        {
          error: "A vendor with this name already exists in your organization",
        },
        { status: 409 }
      );
    }

    // Create vendor
    const vendor = await db.vendor.create({
      data: {
        organizationId: org.id,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        notes: data.notes || null,
        active: true,
      },
    });

    return NextResponse.json({
      vendor: {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        notes: vendor.notes,
        active: vendor.active,
      },
    });
  } catch (error) {
    console.error("Error creating vendor:", error);
    return NextResponse.json(
      { error: "Failed to create vendor" },
      { status: 500 }
    );
  }
}
