import { NextResponse } from "next/server";
import { isRequestOriginValid } from "@/lib/csrf";
import { devSigninSchema } from "@/lib/validators";
import {
  isEmailAllowed,
  comparePassword,
  audit,
  normalizeEmail,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { signAccessJwt, signRefreshJwt, setAccessCookie, setRefreshCookie } from "@/lib/jwt";
import { safeRedirect, getClientIp } from "@/lib/auth-helpers";
import { env } from "@/lib/env";

/**
 * POST /api/auth/dev-signin
 * Dev-only password sign-in
 * Only enabled when NODE_ENV=development and ENABLE_DEV_PASSWORD_SIGNIN=true
 */

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  // Only available in development
  if (
    env.NODE_ENV !== "development" ||
    !env.ENABLE_DEV_PASSWORD_SIGNIN
  ) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

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
    const parsed = devSigninSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, password, next } = parsed.data;
    const normalizedEmail = normalizeEmail(email);
    const ip = getClientIp(request);

    // Allowlist check
    if (!isEmailAllowed(normalizedEmail)) {
      await audit({
        action: "dev_signin_failure",
        email: normalizedEmail,
        ip,
        metadata: { reason: "email_not_allowed" },
      });
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Find user
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      await audit({
        action: "dev_signin_failure",
        email: normalizedEmail,
        ip,
        metadata: { reason: "user_not_found_or_no_password" },
      });
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await comparePassword(password, user.passwordHash);

    if (!isValid) {
      await audit({
        action: "dev_signin_failure",
        userId: user.id,
        email: normalizedEmail,
        ip,
        metadata: { reason: "invalid_password" },
      });
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

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
      action: "dev_signin_success",
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
    console.error("Error in dev-signin:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
