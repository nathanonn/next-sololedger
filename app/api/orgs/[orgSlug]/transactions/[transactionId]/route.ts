import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";
import { requireMembership, getOrgBySlug } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/transactions/[transactionId]
 * Get a single transaction
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; transactionId: string }> }
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgSlug, transactionId } = await params;

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

    // Get transaction
    const transaction = await db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        category: true,
        account: true,
        vendor: true,
        client: true,
      },
    });

    if (!transaction || transaction.organizationId !== org.id) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (transaction.deletedAt) {
      return NextResponse.json(
        { error: "Transaction has been deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json({ transaction });
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return NextResponse.json(
      { error: "Failed to fetch transaction" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/orgs/[orgSlug]/transactions/[transactionId]
 * Update a transaction
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; transactionId: string }> }
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

    const { orgSlug, transactionId } = await params;

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

    // Verify transaction belongs to this org
    const existing = await db.transaction.findUnique({
      where: { id: transactionId },
      include: { category: true },
    });

    if (!existing || existing.organizationId !== org.id) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (existing.deletedAt) {
      return NextResponse.json(
        { error: "Cannot update deleted transaction" },
        { status: 400 }
      );
    }

    // Validate request body
    const updateTransactionSchema = z.object({
      type: z.enum(["INCOME", "EXPENSE"]).optional(),
      status: z.enum(["DRAFT", "POSTED"]).optional(),
      amountOriginal: z.number().positive().optional(),
      currencyOriginal: z
        .string()
        .length(3)
        .transform((val) => val.toUpperCase())
        .optional(),
      exchangeRateToBase: z.number().positive().optional(),
      date: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), {
          message: "Invalid date",
        })
        .optional(),
      description: z.string().min(1).optional(),
      categoryId: z.string().optional(),
      accountId: z.string().optional(),
      vendorId: z.string().nullable().optional(),
      vendorName: z.string().nullable().optional(),
      clientId: z.string().nullable().optional(),
      clientName: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    });

    const body = await request.json();
    const validation = updateTransactionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Determine final transaction type
    const finalType = data.type ?? existing.type;

    // Enforce strict per-type relationship rules (3/a & 9/b)
    // Prevent changing type if client/vendor is already set
    if (data.type && data.type !== existing.type) {
      if (
        existing.vendorId ||
        existing.vendorName ||
        existing.clientId ||
        existing.clientName
      ) {
        return NextResponse.json(
          {
            error:
              "Cannot change transaction type once a client/vendor is set. Delete and recreate the transaction.",
          },
          { status: 400 }
        );
      }
    }

    // Enforce that INCOME can only have clients, EXPENSE can only have vendors
    // Only reject if trying to set a truthy (non-null) value for the wrong type
    if (finalType === "INCOME") {
      if (data.vendorId || data.vendorName) {
        return NextResponse.json(
          { error: "Income transactions cannot have vendors. Use clients instead." },
          { status: 400 }
        );
      }
    } else if (finalType === "EXPENSE") {
      if (data.clientId || data.clientName) {
        return NextResponse.json(
          { error: "Expense transactions cannot have clients. Use vendors instead." },
          { status: 400 }
        );
      }
    }

    // Validate date rules if date or status is being changed
    const finalStatus = data.status ?? existing.status;
    const finalDate = data.date ? new Date(data.date) : existing.date;
    const now = new Date();

    if (finalStatus === "POSTED" && finalDate > now) {
      return NextResponse.json(
        { error: "Posted transactions cannot have a future date" },
        { status: 400 }
      );
    }

    // If category is being changed, validate it
    if (data.categoryId) {
      const category = await db.category.findUnique({
        where: { id: data.categoryId },
      });

      if (!category || category.organizationId !== org.id) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 400 }
        );
      }

      // Verify category type matches transaction type
      const finalType = data.type ?? existing.type;
      if (category.type !== finalType) {
        return NextResponse.json(
          { error: "Category type must match transaction type" },
          { status: 400 }
        );
      }
    } else if (data.type && data.type !== existing.type) {
      // Type changed but category didn't - need to verify category type still matches
      const category = await db.category.findUnique({
        where: { id: existing.categoryId },
      });

      if (category && category.type !== data.type) {
        return NextResponse.json(
          {
            error:
              "Cannot change transaction type when category type doesn't match",
          },
          { status: 400 }
        );
      }
    }

    // If account is being changed, validate it
    if (data.accountId) {
      const account = await db.account.findUnique({
        where: { id: data.accountId },
      });

      if (!account || account.organizationId !== org.id) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 400 }
        );
      }
    }

    // Handle client (for INCOME transactions)
    let finalClientId: string | null | undefined = undefined;
    let finalClientName: string | null | undefined = undefined;

    if (finalType === "INCOME") {
      if (data.clientId !== undefined) {
        // ClientId explicitly provided (can be null to clear)
        finalClientId = data.clientId;

        // Verify clientId if not null
        if (finalClientId) {
          const client = await db.client.findUnique({
            where: { id: finalClientId },
          });

          if (!client || client.organizationId !== org.id) {
            return NextResponse.json(
              { error: "Client not found" },
              { status: 400 }
            );
          }

          finalClientName = client.name;
        } else {
          finalClientName = null;
        }
      } else if (data.clientName !== undefined) {
        // ClientName provided but not clientId
        if (data.clientName && data.clientName.trim()) {
          const clientName = data.clientName.trim();

          // Look for existing client (case-insensitive via nameLower)
          let client = await db.client.findFirst({
            where: {
              organizationId: org.id,
              nameLower: clientName.toLowerCase(),
            },
          });

          // Create client if it doesn't exist
          if (!client) {
            client = await db.client.create({
              data: {
                organizationId: org.id,
                name: clientName,
                nameLower: clientName.toLowerCase(),
                active: true,
              },
            });
          }

          finalClientId = client.id;
          finalClientName = client.name;
        } else {
          // Empty clientName provided - clear client
          finalClientId = null;
          finalClientName = null;
        }
      }
    }

    // Handle vendor (for EXPENSE transactions)
    let finalVendorId: string | null | undefined = undefined;
    let finalVendorName: string | null | undefined = undefined;

    if (finalType === "EXPENSE") {
      if (data.vendorId !== undefined) {
        // VendorId explicitly provided (can be null to clear)
        finalVendorId = data.vendorId;

        // Verify vendorId if not null
        if (finalVendorId) {
          const vendor = await db.vendor.findUnique({
            where: { id: finalVendorId },
          });

          if (!vendor || vendor.organizationId !== org.id) {
            return NextResponse.json(
              { error: "Vendor not found" },
              { status: 400 }
            );
          }

          finalVendorName = vendor.name;
        } else {
          finalVendorName = null;
        }
      } else if (data.vendorName !== undefined) {
        // VendorName provided but not vendorId
        if (data.vendorName && data.vendorName.trim()) {
          const vendorName = data.vendorName.trim();

          // Look for existing vendor (case-insensitive via nameLower)
          let vendor = await db.vendor.findFirst({
            where: {
              organizationId: org.id,
              nameLower: vendorName.toLowerCase(),
            },
          });

          // Create vendor if it doesn't exist
          if (!vendor) {
            vendor = await db.vendor.create({
              data: {
                organizationId: org.id,
                name: vendorName,
                nameLower: vendorName.toLowerCase(),
                active: true,
              },
            });
          }

          finalVendorId = vendor.id;
          finalVendorName = vendor.name;
        } else {
          // Empty vendorName provided - clear vendor
          finalVendorId = null;
          finalVendorName = null;
        }
      }
    }

    // Recalculate base amount if needed
    const needsRecalculation =
      data.amountOriginal !== undefined || data.exchangeRateToBase !== undefined;

    let amountBase: number | undefined = undefined;

    if (needsRecalculation) {
      const finalAmountOriginal = data.amountOriginal ?? Number(existing.amountOriginal);
      const finalExchangeRate = data.exchangeRateToBase ?? Number(existing.exchangeRateToBase);
      amountBase = finalAmountOriginal * finalExchangeRate;
    }

    // Update transaction
    const transaction = await db.transaction.update({
      where: { id: transactionId },
      data: {
        ...(data.type !== undefined && { type: data.type }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.amountOriginal !== undefined && {
          amountOriginal: data.amountOriginal,
        }),
        ...(data.currencyOriginal !== undefined && {
          currencyOriginal: data.currencyOriginal,
        }),
        ...(data.exchangeRateToBase !== undefined && {
          exchangeRateToBase: data.exchangeRateToBase,
        }),
        ...(data.date !== undefined && { date: new Date(data.date) }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.categoryId !== undefined && {
          categoryId: data.categoryId,
        }),
        ...(data.accountId !== undefined && { accountId: data.accountId }),
        ...(finalVendorId !== undefined && { vendorId: finalVendorId }),
        ...(finalVendorName !== undefined && { vendorName: finalVendorName }),
        ...(finalClientId !== undefined && { clientId: finalClientId }),
        ...(finalClientName !== undefined && { clientName: finalClientName }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(amountBase !== undefined && { amountBase }),
      },
      include: {
        category: true,
        account: true,
        vendor: true,
        client: true,
      },
    });

    return NextResponse.json({ transaction });
  } catch (error) {
    console.error("Error updating transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orgs/[orgSlug]/transactions/[transactionId]
 * Soft delete a transaction
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; transactionId: string }> }
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

    const { orgSlug, transactionId } = await params;

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

    // Verify transaction belongs to this org
    const existing = await db.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!existing || existing.organizationId !== org.id) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (existing.deletedAt) {
      return NextResponse.json(
        { error: "Transaction already deleted" },
        { status: 400 }
      );
    }

    // Soft delete
    await db.transaction.update({
      where: { id: transactionId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
