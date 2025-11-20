import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { getCurrentUser, validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { getOrgBySlug, requireAdminOrSuperadmin } from "@/lib/org-helpers";
import { validateCsrf } from "@/lib/csrf";
import { env } from "@/lib/env";
import { isIntegrationAllowed, type IntegrationProvider } from "@/lib/integrations/providers";
import { callIntegration, type IntegrationError } from "@/lib/integrations/trigger";

export const runtime = "nodejs";

/**
 * POST /api/orgs/[orgSlug]/integrations/[provider]/test
 * Test an integration connection with custom endpoint and parameters
 * Requires: Admin or Superadmin role
 */

const testRequestSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
  endpoint: z.string().refine(
    (val) => val.startsWith("/"),
    { message: "Endpoint must be a relative path starting with /" }
  ),
  headers: z.record(z.string()).optional(),
  query: z.record(z.string()).optional(),
  body: z.unknown().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; provider: string }> }
): Promise<Response> {
  // Pre-generate correlation ID so it's available for error responses
  const correlationId = randomBytes(16).toString("hex");

  try {
    if (!env.INTEGRATIONS_ENABLED) {
      return NextResponse.json(
        { ok: false, code: "INTEGRATIONS_DISABLED", message: "Integrations are disabled" },
        { status: 404 }
      );
    }

    // Validate CSRF
    const csrfError = await validateCsrf(request);
    if (csrfError) {
      return NextResponse.json(
        { ok: false, code: "CSRF_INVALID", message: csrfError },
        { status: 403 }
      );
    }

    const { orgSlug, provider } = await params;
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { ok: false, code: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      );
    }

    // Validate provider
    if (!isIntegrationAllowed(provider)) {
      return NextResponse.json(
        { ok: false, code: "PROVIDER_NOT_ALLOWED", message: `Provider "${provider}" is not allowed` },
        { status: 400 }
      );
    }

    // Get organization
    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json(
        { ok: false, code: "ORG_NOT_FOUND", message: "Organization not found" },
        { status: 404 }
      );
    }

    // Verify user is admin or superadmin
    try {
      await requireAdminOrSuperadmin(user.id, org.id);
    } catch {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN", message: "Admin or superadmin access required" },
        { status: 403 }
      );
    }

    // Validate API key organization access
    if (!validateApiKeyOrgAccess(user, org.id)) {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN", message: "API key not authorized for this organization" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parseResult = testRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_INPUT",
          message: "Invalid request parameters",
          errors: parseResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { method, endpoint, headers, query, body: requestBody } = parseResult.data;

    // Execute integration call with pre-generated correlation ID
    const result = await callIntegration({
      orgId: org.id,
      userId: user.id,
      provider: provider as IntegrationProvider,
      endpoint,
      method,
      headers,
      query,
      body: requestBody,
      correlationId,
    });

    // Return success response
    return NextResponse.json({
      ok: true,
      httpStatus: result.httpStatus,
      correlationId: result.correlationId,
      data: result.data,
    });

  } catch (error) {
    console.error("Error in test connection:", error);

    // Handle IntegrationError - include correlation ID for traceability
    if (isIntegrationError(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: error.code,
          message: error.message,
          httpStatus: error.httpStatus,
          correlationId, // Use pre-generated ID that was logged
        },
        { status: error.httpStatus || 500 }
      );
    }

    // Handle unknown errors
    const message = error instanceof Error ? error.message : "Test connection failed";
    return NextResponse.json(
      { ok: false, code: "UNKNOWN_ERROR", message, correlationId },
      { status: 500 }
    );
  }
}

/**
 * Type guard for IntegrationError
 */
function isIntegrationError(error: unknown): error is IntegrationError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  );
}
