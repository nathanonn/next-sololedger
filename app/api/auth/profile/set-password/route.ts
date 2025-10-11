import { NextResponse } from "next/server";
import { isRequestOriginValid } from "@/lib/csrf";
import { setPasswordSchema } from "@/lib/validators";
import { hashPassword, audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { signAccessJwt, signRefreshJwt, setAccessCookie, setRefreshCookie } from "@/lib/jwt";
import { getClientIp } from "@/lib/auth-helpers";
import { env } from "@/lib/env";

/**
 * POST /api/auth/profile/set-password
 * Set password for user who doesn't have one
 * Increments sessionVersion and rotates tokens
 */

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    // Auth required
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // CSRF check
    if (!isRequestOriginValid(request)) {
      return NextResponse.json(
        { error: "Invalid origin" },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();

    // In development, allow skipping validation if flag is set
    const shouldSkipValidation =
      env.NODE_ENV === "development" &&
      env.SKIP_PASSWORD_VALIDATION;

    let newPassword: string;

    if (shouldSkipValidation) {
      // Simple validation: just check it exists
      if (!body.newPassword || typeof body.newPassword !== "string") {
        return NextResponse.json(
          { error: "Password required" },
          { status: 400 }
        );
      }
      newPassword = body.newPassword;
    } else {
      const parsed = setPasswordSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid request", details: parsed.error.format() },
          { status: 400 }
        );
      }
      newPassword = parsed.data.newPassword;
    }

    const ip = getClientIp(request);

    // Hash password
    const passwordHash = await hashPassword(newPassword);

    // Update user and increment sessionVersion
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        sessionVersion: user.sessionVersion + 1,
      },
    });

    // Generate new tokens with incremented version
    const accessToken = await signAccessJwt({
      sub: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      tokenVersion: updatedUser.sessionVersion,
    });

    const refreshToken = await signRefreshJwt({
      sub: updatedUser.id,
      tokenVersion: updatedUser.sessionVersion,
    });

    // Set cookies
    await setAccessCookie(accessToken);
    await setRefreshCookie(refreshToken);

    // Audit
    await audit({
      action: "password_set",
      userId: user.id,
      email: user.email,
      ip,
    });

    return NextResponse.json(
      { ok: true },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in set-password:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
