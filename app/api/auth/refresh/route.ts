import { NextResponse } from "next/server";
import { refreshFromRefreshToken, safeRedirect, getClientIp } from "@/lib/auth-helpers";
import { audit } from "@/lib/auth";

/**
 * GET /api/auth/refresh
 * Refresh access and refresh tokens
 * Called by middleware rewrite when access token expired but refresh valid
 */

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const next = searchParams.get("next");
    const ip = getClientIp(request);

    const result = await refreshFromRefreshToken();

    if (!result.success || !result.user) {
      return NextResponse.redirect(new URL(`/login?next=${next || "/dashboard"}`, request.url));
    }

    // Audit token refresh
    await audit({
      action: "token_refresh",
      userId: result.user.id,
      email: result.user.email,
      ip,
    });

    // Check if this is an XHR/fetch request
    const acceptHeader = request.headers.get("accept");
    const isXhr = acceptHeader?.includes("application/json");

    if (isXhr) {
      // For API calls, return 204
      return new Response(null, { status: 204 });
    }

    // For page navigation, redirect to original destination
    const redirect = safeRedirect(next);
    return NextResponse.redirect(new URL(redirect, request.url));
  } catch (error) {
    console.error("Error in refresh:", error);
    const { searchParams } = new URL(request.url);
    const next = searchParams.get("next");
    return NextResponse.redirect(new URL(`/login?next=${next || "/dashboard"}`, request.url));
  }
}
