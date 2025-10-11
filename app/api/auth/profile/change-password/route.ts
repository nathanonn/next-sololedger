import { NextResponse } from "next/server";
import { isRequestOriginValid } from "@/lib/csrf";
import { changePasswordSchema } from "@/lib/validators";
import { hashPassword, comparePassword, audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { signAccessJwt, signRefreshJwt, setAccessCookie, setRefreshCookie } from "@/lib/jwt";
import { getClientIp } from "@/lib/auth-helpers";

/**
 * POST /api/auth/profile/change-password
 * Change password (requires current password)
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

    // Must have existing password
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "No password set. Use set-password instead." },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;
    const ip = getClientIp(request);

    // Verify current password
    const isValid = await comparePassword(currentPassword, user.passwordHash);

    if (!isValid) {
      await audit({
        action: "password_change_failure",
        userId: user.id,
        email: user.email,
        ip,
        metadata: { reason: "invalid_current_password" },
      });
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    // Hash new password
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

    // Audit success
    await audit({
      action: "password_change_success",
      userId: user.id,
      email: user.email,
      ip,
    });

    return NextResponse.json(
      { ok: true },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in change-password:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
