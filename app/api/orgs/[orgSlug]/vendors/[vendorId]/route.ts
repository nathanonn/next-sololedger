import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";
import { z } from "zod";

export const runtime = "nodejs";

const updateVendorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: z.string().max(50).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  active: z.boolean().optional(),
});

/**
 * PATCH /api/orgs/[orgSlug]/vendors/[vendorId]
 * Update a vendor
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; vendorId: string }> }
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgSlug, vendorId } = await params;

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

    // Parse and validate request body
    const body = await request.json();
    const validation = updateVendorSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Get existing vendor
    const existingVendor = await db.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!existingVendor || existingVendor.organizationId !== org.id) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // If name is being changed, check for uniqueness
    if (data.name && data.name !== existingVendor.name) {
      const duplicateVendor = await db.vendor.findFirst({
        where: {
          organizationId: org.id,
          nameLower: data.name.toLowerCase(),
          id: { not: vendorId },
        },
      });

      if (duplicateVendor) {
        return NextResponse.json(
          {
            error:
              "A vendor with this name already exists in your organization",
          },
          { status: 409 }
        );
      }
    }

    // Build update data
    const updateData: {
      name?: string;
      nameLower?: string;
      email?: string | null;
      phone?: string | null;
      notes?: string | null;
      active?: boolean;
    } = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
      updateData.nameLower = data.name.toLowerCase();
    }
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.active !== undefined) updateData.active = data.active;

    // Update vendor
    const vendor = await db.vendor.update({
      where: { id: vendorId },
      data: updateData,
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
    console.error("Error updating vendor:", error);
    return NextResponse.json(
      { error: "Failed to update vendor" },
      { status: 500 }
    );
  }
}
