import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/clients
 * List clients with optional search
 * Members and admins can view
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

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

    // Get clients
    const clients = await db.client.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ clients });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orgs/[orgSlug]/clients
 * Create a new client
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
    const clientSchema = z.object({
      name: z.string().min(1, "Name is required"),
      email: z.string().email().nullable().optional(),
      phone: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    });

    const body = await request.json();
    const validation = clientSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;
    const nameLower = data.name.toLowerCase().trim();

    // Check for existing client with same name
    const existing = await db.client.findUnique({
      where: {
        organizationId_nameLower: {
          organizationId: org.id,
          nameLower,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A client with this name already exists" },
        { status: 400 }
      );
    }

    // Create client
    const client = await db.client.create({
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

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
