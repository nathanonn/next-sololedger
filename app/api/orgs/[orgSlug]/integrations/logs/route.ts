import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/integrations/logs
 * Fetch integration usage logs with filtering and pagination
 * Requires: Admin or Superadmin role
 * Query params: provider, q (search), from, to, page, limit
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    if (!env.INTEGRATIONS_ENABLED) {
      return NextResponse.json(
        { error: "Integrations are disabled" },
        { status: 404 }
      );
    }

    if (!env.INTEGRATIONS_USAGE_LOGGING_ENABLED) {
      return NextResponse.json(
        { disabled: true, message: "Integration usage logging is disabled" },
        { status: 200 }
      );
    }

    const { orgSlug } = await params;
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Verify user is admin or superadmin
    try {
      await requireAdminOrSuperadmin(user.id, org.id);
    } catch {
      return NextResponse.json(
        { error: "Admin or superadmin access required" },
        { status: 403 }
      );
    }
    // Validate API key organization access
    if (!validateApiKeyOrgAccess(user, org.id)) {
      return NextResponse.json(
        { error: "API key not authorized for this organization" },
        { status: 403 }
      );
    }


    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");
    const q = searchParams.get("q");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100
    );

    // Build where clause
    const where: {
      organizationId: string;
      provider?: string;
      createdAt?: { gte?: Date; lte?: Date };
      OR?: Array<{
        endpoint?: { contains: string; mode: "insensitive" };
        correlationId?: { contains: string; mode: "insensitive" };
      }>;
    } = {
      organizationId: org.id,
    };

    if (provider) {
      where.provider = provider;
    }

    if (from || to) {
      where.createdAt = {};
      if (from) {
        where.createdAt.gte = new Date(from);
      }
      if (to) {
        where.createdAt.lte = new Date(to);
      }
    }

    if (q) {
      where.OR = [
        { endpoint: { contains: q, mode: "insensitive" } },
        { correlationId: { contains: q, mode: "insensitive" } },
      ];
    }

    // Fetch logs with pagination
    const [logs, total] = await Promise.all([
      db.integrationCallLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          provider: true,
          endpoint: true,
          method: true,
          status: true,
          httpStatus: true,
          latencyMs: true,
          correlationId: true,
          errorCode: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      db.integrationCallLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching integration logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}
