import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";
import { z } from "zod";

export const runtime = "nodejs";

const updateClientSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: z.string().max(50).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  active: z.boolean().optional(),
});

/**
 * PATCH /api/orgs/[orgSlug]/clients/[clientId]
 * Update a client
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; clientId: string }> }
): Promise<Response> {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgSlug, clientId } = await params;

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
    const validation = updateClientSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Get existing client
    const existingClient = await db.client.findUnique({
      where: { id: clientId },
    });

    if (!existingClient || existingClient.organizationId !== org.id) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // If name is being changed, check for uniqueness
    if (data.name && data.name !== existingClient.name) {
      const duplicateClient = await db.client.findFirst({
        where: {
          organizationId: org.id,
          nameLower: data.name.toLowerCase(),
          id: { not: clientId },
        },
      });

      if (duplicateClient) {
        return NextResponse.json(
          {
            error:
              "A client with this name already exists in your organization",
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

    // Update client
    const client = await db.client.update({
      where: { id: clientId },
      data: updateData,
    });

    return NextResponse.json({
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        notes: client.notes,
        active: client.active,
      },
    });
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 }
    );
  }
}
