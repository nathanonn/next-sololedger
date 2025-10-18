import bcrypt from "bcrypt";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Core authentication utilities
 * OTP generation/verification, password hashing, audit logging
 */

/**
 * Normalize email to lowercase
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Check if email is in allowlist
 */
export function isEmailAllowed(email: string): boolean {
  const normalizedEmail = normalizeEmail(email);
  const allowedEmails = env.ALLOWED_EMAILS.split(",").map((e) =>
    normalizeEmail(e)
  );
  return allowedEmails.includes(normalizedEmail);
}

/**
 * Hash a password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

/**
 * Compare password with hash
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate numeric OTP code
 */
export function generateOtpCode(): string {
  const length = env.OTP_LENGTH;
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}

/**
 * Hash OTP code with bcrypt
 */
export async function hashOtp(code: string): Promise<string> {
  // Use fewer rounds for OTP (short-lived)
  return bcrypt.hash(code, 10);
}

/**
 * Create or replace OTP token for email
 * Consumes any existing unconsumed tokens
 */
export async function createOtpToken(email: string): Promise<{
  code: string;
  expiresAt: Date;
}> {
  const normalizedEmail = normalizeEmail(email);
  const code = generateOtpCode();
  const otpHash = await hashOtp(code);
  const expiresAt = new Date(Date.now() + env.OTP_EXP_MINUTES * 60 * 1000);

  // Consume existing unconsumed tokens for this email
  await db.otpToken.updateMany({
    where: {
      email: normalizedEmail,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  });

  // Create new token
  await db.otpToken.create({
    data: {
      email: normalizedEmail,
      otpHash,
      expiresAt,
    },
  });

  return { code, expiresAt };
}

/**
 * Verify and consume OTP token
 * Returns true if valid, false otherwise
 * Increments attempts; consumes after 5 attempts
 */
export async function verifyAndConsumeOtp(
  email: string,
  code: string
): Promise<{ valid: boolean; reason?: string }> {
  const normalizedEmail = normalizeEmail(email);

  // Find latest unconsumed, unexpired token
  const token = await db.otpToken.findFirst({
    where: {
      email: normalizedEmail,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!token) {
    return { valid: false, reason: "no_valid_token" };
  }

  // Check attempts limit
  if (token.attempts >= 5) {
    await db.otpToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    });
    return { valid: false, reason: "too_many_attempts" };
  }

  // Verify code
  const isValid = await bcrypt.compare(code, token.otpHash);

  if (!isValid) {
    // Increment attempts
    const newAttempts = token.attempts + 1;
    await db.otpToken.update({
      where: { id: token.id },
      data: {
        attempts: newAttempts,
        consumedAt: newAttempts >= 5 ? new Date() : null,
      },
    });
    return { valid: false, reason: "invalid_code" };
  }

  // Valid: consume token
  await db.otpToken.update({
    where: { id: token.id },
    data: { consumedAt: new Date() },
  });

  return { valid: true };
}

/**
 * JIT user upsert: create or update user on successful OTP verification
 */
export async function jitUpsertUser(email: string): Promise<{
  id: string;
  email: string;
  role: string;
  sessionVersion: number;
}> {
  const normalizedEmail = normalizeEmail(email);

  const user = await db.user.upsert({
    where: { email: normalizedEmail },
    update: {
      emailVerifiedAt: new Date(),
    },
    create: {
      email: normalizedEmail,
      emailVerifiedAt: new Date(),
      role: "user",
      sessionVersion: 1,
    },
  });

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
}

/**
 * Audit log entry
 */
export type AuditEvent = {
  action: string;
  userId?: string;
  email?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
};

export async function audit(event: AuditEvent): Promise<void> {
  await db.auditLog.create({
    data: {
      action: event.action,
      userId: event.userId,
      email: event.email ? normalizeEmail(event.email) : undefined,
      ip: event.ip,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: event.metadata ? (event.metadata as any) : undefined,
    },
  });
}
