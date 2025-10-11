import { NextResponse } from "next/server";
import { isRequestOriginValid } from "@/lib/csrf";
import { verifyOtpSchema } from "@/lib/validators";
import {
  isEmailAllowed,
  verifyAndConsumeOtp,
  jitUpsertUser,
  audit,
  normalizeEmail,
} from "@/lib/auth";
import { signAccessJwt, signRefreshJwt, setAccessCookie, setRefreshCookie } from "@/lib/jwt";
import { safeRedirect, getClientIp } from "@/lib/auth-helpers";

/**
 * POST /api/auth/verify-otp
 * Verify OTP code and sign in
 */

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    // CSRF check
    if (!isRequestOriginValid(request)) {
      return NextResponse.json(
        { error: "Invalid origin" },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = verifyOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, code, next } = parsed.data;
    const normalizedEmail = normalizeEmail(email);
    const ip = getClientIp(request);

    // Allowlist check
    if (!isEmailAllowed(normalizedEmail)) {
      await audit({
        action: "otp_verify_failure",
        email: normalizedEmail,
        ip,
        metadata: { reason: "email_not_allowed" },
      });
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 401 }
      );
    }

    // Verify OTP
    const otpResult = await verifyAndConsumeOtp(normalizedEmail, code);

    if (!otpResult.valid) {
      await audit({
        action: "otp_verify_failure",
        email: normalizedEmail,
        ip,
        metadata: { reason: otpResult.reason },
      });

      let errorMessage = "Invalid verification code";
      if (otpResult.reason === "too_many_attempts") {
        errorMessage = "Too many failed attempts. Please request a new code.";
      } else if (otpResult.reason === "no_valid_token") {
        errorMessage = "Code expired or invalid. Please request a new code.";
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 401 }
      );
    }

    // JIT user upsert
    const user = await jitUpsertUser(normalizedEmail);

    // Generate JWT tokens
    const accessToken = await signAccessJwt({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.sessionVersion,
    });

    const refreshToken = await signRefreshJwt({
      sub: user.id,
      tokenVersion: user.sessionVersion,
    });

    // Set cookies
    await setAccessCookie(accessToken);
    await setRefreshCookie(refreshToken);

    // Audit success
    await audit({
      action: "otp_verify_success",
      userId: user.id,
      email: normalizedEmail,
      ip,
    });

    const redirect = safeRedirect(next);

    return NextResponse.json(
      { ok: true, redirect },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in verify-otp:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
