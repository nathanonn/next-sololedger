import { NextResponse } from "next/server";
import { isRequestOriginValid } from "@/lib/csrf";
import { clearAuthCookies, getAccessToken, verifyAccessJwt } from "@/lib/jwt";
import { audit } from "@/lib/auth";
import { getClientIp } from "@/lib/auth-helpers";

/**
 * POST /api/auth/signout
 * Clear auth cookies and audit
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

    const ip = getClientIp(request);

    // Try to get current user info for audit
    try {
      const token = await getAccessToken();
      if (token) {
        const payload = await verifyAccessJwt(token);
        await audit({
          action: "signout",
          userId: payload.sub,
          email: payload.email,
          ip,
        });
      }
    } catch {
      // Ignore - just clear cookies anyway
    }

    // Clear cookies
    await clearAuthCookies();

    return NextResponse.json(
      { ok: true },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in signout:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
