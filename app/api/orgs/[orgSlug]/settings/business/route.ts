import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";
import {
  requireAdminOrSuperadmin,
  requireMembership,
  getOrgBySlug,
} from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * PATCH /api/orgs/[orgSlug]/settings/business
 * Update business settings for an organization
 * Admin-only access
 */
export async function PATCH(
  request: Request,
  {  params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    // CSRF validation
    const csrfError = await validateCsrf(request);
    if (csrfError) {
      return NextResponse.json({ error: csrfError }, { status: 403 });
    }

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgSlug } = await params;

    // Get organization
    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Require admin or superadmin access
    try {
      await requireAdminOrSuperadmin(user.id, org.id);
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
      businessTypeOther: z.string().max(255).nullable().optional(),
      address: z.string().max(1000).nullable().optional(),
      phone: z.string().max(50).nullable().optional(),
      email: z.string().email().nullable().optional().or(z.literal("")),
      taxId: z.string().max(100).nullable().optional(),
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
      const updatedOrg = await tx.organization.update({
        where: { id: org.id },
        data: { name: data.businessName },
      });

      // Upsert organization settings
      const settings = await tx.organizationSettings.upsert({
        where: { organizationId: org.id },
        create: {
          organizationId: org.id,
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

      return { org: updatedOrg, settings };
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
 * GET /api/orgs/[orgSlug]/settings/business
 * Get business settings for an organization
 */
export async function GET(
  request: Request,
  {  params }: { params: Promise<{ orgSlug: string }> }
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
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Require membership (members can read business settings)
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


    // Get organization and settings
    const orgWithSettings = await db.organization.findUnique({
      where: { id: org.id },
      include: {
        settings: true,
      },
    });

    if (!orgWithSettings) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      organization: {
        id: orgWithSettings.id,
        name: orgWithSettings.name,
      },
      settings: orgWithSettings.settings
        ? {
            businessType: orgWithSettings.settings.businessType,
            businessTypeOther: orgWithSettings.settings.businessTypeOther,
            address: orgWithSettings.settings.address,
            phone: orgWithSettings.settings.phone,
            email: orgWithSettings.settings.email,
            taxId: orgWithSettings.settings.taxId,
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
