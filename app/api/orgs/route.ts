import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";
import {
  generateUniqueSlug,
  validateSlug,
  isReservedSlug,
  isSuperadmin,
} from "@/lib/org-helpers";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * GET /api/orgs
 * List all organizations for current user
 * Superadmins see all organizations
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is superadmin
    const userIsSuperadmin = await isSuperadmin(user.id);

    let orgs;

    // If authenticated via API key, only return the scoped organization
    if (user.apiKeyOrganizationId) {
      const scopedOrg = await db.organization.findUnique({
        where: { id: user.apiKeyOrganizationId },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!scopedOrg) {
        return NextResponse.json(
          { error: "Organization not found" },
          { status: 404 }
        );
      }

      // Get user's role in the scoped organization
      const membership = await db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: scopedOrg.id,
          },
        },
      });

      orgs = [
        {
          id: scopedOrg.id,
          name: scopedOrg.name,
          slug: scopedOrg.slug,
          role: membership?.role || "member",
          createdAt: scopedOrg.createdAt,
          updatedAt: scopedOrg.updatedAt,
        },
      ];
    } else if (userIsSuperadmin) {
      // Superadmins see all organizations
      const allOrgs = await db.organization.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      orgs = allOrgs.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: "superadmin", // Special role indicator for UI
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      }));
    } else {
      // Regular users see only their memberships
      const memberships = await db.membership.findMany({
        where: { userId: user.id },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      orgs = memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
        createdAt: m.organization.createdAt,
        updatedAt: m.organization.updatedAt,
      }));
    }

    return NextResponse.json({ organizations: orgs });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orgs
 * Create a new organization
 */
export async function POST(request: Request): Promise<Response> {
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

    // Prevent API key authentication from creating organizations
    if (user.apiKeyOrganizationId) {
      return NextResponse.json(
        { error: "Organization creation via API key is not allowed" },
        { status: 403 }
      );
    }

    // Validate request body
    const createOrgSchema = z.object({
      name: z.string().min(1, "Name is required").max(255, "Name too long"),
      slug: z.string().optional(),
    });

    const body = await request.json();
    const validation = createOrgSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, slug: requestedSlug } = validation.data;

    // Check organization creation policy
    const userIsSuperadmin = await isSuperadmin(user.id);

    if (!userIsSuperadmin) {
      // Check if organization creation is enabled
      if (!env.ORG_CREATION_ENABLED) {
        // Audit denial
        await db.auditLog.create({
          data: {
            action: "org_create_denied",
            userId: user.id,
            email: user.email,
            metadata: { reason: "disabled" },
          },
        });

        return NextResponse.json(
          {
            error:
              "Organization creation is disabled. Please contact an administrator.",
          },
          { status: 403 }
        );
      }

      // Check organization creation limit
      const orgCount = await db.organization.count({
        where: { createdById: user.id },
      });

      if (orgCount >= env.ORG_CREATION_LIMIT) {
        // Audit denial
        await db.auditLog.create({
          data: {
            action: "org_create_denied",
            userId: user.id,
            email: user.email,
            metadata: {
              reason: "limit_exceeded",
              limit: env.ORG_CREATION_LIMIT,
              current: orgCount,
            },
          },
        });

        return NextResponse.json(
          {
            error: `Organization creation limit reached. You can create up to ${env.ORG_CREATION_LIMIT} organization(s).`,
          },
          { status: 400 }
        );
      }
    }

    // Generate or validate slug
    let slug: string;

    if (requestedSlug) {
      // Validate format
      const slugValidation = validateSlug(requestedSlug);
      if (!slugValidation.valid) {
        return NextResponse.json(
          { error: slugValidation.error },
          { status: 400 }
        );
      }

      // Check if reserved
      if (isReservedSlug(requestedSlug)) {
        return NextResponse.json(
          { error: "This slug is reserved. Choose another." },
          { status: 400 }
        );
      }

      // Check if taken
      const existing = await db.organization.findUnique({
        where: { slug: requestedSlug },
      });

      if (existing) {
        return NextResponse.json(
          { error: "This slug is already taken" },
          { status: 400 }
        );
      }

      slug = requestedSlug;
    } else {
      // Generate unique slug from name
      slug = await generateUniqueSlug(name);
    }

    // Create organization, membership, and update user in transaction
    const org = await db.$transaction(async (tx) => {
      // Create organization
      const newOrg = await tx.organization.create({
        data: {
          name,
          slug,
          createdById: user.id,
        },
      });

      // Create admin membership
      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: newOrg.id,
          role: "admin",
        },
      });

      // Set as default if user has no default
      if (!user.defaultOrganizationId) {
        await tx.user.update({
          where: { id: user.id },
          data: { defaultOrganizationId: newOrg.id },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          action: "org_create",
          userId: user.id,
          email: user.email,
          organizationId: newOrg.id,
          metadata: {
            orgName: name,
            orgSlug: slug,
            ...(userIsSuperadmin && { actingRole: "superadmin" }),
          },
        },
      });

      return newOrg;
    });

    return NextResponse.json(
      {
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          createdAt: org.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating organization:", error);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    );
  }
}
