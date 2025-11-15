import { randomBytes } from "crypto";
import type { IntegrationProvider } from "@/lib/integrations/providers";
import {
  redditRequest,
  notionRequest,
  linkedinRequest,
  wordpressRequest,
  logIntegrationCall,
} from "@/lib/integrations/client";

/**
 * Main trigger function for calling integrated APIs
 * Auto-handles token refresh, error codes, and logging
 */

export type IntegrationCallParams = {
  orgId: string;
  userId: string;
  provider: IntegrationProvider;
  endpoint: string;
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  correlationId?: string;
};

export type IntegrationCallResult = {
  data: unknown;
  httpStatus: number;
  correlationId: string;
};

export type IntegrationError = {
  code: string;
  message: string;
  httpStatus?: number;
  originalError?: unknown;
};

/**
 * Call an integrated API endpoint with auto-refresh and structured error handling
 */
export async function callIntegration(
  params: IntegrationCallParams
): Promise<IntegrationCallResult> {
  const {
    orgId,
    userId,
    provider,
    endpoint,
    method = "GET",
    headers,
    query,
    body,
    correlationId = generateCorrelationId(),
  } = params;

  const startTime = Date.now();

  try {
    let response: Response;

    // Call provider-specific client
    if (provider === "reddit") {
      response = await redditRequest(orgId, endpoint, {
        method,
        headers,
        query,
        body,
      });
    } else if (provider === "notion") {
      response = await notionRequest(orgId, endpoint, {
        method,
        headers,
        query,
        body,
      });
    } else if (provider === "linkedin") {
      response = await linkedinRequest(orgId, endpoint, {
        method,
        headers,
        query,
        body,
      });
    } else if (provider === "wordpress") {
      response = await wordpressRequest(orgId, endpoint, {
        method,
        headers,
        query,
        body,
      });
    } else {
      throw createError(
        "UNSUPPORTED_PROVIDER",
        `Provider ${provider} is not supported`
      );
    }

    const latencyMs = Date.now() - startTime;

    // Parse response
    let data: unknown;
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Check for errors
    if (!response.ok) {
      const error = parseProviderError(provider, response.status, data);

      // Log error
      await logIntegrationCall({
        organizationId: orgId,
        userId,
        provider,
        endpoint,
        method,
        status: "error",
        httpStatus: response.status,
        latencyMs,
        correlationId,
        request: { method, endpoint, query, body },
        response: data,
        errorCode: error.code,
        errorMessage: error.message,
      });

      throw error;
    }

    // Log success
    await logIntegrationCall({
      organizationId: orgId,
      userId,
      provider,
      endpoint,
      method,
      status: "ok",
      httpStatus: response.status,
      latencyMs,
      correlationId,
      request: { method, endpoint, query, body },
      response: data,
    });

    return {
      data,
      httpStatus: response.status,
      correlationId,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    // If error is already an IntegrationError, rethrow it
    if (isIntegrationError(error)) {
      throw error;
    }

    // Convert unknown errors to IntegrationError
    const integrationError = createError(
      "UNKNOWN_ERROR",
      error instanceof Error ? error.message : "An unknown error occurred",
      undefined,
      error
    );

    // Log error
    await logIntegrationCall({
      organizationId: orgId,
      userId,
      provider,
      endpoint,
      method,
      status: "error",
      httpStatus: null,
      latencyMs,
      correlationId,
      request: { method, endpoint, query, body },
      response: null,
      errorCode: integrationError.code,
      errorMessage: integrationError.message,
    });

    throw integrationError;
  }
}

/**
 * Parse provider-specific error responses into structured IntegrationError
 */
function parseProviderError(
  provider: IntegrationProvider,
  status: number,
  data: unknown
): IntegrationError {
  // Common HTTP status codes
  if (status === 401) {
    return createError(
      "UNAUTHORIZED",
      "Authentication failed or token expired",
      status
    );
  }

  if (status === 403) {
    return createError("FORBIDDEN", "Permission denied", status);
  }

  if (status === 404) {
    return createError("NOT_FOUND", "Resource not found", status);
  }

  if (status === 429) {
    return createError("RATE_LIMITED", "Rate limit exceeded", status);
  }

  if (status >= 500) {
    return createError(
      "API_ERROR_SERVER",
      `${provider} server error: ${status}`,
      status,
      data
    );
  }

  // Provider-specific error parsing
  if (provider === "reddit") {
    const error = data as { message?: string; error?: string };
    const message = error.message || error.error || "Reddit API error";
    return createError(`API_ERROR_${status}`, message, status, data);
  }

  if (provider === "notion") {
    const error = data as { message?: string; code?: string };
    const code = error.code || `API_ERROR_${status}`;
    const message = error.message || "Notion API error";
    return createError(code, message, status, data);
  }

  if (provider === "linkedin") {
    const error = data as { message?: string; serviceErrorCode?: number };
    const message = error.message || "LinkedIn API error";
    const code = error.serviceErrorCode
      ? `LINKEDIN_ERROR_${error.serviceErrorCode}`
      : `API_ERROR_${status}`;
    return createError(code, message, status, data);
  }

  if (provider === "wordpress") {
    const error = data as { message?: string; code?: string; data?: { status?: number } };
    const code = error.code || `API_ERROR_${status}`;
    const message = error.message || "WordPress API error";
    return createError(code, message, status, data);
  }

  return createError(
    `API_ERROR_${status}`,
    `API request failed with status ${status}`,
    status,
    data
  );
}

/**
 * Create a structured IntegrationError
 */
function createError(
  code: string,
  message: string,
  httpStatus?: number,
  originalError?: unknown
): IntegrationError {
  // Add error to Error prototype for proper stack traces
  const err = new Error(message) as Error & IntegrationError;
  err.code = code;
  err.message = message;
  err.httpStatus = httpStatus;
  err.originalError = originalError;

  return err;
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

/**
 * Generate a unique correlation ID for tracing
 */
function generateCorrelationId(): string {
  return randomBytes(16).toString("hex");
}
