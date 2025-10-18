import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";
import {
  generateUniqueSlug,
  validateSlug,
  isReservedSlug,
} from "@/lib/org-helpers";

export const runtime = "nodejs";

/**
 * GET /api/orgs
 * List all organizations for current user
 */
export async function GET(): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const orgs = memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
      createdAt: m.organization.createdAt,
      updatedAt: m.organization.updatedAt,
    }));

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

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
