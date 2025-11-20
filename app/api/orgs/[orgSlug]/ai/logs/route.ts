import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * GET /api/orgs/[orgSlug]/ai/logs
 * List AI generation logs with filters, pagination, and totals
 * Requires: Admin or Superadmin role
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    if (!env.AI_FEATURES_ENABLED) {
      return NextResponse.json(
        { error: "AI features are disabled" },
        { status: 404 }
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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(10, parseInt(searchParams.get("pageSize") || "20", 10))
    );
    const provider = searchParams.get("provider");
    const model = searchParams.get("model");
    const feature = searchParams.get("feature");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: org.id,
    };

    if (provider) where.provider = provider;
    if (model) where.model = model;
    if (feature) where.feature = feature;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { correlationId: { contains: search, mode: "insensitive" } },
        { rawInputTruncated: { contains: search, mode: "insensitive" } },
        { rawOutputTruncated: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get logs with pagination
    const [logs, total] = await Promise.all([
      db.aiGenerationLog.findMany({
        where,
        select: {
          id: true,
          correlationId: true,
          provider: true,
          model: true,
          feature: true,
          status: true,
          tokensIn: true,
          tokensOut: true,
          latencyMs: true,
          rawInputTruncated: true,
          rawOutputTruncated: true,
          rawRequest: true,
          rawResponse: true,
          errorCode: true,
          errorMessage: true,
          createdAt: true,
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.aiGenerationLog.count({ where }),
    ]);

    // Calculate totals
    const totals = await db.aiGenerationLog.aggregate({
      where,
      _count: { id: true },
      _sum: {
        tokensIn: true,
        tokensOut: true,
        latencyMs: true,
      },
    });

    const avgLatency = totals._count.id > 0
      ? Math.round((totals._sum.latencyMs || 0) / totals._count.id)
      : 0;

    return NextResponse.json({
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      totals: {
        requests: totals._count.id,
        tokensIn: totals._sum.tokensIn || 0,
        tokensOut: totals._sum.tokensOut || 0,
        avgLatencyMs: avgLatency,
      },
    });
  } catch (error) {
    console.error("Error fetching AI logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI logs" },
      { status: 500 }
    );
  }
}
