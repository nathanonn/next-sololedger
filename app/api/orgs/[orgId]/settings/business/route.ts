import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";
import { requireAdminOrSuperadmin } from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * PATCH /api/orgs/[orgId]/settings/business
 * Update business settings for an organization
 * Admin-only access
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
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

    const { orgId } = await params;

    // Require admin or superadmin access
    try {
      await requireAdminOrSuperadmin(user.id, orgId);
    } catch {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Validate request body
    const businessSettingsSchema = z.object({
      businessName: z.string().min(1, "Business name is required").max(255),
      businessType: z.enum([
        "Freelance",
        "Consulting",
        "Agency",
        "SaaS",
        "Other",
      ]),
      businessTypeOther: z.string().max(255).optional(),
      address: z.string().max(1000).optional(),
      phone: z.string().max(50).optional(),
      email: z.string().email().optional().or(z.literal("")),
      taxId: z.string().max(100).optional(),
    });

    const body = await request.json();
    const validation = businessSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Validate businessTypeOther if type is "Other"
    if (data.businessType === "Other" && !data.businessTypeOther) {
      return NextResponse.json(
        { error: "Please describe your business type" },
        { status: 400 }
      );
    }

    // Update organization and settings in transaction
    const result = await db.$transaction(async (tx) => {
      // Update organization name
      const org = await tx.organization.update({
        where: { id: orgId },
        data: { name: data.businessName },
      });

      // Upsert organization settings
      const settings = await tx.organizationSettings.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          businessType: data.businessType,
          businessTypeOther: data.businessTypeOther || null,
          address: data.address || null,
          phone: data.phone || null,
          email: data.email || null,
          taxId: data.taxId || null,
          baseCurrency: "MYR", // Default, will be set in financial step
          fiscalYearStartMonth: 1,
        },
        update: {
          businessType: data.businessType,
          businessTypeOther: data.businessTypeOther || null,
          address: data.address || null,
          phone: data.phone || null,
          email: data.email || null,
          taxId: data.taxId || null,
        },
      });

      return { org, settings };
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: result.org.id,
        name: result.org.name,
      },
      settings: {
        businessType: result.settings.businessType,
        businessTypeOther: result.settings.businessTypeOther,
      },
    });
  } catch (error) {
    console.error("Error updating business settings:", error);
    return NextResponse.json(
      { error: "Failed to update business settings" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orgs/[orgId]/settings/business
 * Get business settings for an organization
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;

    // Require admin or superadmin access
    try {
      await requireAdminOrSuperadmin(user.id, orgId);
    } catch {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get organization and settings
    const org = await db.organization.findUnique({
      where: { id: orgId },
      include: {
        settings: true,
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
      },
      settings: org.settings
        ? {
            businessType: org.settings.businessType,
            businessTypeOther: org.settings.businessTypeOther,
            address: org.settings.address,
            phone: org.settings.phone,
            email: org.settings.email,
            taxId: org.settings.taxId,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching business settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch business settings" },
      { status: 500 }
    );
  }
}
