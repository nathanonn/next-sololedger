import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/transactions/import-templates
 * List all CSV import templates for the organization
 * Requires: Member or Admin
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

    // Verify user is member
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

    // Fetch templates
    const templates = await db.csvImportTemplate.findMany({
      where: { organizationId: org.id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching import templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch import templates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orgs/[orgSlug]/transactions/import-templates
 * Create a new CSV import template
 * Requires: Member or Admin
 */

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  config: z.object({
    columnMapping: z.object({
      date: z.string().optional(),
      amount: z.string().optional(),
      currency: z.string().optional(),
      type: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      account: z.string().optional(),
      vendor: z.string().optional(),
      client: z.string().optional(),
      notes: z.string().optional(),
      tags: z.string().optional(),
      secondaryAmount: z.string().optional(),
      secondaryCurrency: z.string().optional(),
    }),
    parsingOptions: z.object({
      delimiter: z.string(),
      headerRowIndex: z.number(),
      hasHeaders: z.boolean(),
      dateFormat: z.enum(["DD_MM_YYYY", "MM_DD_YYYY", "YYYY_MM_DD"]),
      decimalSeparator: z.enum(["DOT", "COMMA"]),
      thousandsSeparator: z.enum(["COMMA", "DOT", "SPACE", "NONE"]),
      directionMode: z.enum(["type_column", "sign_based"]),
    }),
  }),
});

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

    // Verify user is member
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

    // Parse and validate body
    const body = await request.json();
    const validatedData = createTemplateSchema.parse(body);

    // Check for duplicate name
    const existing = await db.csvImportTemplate.findUnique({
      where: {
        organizationId_name: {
          organizationId: org.id,
          name: validatedData.name,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Template with this name already exists" },
        { status: 409 }
      );
    }

    // Create template
    const template = await db.csvImportTemplate.create({
      data: {
        organizationId: org.id,
        name: validatedData.name,
        config: validatedData.config,
        createdByUserId: user.id,
      },
      select: {
        id: true,
        name: true,
        config: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating import template:", error);
    return NextResponse.json(
      { error: "Failed to create import template" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orgs/[orgSlug]/transactions/import-templates/[id]
 * This will be handled in a separate [id]/route.ts file
 */
