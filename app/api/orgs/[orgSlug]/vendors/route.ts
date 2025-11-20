import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/vendors
 * List vendors with optional search
 * Members and admins can view
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    const user = await getCurrentUser(request);
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
    // Validate API key organization access
    if (!validateApiKeyOrgAccess(user, org.id)) {
      return NextResponse.json(
        { error: "API key not authorized for this organization" },
        { status: 403 }
      );
    }


    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: org.id,
      active: true,
    };

    // Add search filter if query provided
    if (query && query.trim()) {
      where.nameLower = {
        contains: query.toLowerCase().trim(),
      };
    }

    // Get vendors
    const vendors = await db.vendor.findMany({
      where,
      orderBy: { name: "asc" },
    });

    // If date range provided, calculate totals for each vendor
    let vendorsWithTotals = vendors;
    if (from && to) {
      const totalsPromises = vendors.map(async (vendor) => {
        const transactions = await db.transaction.findMany({
          where: {
            organizationId: org.id,
            vendorId: vendor.id,
            type: "EXPENSE",
            status: "POSTED",
            deletedAt: null,
            date: {
              gte: new Date(from),
              lte: new Date(to),
            },
          },
          select: {
            amountBase: true,
          },
        });

        const totalAmount = transactions.reduce(
          (sum, t) => sum + Number(t.amountBase),
          0
        );

        return {
          ...vendor,
          totals: {
            transactionCount: transactions.length,
            totalAmount,
          },
        };
      });

      vendorsWithTotals = await Promise.all(totalsPromises);
    }

    return NextResponse.json({ vendors: vendorsWithTotals });
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
 * Members and admins can create
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    // CSRF validation
    const csrfError = await validateCsrf(request);
    if (csrfError) {
      return NextResponse.json({ error: csrfError }, { status: 403 });
    }

    const user = await getCurrentUser(request);
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
    const vendorSchema = z.object({
      name: z.string().min(1, "Name is required"),
      email: z.string().email().nullable().optional(),
      phone: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    });

    const body = await request.json();
    const validation = vendorSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;
    const nameLower = data.name.toLowerCase().trim();

    // Check for existing vendor with same name
    const existing = await db.vendor.findUnique({
      where: {
        organizationId_nameLower: {
          organizationId: org.id,
          nameLower,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A vendor with this name already exists" },
        { status: 400 }
      );
    }

    // Create vendor
    const vendor = await db.vendor.create({
      data: {
        organizationId: org.id,
        name: data.name.trim(),
        nameLower,
        email: data.email || null,
        phone: data.phone || null,
        notes: data.notes || null,
        active: true,
      },
    });

    return NextResponse.json({ vendor }, { status: 201 });
  } catch (error) {
    console.error("Error creating vendor:", error);
    return NextResponse.json(
      { error: "Failed to create vendor" },
      { status: 500 }
    );
  }
}
