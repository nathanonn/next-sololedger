import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { validateCsrf } from "@/lib/csrf";
import { env } from "@/lib/env";
import { isIntegrationAllowed } from "@/lib/integrations/providers";
import { callIntegration } from "@/lib/integrations/trigger";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const postSchema = z.object({
  title: z.string().min(1, "Post title is required"),
  content: z.string().min(1, "Post content is required"),
  status: z.enum(["draft", "publish"]).optional(),
  categoryId: z.number().optional(),
  authorId: z.number().optional(),
});

/**
 * POST /api/orgs/[orgSlug]/integrations/wordpress/post
 * Create a WordPress post
 * Requires: Admin or Superadmin role, CSRF validation, wordpress enabled
 */
export async function POST(
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

    // Verify wordpress is enabled
    if (!isIntegrationAllowed("wordpress")) {
      return NextResponse.json(
        { error: "WordPress integration is not enabled" },
        { status: 400 }
      );
    }

    // CSRF validation
    const csrfError = await validateCsrf(request);
    if (csrfError) {
      return NextResponse.json({ error: csrfError }, { status: 403 });
    }

    const { orgSlug } = await params;
    const user = await getCurrentUser();

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

    // Validate request body
    const body = await request.json();
    const parseResult = postSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0].message },
        { status: 400 }
      );
    }

    const { title, content, status, categoryId, authorId } = parseResult.data;

    // Get integration to retrieve defaults from scope
    const integration = await db.organizationIntegration.findUnique({
      where: {
        organizationId_provider: {
          organizationId: org.id,
          provider: "wordpress",
        },
      },
    });

    if (!integration) {
      return NextResponse.json(
        {
          error:
            "WordPress integration not found. Please connect WordPress first.",
        },
        { status: 400 }
      );
    }

    // Parse defaults from scope JSON
    const defaults = integration.scope
      ? JSON.parse(integration.scope)
      : {};

    // Build WordPress post body
    const wpPostBody: {
      title: string;
      content: string;
      status: string;
      categories?: number[];
      author?: number;
    } = {
      title,
      content,
      status: status || defaults.status || "draft",
    };

    // Add optional fields
    if (categoryId !== undefined) {
      wpPostBody.categories = [categoryId];
    } else if (defaults.categoryId) {
      wpPostBody.categories = [defaults.categoryId];
    }

    if (authorId !== undefined) {
      wpPostBody.author = authorId;
    } else if (defaults.authorId) {
      wpPostBody.author = defaults.authorId;
    }

    // Create WordPress post
    const result = await callIntegration({
      orgId: org.id,
      userId: user.id,
      provider: "wordpress",
      endpoint: "/wp-json/wp/v2/posts",
      method: "POST",
      body: wpPostBody,
    });

    // Extract post info from response
    const postData = result.data as {
      id?: number;
      link?: string;
      status?: string;
    };

    return NextResponse.json({
      ok: true,
      postId: postData.id,
      postLink: postData.link,
      status: postData.status,
      message: "Post created successfully",
    });
  } catch (error) {
    console.error("Error creating WordPress post:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to create post";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
