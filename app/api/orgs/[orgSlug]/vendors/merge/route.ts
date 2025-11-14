import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";
import { z } from "zod";

export const runtime = "nodejs";

const mergeVendorsSchema = z.object({
  primaryId: z.string().min(1, "Primary vendor ID is required"),
  ids: z.array(z.string()).min(1, "At least one vendor to merge is required"),
});

/**
 * POST /api/orgs/[orgSlug]/vendors/merge
 * Merge multiple vendors into one primary vendor
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

    // Require membership
    try {
      await requireMembership(user.id, org.id);
    } catch {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = mergeVendorsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { primaryId, ids } = validation.data;

    // Validate that primaryId is not in the ids list
    if (ids.includes(primaryId)) {
      return NextResponse.json(
        { error: "Primary vendor cannot be in the list of vendors to merge" },
        { status: 400 }
      );
    }

    // Get all vendors (primary + secondaries)
    const allVendorIds = [primaryId, ...ids];
    const vendors = await db.vendor.findMany({
      where: {
        id: { in: allVendorIds },
      },
    });

    // Validate all vendors exist
    if (vendors.length !== allVendorIds.length) {
      return NextResponse.json(
        { error: "One or more vendors not found" },
        { status: 404 }
      );
    }

    // Validate all vendors belong to this organization
    const invalidVendors = vendors.filter((v) => v.organizationId !== org.id);
    if (invalidVendors.length > 0) {
      return NextResponse.json(
        { error: "All vendors must belong to this organization" },
        { status: 400 }
      );
    }

    // Get primary vendor
    const primaryVendor = vendors.find((v) => v.id === primaryId);
    if (!primaryVendor) {
      return NextResponse.json(
        { error: "Primary vendor not found" },
        { status: 404 }
      );
    }

    // Validate primary vendor is active
    if (!primaryVendor.active) {
      return NextResponse.json(
        { error: "Primary vendor must be active" },
        { status: 400 }
      );
    }

    // Perform merge in a transaction
    const result = await db.$transaction(async (tx) => {
      // Update all transactions from secondary vendors to primary vendor
      const transactionUpdate = await tx.transaction.updateMany({
        where: {
          organizationId: org.id,
          vendorId: { in: ids },
        },
        data: {
          vendorId: primaryId,
        },
      });

      // Deactivate and mark secondary vendors as merged
      await Promise.all(
        ids.map((vendorId) =>
          tx.vendor.update({
            where: { id: vendorId },
            data: {
              active: false,
              mergedIntoId: primaryId,
            },
          })
        )
      );

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          action: "vendor.merge",
          userId: user.id,
          email: user.email,
          organizationId: org.id,
          metadata: {
            primaryVendorId: primaryId,
            primaryVendorName: primaryVendor.name,
            mergedVendorIds: ids,
            mergedVendorNames: vendors
              .filter((v) => ids.includes(v.id))
              .map((v) => v.name),
            transactionsReassigned: transactionUpdate.count,
          },
        },
      });

      return {
        transactionsReassigned: transactionUpdate.count,
        vendorsMerged: ids.length,
      };
    });

    return NextResponse.json({
      message: "Vendors merged successfully",
      primaryVendor: {
        id: primaryVendor.id,
        name: primaryVendor.name,
      },
      ...result,
    });
  } catch (error) {
    console.error("Error merging vendors:", error);
    return NextResponse.json(
      { error: "Failed to merge vendors" },
      { status: 500 }
    );
  }
}
