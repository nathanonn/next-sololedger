import { NextResponse } from "next/server";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, getUserMembership, isSuperadmin } from "@/lib/org-helpers";
import { validateCsrf } from "@/lib/csrf";
import { env } from "@/lib/env";
import {
  generateTextWithLogging,
  streamTextWithLogging,
} from "@/lib/ai/generate";
import {
  checkAiRateLimit,
  recordIpRequest,
  isRateLimitError,
  formatRateLimitError,
  addRateLimitHeaders,
} from "@/lib/ai/rate-limit";
import type { AiProvider } from "@/lib/ai/providers";

export const runtime = "nodejs";

/**
 * POST /api/orgs/[orgSlug]/ai/generate
 * Generate text using AI (supports both streaming and non-streaming)
 * Requires: Organization member (admin or regular member)
 * Rate limits: per-org and per-IP
 */
export async function POST(
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

    // CSRF validation
    const csrfError = await validateCsrf(request);
    if (csrfError) {
      return NextResponse.json({ error: csrfError }, { status: 403 });
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

    // Verify user is a member or superadmin
    const userIsSuperadmin = await isSuperadmin(user.id);
    if (!userIsSuperadmin) {
      const membership = await getUserMembership(user.id, org.id);
      if (!membership) {
        return NextResponse.json(
          { error: "Must be a member of this organization" },
          { status: 403 }
        );
      }
    }

    // Validate API key organization access
    if (!validateApiKeyOrgAccess(user, org.id)) {
      return NextResponse.json(
        { error: "API key not authorized for this organization" },
        { status: 403 }
      );
    }

    // Get client IP for rate limiting
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : "unknown";

    // Check rate limits
    try {
      const rateLimitResult = await checkAiRateLimit(org.id, ip);

      // Parse request body
      const body = await request.json();
      const {
        feature = "generic-text",
        prompt,
        modelName,
        provider,
        maxOutputTokens,
        stream = false,
        correlationId,
        temperature,
      } = body;

      if (!prompt || typeof prompt !== "string") {
        return NextResponse.json(
          { error: "Prompt is required" },
          { status: 400 }
        );
      }

      // Handle streaming
      if (stream) {
        const result = await streamTextWithLogging({
          orgId: org.id,
          userId: user.id,
          feature,
          prompt,
          modelName,
          provider: provider as AiProvider | undefined,
          maxOutputTokens,
          correlationId,
          temperature,
        });

        // Record IP request for rate limiting
        recordIpRequest(ip);

        // Create a readable stream for the response
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of result.textStream) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
              }

              // Send final metadata
              const metadata = await result.metadata;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ done: true, metadata })}\n\n`
                )
              );
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Correlation-ID": result.correlationId,
            ...addRateLimitHeaders(rateLimitResult),
          },
        });
      }

      // Non-streaming generation
      const result = await generateTextWithLogging({
        orgId: org.id,
        userId: user.id,
        feature,
        prompt,
        modelName,
        provider: provider as AiProvider | undefined,
        maxOutputTokens,
        correlationId,
        temperature,
      });

      // Record IP request for rate limiting
      recordIpRequest(ip);

      return NextResponse.json(result, {
        headers: {
          "X-Correlation-ID": result.correlationId,
          ...addRateLimitHeaders(rateLimitResult),
        },
      });
    } catch (error) {
      // Handle rate limit errors
      if (isRateLimitError(error)) {
        const formatted = formatRateLimitError(error);
        return NextResponse.json(formatted.body, {
          status: formatted.status,
          headers: formatted.headers,
        });
      }

      // Handle other errors
      console.error("Error generating text:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to generate text",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in generate route:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
