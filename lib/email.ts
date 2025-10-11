import { Resend } from "resend";
import { env } from "@/lib/env";

/**
 * Email sending via Resend
 * OTP email delivery
 */

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export type SendOtpEmailParams = {
  to: string;
  code: string;
  expiresAt: Date;
};

/**
 * Send OTP verification email
 */
export async function sendOtpEmail({
  to,
  code,
  expiresAt,
}: SendOtpEmailParams): Promise<void> {
  if (!resend || !env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    // In development, log to console instead
    if (env.NODE_ENV === "development") {
      console.log("\n=== OTP Email (Development) ===");
      console.log(`To: ${to}`);
      console.log(`Code: ${code}`);
      console.log(`Expires: ${expiresAt.toISOString()}`);
      console.log("================================\n");
      return;
    }
    throw new Error("Email service not configured");
  }

  const expiryMinutes = Math.round(
    (expiresAt.getTime() - Date.now()) / (1000 * 60)
  );

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: `Your verification code: ${code}`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333; font-size: 24px; margin-bottom: 16px;">Verification Code</h1>
        <p style="color: #666; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
          Your verification code is:
        </p>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
        </div>
        <p style="color: #999; font-size: 14px; line-height: 20px;">
          This code expires in ${expiryMinutes} minutes. If you didn't request this code, you can safely ignore this email.
        </p>
      </div>
    `,
    text: `Your verification code is: ${code}\n\nThis code expires in ${expiryMinutes} minutes. If you didn't request this code, you can safely ignore this email.`,
  });
}
