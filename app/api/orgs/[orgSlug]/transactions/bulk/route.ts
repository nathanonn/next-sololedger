import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";
import { isInSoftClosedPeriod } from "@/lib/periods";

export const runtime = "nodejs";

/**
 * POST /api/orgs/[orgSlug]/transactions/bulk
 * Perform bulk actions on multiple transactions
 * Members can perform bulk actions
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
    const bulkActionSchema = z.object({
      transactionIds: z.array(z.string()).min(1, "At least one transaction ID is required"),
      action: z.enum(["changeCategory", "changeStatus", "delete"]),
      categoryId: z.string().optional(),
      status: z.enum(["DRAFT", "POSTED"]).optional(),
      allowSoftClosedOverride: z.boolean().optional(),
    });

    const body = await request.json();
    const validation = bulkActionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Load org settings for soft-closed period checking
    const orgSettings = await db.organizationSettings.findUnique({
      where: { organizationId: org.id },
    });

    const softClosedBefore = orgSettings?.softClosedBefore || null;

    // Get all transactions belonging to this org (exclude already deleted)
    const transactions = await db.transaction.findMany({
      where: {
        id: { in: data.transactionIds },
        organizationId: org.id,
        deletedAt: null,
      },
      include: {
        category: true,
      },
    });

    // Track results
    let successCount = 0;
    const failures: { transactionId: string; reason: string }[] = [];

    // Process each transaction
    for (const transaction of transactions) {
      try {
        switch (data.action) {
          case "changeCategory": {
            if (!data.categoryId) {
              failures.push({
                transactionId: transaction.id,
                reason: "Category ID is required",
              });
              continue;
            }

            // Verify category exists and belongs to org
            const category = await db.category.findUnique({
              where: { id: data.categoryId },
            });

            if (!category || category.organizationId !== org.id) {
              failures.push({
                transactionId: transaction.id,
                reason: "Category not found",
              });
              continue;
            }

            // Verify category type matches transaction type
            if (category.type !== transaction.type) {
              failures.push({
                transactionId: transaction.id,
                reason: "Category type must match transaction type",
              });
              continue;
            }

            // Update category
            await db.transaction.update({
              where: { id: transaction.id },
              data: { categoryId: data.categoryId },
            });

            successCount++;
            break;
          }

          case "changeStatus": {
            if (!data.status) {
              failures.push({
                transactionId: transaction.id,
                reason: "Status is required",
              });
              continue;
            }

            // Check soft-closed period for POSTED transactions
            if (
              transaction.status === "POSTED" &&
              isInSoftClosedPeriod(transaction.date, softClosedBefore)
            ) {
              if (!data.allowSoftClosedOverride) {
                failures.push({
                  transactionId: transaction.id,
                  reason: "Transaction is in soft-closed period. Override required.",
                });
                continue;
              }
            }

            // Validate date rules for status changes
            if (data.status === "POSTED" && transaction.date > new Date()) {
              failures.push({
                transactionId: transaction.id,
                reason: "Posted transactions cannot have a future date",
              });
              continue;
            }

            // Update status
            await db.transaction.update({
              where: { id: transaction.id },
              data: { status: data.status },
            });

            successCount++;
            break;
          }

          case "delete": {
            // Soft delete
            await db.transaction.update({
              where: { id: transaction.id },
              data: { deletedAt: new Date() },
            });

            successCount++;
            break;
          }
        }
      } catch (error) {
        console.error(`Error processing transaction ${transaction.id}:`, error);
        failures.push({
          transactionId: transaction.id,
          reason: "Internal error processing transaction",
        });
      }
    }

    // Add failures for transactions not found
    const foundIds = new Set(transactions.map((t) => t.id));
    for (const id of data.transactionIds) {
      if (!foundIds.has(id)) {
        failures.push({
          transactionId: id,
          reason: "Transaction not found or already deleted",
        });
      }
    }

    return NextResponse.json({
      successCount,
      failureCount: failures.length,
      failures,
    });
  } catch (error) {
    console.error("Error performing bulk action:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk action" },
      { status: 500 }
    );
  }
}
