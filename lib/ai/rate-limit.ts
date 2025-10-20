import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getOrgAiSettings } from "@/lib/ai/config";

/**
 * Rate limiting for AI generation requests
 * Tracks requests per organization and per IP
 * Server-only module - Node runtime required
 */

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
};

type RateLimitError = {
  error: string;
  retryAfter: number; // seconds
  limit: number;
  current: number;
};

/**
 * Checks rate limit for AI generation requests
 * Per-org: 60/min (default, configurable per org)
 * Per-IP: 120/min (default, env tunable)
 *
 * @returns RateLimitResult if allowed, throws RateLimitError if blocked
 */
export async function checkAiRateLimit(
  orgId: string,
  ip?: string
): Promise<RateLimitResult> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

  // Get org-specific settings
  const orgSettings = await getOrgAiSettings(orgId);
  const orgLimit = orgSettings.perMinuteLimit ?? env.AI_RATE_LIMIT_PER_MIN_ORG;
  const ipLimit = env.AI_RATE_LIMIT_PER_MIN_IP;

  // Count org requests in last minute (using AI generation logs)
  const orgCount = await db.aiGenerationLog.count({
    where: {
      organizationId: orgId,
      createdAt: { gte: oneMinuteAgo },
    },
  });

  if (orgCount >= orgLimit) {
    const resetAt = new Date(oneMinuteAgo.getTime() + 60 * 1000);
    const retryAfter = Math.ceil((resetAt.getTime() - now.getTime()) / 1000);

    throw {
      error: `Organization rate limit exceeded. Maximum ${orgLimit} requests per minute.`,
      retryAfter,
      limit: orgLimit,
      current: orgCount,
    } as RateLimitError;
  }

  // Count IP requests in last minute (if IP provided)
  if (ip) {
    // For IP tracking, we'll need to add IP to generation logs
    // For now, we'll implement a simple in-memory tracker
    // In production, consider Redis or similar for distributed rate limiting
    const ipCount = await countIpRequests(ip, oneMinuteAgo);

    if (ipCount >= ipLimit) {
      const resetAt = new Date(oneMinuteAgo.getTime() + 60 * 1000);
      const retryAfter = Math.ceil((resetAt.getTime() - now.getTime()) / 1000);

      throw {
        error: `IP rate limit exceeded. Maximum ${ipLimit} requests per minute.`,
        retryAfter,
        limit: ipLimit,
        current: ipCount,
      } as RateLimitError;
    }
  }

  // Calculate remaining and reset time
  const resetAt = new Date(oneMinuteAgo.getTime() + 60 * 1000);
  const remaining = orgLimit - orgCount;

  return {
    allowed: true,
    limit: orgLimit,
    remaining,
    resetAt,
  };
}

/**
 * In-memory IP request tracker
 * TODO: Replace with Redis or similar for production distributed systems
 */
const ipRequestTracker = new Map<string, number[]>();

function countIpRequests(ip: string, since: Date): number {
  const now = Date.now();
  const sinceTs = since.getTime();

  // Get or create tracker for this IP
  let timestamps = ipRequestTracker.get(ip) || [];

  // Filter out old timestamps
  timestamps = timestamps.filter((ts) => ts >= sinceTs);

  // Update tracker
  ipRequestTracker.set(ip, timestamps);

  // Clean up old IPs periodically (simple LRU)
  if (ipRequestTracker.size > 10000) {
    // Keep only most recent 1000 IPs
    const sortedEntries = Array.from(ipRequestTracker.entries()).sort(
      (a, b) => Math.max(...b[1]) - Math.max(...a[1])
    );
    ipRequestTracker.clear();
    sortedEntries.slice(0, 1000).forEach(([k, v]) => {
      ipRequestTracker.set(k, v);
    });
  }

  return timestamps.length;
}

/**
 * Records an IP request timestamp
 * Called after successful generation to track IP limits
 */
export function recordIpRequest(ip: string): void {
  const now = Date.now();
  const timestamps = ipRequestTracker.get(ip) || [];
  timestamps.push(now);
  ipRequestTracker.set(ip, timestamps);
}

/**
 * Type guard for rate limit errors
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    "retryAfter" in error &&
    "limit" in error &&
    "current" in error
  );
}

/**
 * Helper to format rate limit error for HTTP response
 */
export function formatRateLimitError(error: RateLimitError): {
  status: number;
  headers: Record<string, string>;
  body: { error: string; retryAfter: number };
} {
  return {
    status: 429,
    headers: {
      "Retry-After": String(error.retryAfter),
      "X-RateLimit-Limit": String(error.limit),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(
        Math.floor(Date.now() / 1000) + error.retryAfter
      ),
    },
    body: {
      error: error.error,
      retryAfter: error.retryAfter,
    },
  };
}

/**
 * Helper to add rate limit headers to successful responses
 */
export function addRateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.floor(result.resetAt.getTime() / 1000)),
  };
}
