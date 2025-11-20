import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";
import { z } from "zod";

export const runtime = "nodejs";

const mergeClientsSchema = z.object({
  primaryId: z.string().min(1, "Primary client ID is required"),
  ids: z.array(z.string()).min(1, "At least one client to merge is required"),
});

/**
 * POST /api/orgs/[orgSlug]/clients/merge
 * Merge multiple clients into one primary client
 */
export async function POST(
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
    // Validate API key organization access
    if (!validateApiKeyOrgAccess(user, org.id)) {
      return NextResponse.json(
        { error: "API key not authorized for this organization" },
        { status: 403 }
      );
    }


    // Parse and validate request body
    const body = await request.json();
    const validation = mergeClientsSchema.safeParse(body);

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
        { error: "Primary client cannot be in the list of clients to merge" },
        { status: 400 }
      );
    }

    // Get all clients (primary + secondaries)
    const allClientIds = [primaryId, ...ids];
    const clients = await db.client.findMany({
      where: {
        id: { in: allClientIds },
      },
    });

    // Validate all clients exist
    if (clients.length !== allClientIds.length) {
      return NextResponse.json(
        { error: "One or more clients not found" },
        { status: 404 }
      );
    }

    // Validate all clients belong to this organization
    const invalidClients = clients.filter((c) => c.organizationId !== org.id);
    if (invalidClients.length > 0) {
      return NextResponse.json(
        { error: "All clients must belong to this organization" },
        { status: 400 }
      );
    }

    // Get primary client
    const primaryClient = clients.find((c) => c.id === primaryId);
    if (!primaryClient) {
      return NextResponse.json(
        { error: "Primary client not found" },
        { status: 404 }
      );
    }

    // Validate primary client is active
    if (!primaryClient.active) {
      return NextResponse.json(
        { error: "Primary client must be active" },
        { status: 400 }
      );
    }

    // Perform merge in a transaction
    const result = await db.$transaction(async (tx) => {
      // Update all transactions from secondary clients to primary client
      const transactionUpdate = await tx.transaction.updateMany({
        where: {
          organizationId: org.id,
          clientId: { in: ids },
        },
        data: {
          clientId: primaryId,
        },
      });

      // Deactivate and mark secondary clients as merged
      await Promise.all(
        ids.map((clientId) =>
          tx.client.update({
            where: { id: clientId },
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
          action: "client.merge",
          userId: user.id,
          email: user.email,
          organizationId: org.id,
          metadata: {
            primaryClientId: primaryId,
            primaryClientName: primaryClient.name,
            mergedClientIds: ids,
            mergedClientNames: clients
              .filter((c) => ids.includes(c.id))
              .map((c) => c.name),
            transactionsReassigned: transactionUpdate.count,
          },
        },
      });

      return {
        transactionsReassigned: transactionUpdate.count,
        clientsMerged: ids.length,
      };
    });

    return NextResponse.json({
      message: "Clients merged successfully",
      primaryClient: {
        id: primaryClient.id,
        name: primaryClient.name,
      },
      reassignedCount: result.transactionsReassigned,
      ...result,
    });
  } catch (error) {
    console.error("Error merging clients:", error);
    return NextResponse.json(
      { error: "Failed to merge clients" },
      { status: 500 }
    );
  }
}
