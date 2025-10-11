import { jwtVerify } from "jose";

/**
 * JWT verification for Edge runtime (middleware)
 * Only verifies signature - no DB access
 */

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: string;
  tokenVersion: number;
};

/**
 * Verify access JWT signature only (for Edge middleware)
 * Does NOT check sessionVersion against DB
 */
export async function verifyAccessJwtSignatureOnly(
  token: string,
  jwtSecret: string
): Promise<AccessTokenPayload | null> {
  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as AccessTokenPayload;
  } catch {
    return null;
  }
}
