import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getOrgBySlug, requireMembership } from "@/lib/org-helpers";
import {
  MAX_TAG_LENGTH,
  sanitizeTagNames,
  upsertTagsForOrg,
} from "@/lib/tag-helpers";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> }
): Promise<Response> {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgSlug } = await params;
    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    await requireMembership(user.id, org.id);

    if (!validateApiKeyOrgAccess(user, org.id)) {
      return NextResponse.json(
        { error: "API key not authorized for this organization" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.toLowerCase().trim();
    const limitParam = searchParams.get("limit");

    // Only apply limit if explicitly provided, otherwise return all tags
    const take = limitParam
      ? Math.min(parseInt(limitParam, 10), 1000)
      : undefined;

    const tags = await db.tag.findMany({
      where: {
        organizationId: org.id,
        ...(query
          ? {
              nameLower: {
                contains: query,
              },
            }
          : {}),
      },
      orderBy: { name: "asc" },
      ...(take && !Number.isNaN(take) ? { take } : {}),
    });

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("Error fetching tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}

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
    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    await requireMembership(user.id, org.id);

    if (!validateApiKeyOrgAccess(user, org.id)) {
      return NextResponse.json(
        { error: "API key not authorized for this organization" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const schema = z.object({
      name: z
        .string()
        .trim()
        .min(1, "Tag name is required")
        .max(MAX_TAG_LENGTH, `Tag name must be at most ${MAX_TAG_LENGTH} characters`),
    });

    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Invalid tag" },
        { status: 400 }
      );
    }

    const [tagName] = sanitizeTagNames([validation.data.name]);
    if (!tagName) {
      return NextResponse.json({ error: "Invalid tag name" }, { status: 400 });
    }

    const [tag] = await upsertTagsForOrg(org.id, [tagName]);

    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    console.error("Error creating tag:", error);
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 }
    );
  }
}
