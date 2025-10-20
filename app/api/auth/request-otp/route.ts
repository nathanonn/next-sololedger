import { NextResponse } from "next/server";
import { isRequestOriginValid } from "@/lib/csrf";
import { requestOtpSchema } from "@/lib/validators";
import {
  isEmailAllowed,
  createOtpToken,
  audit,
  normalizeEmail,
} from "@/lib/auth";
import { checkOtpRateLimit, recordOtpRequest } from "@/lib/rate-limit";
import { sendOtpEmail } from "@/lib/email";
import { getClientIp } from "@/lib/auth-helpers";
import { env } from "@/lib/env";
import { db } from "@/lib/db";

/**
 * POST /api/auth/request-otp
 * Request OTP code via email
 * Rate limited, allowlist enforced, optional hCaptcha
 */

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    // CSRF check
    if (!isRequestOriginValid(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = requestOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, hcaptchaToken } = parsed.data;
    const normalizedEmail = normalizeEmail(email);
    const ip = getClientIp(request);

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, role: true },
    });

    // Check for active invitation (case-insensitive email match)
    const activeInvitation = await db.invitation.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    // Signup toggle check: if disabled and user doesn't exist, allow if active invite exists
    if (!env.AUTH_SIGNUP_ENABLED && !existingUser) {
      if (!activeInvitation) {
        await audit({
          action: "otp_request_blocked",
          email: normalizedEmail,
          ip,
          metadata: { reason: "signup_disabled_no_account" },
        });
        return NextResponse.json(
          {
            error:
              "No account found for this email. Sign up is disabled. Please contact an administrator.",
          },
          { status: 400 }
        );
      }
      // Active invitation exists - allow signup to proceed (bypass will be logged in audit)
    }

    // Allowlist check (superadmins and invited users bypass allowlist)
    const isSuperadmin = existingUser?.role === "superadmin";
    const hasActiveInvite = !!activeInvitation;

    if (!isSuperadmin && !hasActiveInvite && !isEmailAllowed(normalizedEmail)) {
      await audit({
        action: "otp_request_blocked",
        email: normalizedEmail,
        ip,
        metadata: { reason: "email_not_allowed" },
      });
      return NextResponse.json(
        {
          ok: true,
          message: "If your email is allowed, you will receive a code",
        },
        { status: 200 }
      );
    }

    // Rate limit check
    const rateLimitResult = await checkOtpRateLimit(normalizedEmail, ip);

    if (!rateLimitResult.allowed) {
      await audit({
        action: "otp_request_rate_limited",
        email: normalizedEmail,
        ip,
      });
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Check if captcha is required
    if (rateLimitResult.requiresCaptcha) {
      if (!hcaptchaToken) {
        return NextResponse.json(
          { ok: false, requiresCaptcha: true },
          { status: 400 }
        );
      }

      // Verify hCaptcha if enabled
      if (env.HCAPTCHA_ENABLED && env.HCAPTCHA_SECRET_KEY) {
        const verifyResponse = await fetch("https://hcaptcha.com/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret: env.HCAPTCHA_SECRET_KEY,
            response: hcaptchaToken,
          }),
        });

        const verifyData = await verifyResponse.json();

        if (!verifyData.success) {
          return NextResponse.json(
            { ok: false, requiresCaptcha: true, error: "Invalid captcha" },
            { status: 400 }
          );
        }
      }
    }

    // Create OTP token
    const { code, expiresAt } = await createOtpToken(normalizedEmail);

    // Send email
    await sendOtpEmail({ to: normalizedEmail, code, expiresAt });

    // Record request for rate limiting
    await recordOtpRequest(normalizedEmail, ip);

    // Audit
    await audit({
      action: "otp_request",
      email: normalizedEmail,
      ip,
      ...(hasActiveInvite && {
        metadata: { reason: "invited_signup_allowed" },
      }),
    });

    return NextResponse.json(
      {
        ok: true,
        message: "If your email is allowed, you will receive a code",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in request-otp:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
