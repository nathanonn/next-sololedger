import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { decryptSecret } from "@/lib/secrets";
import {
  type IntegrationProvider,
  getProviderConfig,
} from "@/lib/integrations/providers";
import { refreshAccessToken } from "@/lib/integrations/oauth";

/**
 * Integration API client utilities
 * Handles token decryption, auto-refresh, and provider-specific requests
 */

type IntegrationConnection = {
  id: string;
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  status: string;
};

/**
 * Get organization integration and decrypt tokens
 */
export async function getOrgIntegration(
  orgId: string,
  provider: IntegrationProvider
): Promise<IntegrationConnection> {
  const integration = await db.organizationIntegration.findUnique({
    where: {
      organizationId_provider: {
        organizationId: orgId,
        provider,
      },
    },
  });

  if (!integration) {
    throw new Error(`No ${provider} integration found for organization`);
  }

  if (integration.status === "error" || integration.status === "disconnected") {
    throw new Error(
      `${provider} integration is ${integration.status}. Please reconnect.`
    );
  }

  const accessToken = decryptSecret(integration.encryptedAccessToken);
  const refreshToken = integration.encryptedRefreshToken
    ? decryptSecret(integration.encryptedRefreshToken)
    : null;

  // Check if token is expired and refresh if needed (Reddit only)
  const config = getProviderConfig(provider);
  if (
    config.supportsRefresh &&
    integration.expiresAt &&
    integration.expiresAt < new Date()
  ) {
    await refreshAccessToken(provider, integration.id);

    // Re-fetch integration with fresh tokens
    const refreshed = await db.organizationIntegration.findUnique({
      where: { id: integration.id },
    });

    if (!refreshed) {
      throw new Error("Integration not found after refresh");
    }

    return {
      id: refreshed.id,
      provider,
      accessToken: decryptSecret(refreshed.encryptedAccessToken),
      refreshToken: refreshed.encryptedRefreshToken
        ? decryptSecret(refreshed.encryptedRefreshToken)
        : null,
      expiresAt: refreshed.expiresAt,
      status: refreshed.status,
    };
  }

  return {
    id: integration.id,
    provider,
    accessToken,
    refreshToken,
    expiresAt: integration.expiresAt,
    status: integration.status,
  };
}

export type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
};

/**
 * Make authenticated request to Reddit API
 */
export async function redditRequest(
  orgId: string,
  path: string,
  options: RequestOptions = {}
): Promise<Response> {
  const connection = await getOrgIntegration(orgId, "reddit");
  const config = getProviderConfig("reddit");

  const url = new URL(path, config.baseUrl);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${connection.accessToken}`,
    ...config.defaultHeaders,
    ...options.headers,
  };

  const fetchOptions: RequestInit = {
    method: options.method || "GET",
    headers,
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url.toString(), fetchOptions);

  // Handle 401 by attempting token refresh
  if (response.status === 401 && config.supportsRefresh) {
    await refreshAccessToken("reddit", connection.id);

    // Retry request with new token
    const refreshed = await getOrgIntegration(orgId, "reddit");
    headers.Authorization = `Bearer ${refreshed.accessToken}`;
    return fetch(url.toString(), { ...fetchOptions, headers });
  }

  return response;
}

/**
 * Make authenticated request to Notion API
 */
export async function notionRequest(
  orgId: string,
  path: string,
  options: RequestOptions = {}
): Promise<Response> {
  const connection = await getOrgIntegration(orgId, "notion");
  const config = getProviderConfig("notion");

  const url = new URL(path, config.baseUrl);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${connection.accessToken}`,
    ...config.defaultHeaders,
    ...options.headers,
  };

  const fetchOptions: RequestInit = {
    method: options.method || "GET",
    headers,
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url.toString(), fetchOptions);

  // Notion doesn't support refresh, so 401 means user needs to reconnect
  if (response.status === 401) {
    await db.organizationIntegration.update({
      where: { id: connection.id },
      data: { status: "error" },
    });

    throw new Error(
      "Notion authorization expired. Please reconnect the integration."
    );
  }

  return response;
}

/**
 * Log integration API call (respects INTEGRATIONS_USAGE_LOGGING_ENABLED)
 */
export async function logIntegrationCall(params: {
  organizationId: string;
  userId: string;
  provider: IntegrationProvider;
  endpoint: string;
  method: string;
  status: "ok" | "error";
  httpStatus: number | null;
  latencyMs: number;
  correlationId: string;
  request: unknown;
  response: unknown;
  errorCode?: string;
  errorMessage?: string;
}): Promise<void> {
  // Skip logging if disabled
  if (!env.INTEGRATIONS_USAGE_LOGGING_ENABLED) {
    return;
  }

  try {
    await db.integrationCallLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        provider: params.provider,
        endpoint: params.endpoint,
        method: params.method,
        status: params.status,
        httpStatus: params.httpStatus,
        latencyMs: params.latencyMs,
        correlationId: params.correlationId,
        requestTruncated: sanitizeAndTruncate(params.request),
        responseTruncated: sanitizeAndTruncate(params.response),
        errorCode: params.errorCode,
        errorMessage: params.errorMessage,
      },
    });
  } catch (error) {
    // Logging failures should not break the application
    console.error("Failed to log integration call:", error);
  }
}

/**
 * Sanitize and truncate request/response data for logging
 */
function sanitizeAndTruncate(data: unknown): string {
  const MAX_LENGTH = 5000;

  try {
    let sanitized = JSON.parse(JSON.stringify(data));

    // Redact sensitive fields
    const redactFields = (obj: unknown): unknown => {
      if (typeof obj !== "object" || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(redactFields);
      }

      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes("token") ||
          lowerKey.includes("secret") ||
          lowerKey.includes("password") ||
          lowerKey.includes("authorization")
        ) {
          result[key] = "[REDACTED]";
        } else {
          result[key] = redactFields(value);
        }
      }
      return result;
    };

    sanitized = redactFields(sanitized);

    const json = JSON.stringify(sanitized, null, 2);
    if (json.length > MAX_LENGTH) {
      return json.substring(0, MAX_LENGTH) + "... [truncated]";
    }
    return json;
  } catch (error) {
    return "[Failed to serialize]";
  }
}
