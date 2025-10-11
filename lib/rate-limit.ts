import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Rate limiting for OTP requests
 * Tracks requests per email and per IP
 */

type RateLimitResult = {
  allowed: boolean;
  requiresCaptcha: boolean;
};

/**
 * Check rate limits for OTP request
 * Per-email: 3 per 15 minutes, 10 per 24 hours
 * Per-IP: 5 per 15 minutes
 * Returns requiresCaptcha after ≥2 requests in 15 minutes (if hCaptcha enabled)
 */
export async function checkOtpRateLimit(
  email: string,
  ip?: string
): Promise<RateLimitResult> {
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Count recent requests by email
  const emailCount15m = await db.otpRequest.count({
    where: {
      email,
      requestedAt: { gte: fifteenMinutesAgo },
    },
  });

  const emailCount24h = await db.otpRequest.count({
    where: {
      email,
      requestedAt: { gte: twentyFourHoursAgo },
    },
  });

  // Count recent requests by IP (if provided)
  let ipCount15m = 0;
  if (ip) {
    ipCount15m = await db.otpRequest.count({
      where: {
        ip,
        requestedAt: { gte: fifteenMinutesAgo },
      },
    });
  }

  // Check hard limits
  if (emailCount15m >= 3 || emailCount24h >= 10) {
    return { allowed: false, requiresCaptcha: false };
  }

  if (ip && ipCount15m >= 5) {
    return { allowed: false, requiresCaptcha: false };
  }

  // Check if captcha should be required
  const requiresCaptcha =
    env.HCAPTCHA_ENABLED && (emailCount15m >= 2 || (ip ? ipCount15m >= 2 : false));

  return { allowed: true, requiresCaptcha };
}

/**
 * Record an OTP request
 */
export async function recordOtpRequest(
  email: string,
  ip?: string
): Promise<void> {
  await db.otpRequest.create({
    data: {
      email,
      ip,
      requestedAt: new Date(),
    },
  });
}
