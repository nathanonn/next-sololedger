import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, requireMembership } from "@/lib/org-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Validation schema for PATCH (all fields optional)
const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z
    .object({
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
        document: z.string().optional(),
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
    })
    .optional(),
});

/**
 * GET /api/orgs/[orgSlug]/transactions/import-templates/[id]
 * Get a specific import template with full config
 * Requires: Member or Admin
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; id: string }> }
): Promise<Response> {
  try {
    const { orgSlug, id } = await params;
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

    // Fetch template
    const template = await db.csvImportTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        config: true,
        createdAt: true,
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Verify template belongs to this organization
    const templateOrg = await db.csvImportTemplate.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (templateOrg?.organizationId !== org.id) {
      return NextResponse.json(
        { error: "Template not found in this organization" },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Error fetching import template:", error);
    return NextResponse.json(
      { error: "Failed to fetch import template" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orgs/[orgSlug]/transactions/import-templates/[id]
 * Delete an import template
 * Requires: Member or Admin
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; id: string }> }
): Promise<Response> {
  try {
    const { orgSlug, id } = await params;
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

    // Verify template belongs to this organization
    const template = await db.csvImportTemplate.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (template.organizationId !== org.id) {
      return NextResponse.json(
        { error: "Template not found in this organization" },
        { status: 404 }
      );
    }

    // Delete template
    await db.csvImportTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting import template:", error);
    return NextResponse.json(
      { error: "Failed to delete import template" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/orgs/[orgSlug]/transactions/import-templates/[id]
 * Update an import template (name and/or config)
 * Requires: Member or Admin
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; id: string }> }
): Promise<Response> {
  try {
    const { orgSlug, id } = await params;
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

    // Verify template exists and belongs to this organization
    const template = await db.csvImportTemplate.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (template.organizationId !== org.id) {
      return NextResponse.json(
        { error: "Template not found in this organization" },
        { status: 404 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const validatedData = updateTemplateSchema.parse(body);

    // If name is being changed, check for duplicates
    if (validatedData.name) {
      const existing = await db.csvImportTemplate.findUnique({
        where: {
          organizationId_name: {
            organizationId: org.id,
            name: validatedData.name,
          },
        },
      });

      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: "Template with this name already exists" },
          { status: 409 }
        );
      }
    }

    // Update template
    const updated = await db.csvImportTemplate.update({
      where: { id },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.config && { config: validatedData.config }),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        config: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ template: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating import template:", error);
    return NextResponse.json(
      { error: "Failed to update import template" },
      { status: 500 }
    );
  }
}
