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
  text: z.string().min(1, "Post text is required").max(3000, "Post text is too long"),
});

/**
 * POST /api/orgs/[orgSlug]/integrations/linkedin/post
 * Create a LinkedIn member post (text update)
 * Requires: Admin or Superadmin role, CSRF validation, linkedin enabled
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

    // Verify linkedin is enabled
    if (!isIntegrationAllowed("linkedin")) {
      return NextResponse.json(
        { error: "LinkedIn integration is not enabled" },
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

    const { text } = parseResult.data;

    // Get integration to retrieve member URN (accountId)
    const integration = await db.organizationIntegration.findUnique({
      where: {
        organizationId_provider: {
          organizationId: org.id,
          provider: "linkedin",
        },
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "LinkedIn integration not found. Please connect LinkedIn first." },
        { status: 400 }
      );
    }

    const memberUrn = integration.accountId; // Member URN stored as accountId

    // Create LinkedIn UGC post
    // Using LinkedIn's v2 UGC Posts API for member posting
    const postBody = {
      author: memberUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: text,
          },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    const result = await callIntegration({
      orgId: org.id,
      userId: user.id,
      provider: "linkedin",
      endpoint: "/ugcPosts",
      method: "POST",
      body: postBody,
    });

    // Extract post URN from response
    const postData = result.data as { id?: string };
    const postUrn = postData.id || "unknown";

    return NextResponse.json({
      ok: true,
      postUrn,
      message: "Post created successfully",
    });
  } catch (error) {
    console.error("Error creating LinkedIn post:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to create post";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
