import { z } from "zod";
import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common";
import * as zxcvbnEnPackage from "@zxcvbn-ts/language-en";

/**
 * Zod validation schemas for authentication
 */

// Initialize zxcvbn
zxcvbnOptions.setOptions({
  translations: zxcvbnEnPackage.translations,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEnPackage.dictionary,
  },
});

/**
 * Email validation
 */
export const emailSchema = z.string().email("Invalid email address").toLowerCase();

/**
 * Password validation with strength check
 * Min 8 chars, must meet zxcvbn score ≥ 3
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine(
    (password) => {
      const result = zxcvbn(password);
      return result.score >= 3;
    },
    {
      message:
        "Password is too weak. Use a mix of letters, numbers, and symbols.",
    }
  );

/**
 * OTP code validation (numeric, 4-8 digits)
 */
export const otpCodeSchema = z
  .string()
  .regex(/^\d{4,8}$/, "Code must be 4-8 digits");

/**
 * Redirect path validation (internal only)
 * Coerces null to undefined for tolerant client handling
 */
export const redirectSchema = z.preprocess(
  (v) => v ?? undefined,
  z
    .string()
    .optional()
    .refine(
      (path) => {
        if (!path) return true;
        return path.startsWith("/") && !path.startsWith("//");
      },
      { message: "Redirect must be an internal path" }
    )
);

/**
 * Request OTP schema
 * Note: next is omitted as it's not used server-side
 */
export const requestOtpSchema = z.object({
  email: emailSchema,
  hcaptchaToken: z.string().optional(),
});

/**
 * Verify OTP schema
 */
export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
  next: redirectSchema,
});

/**
 * Dev signin schema
 */
export const devSigninSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password required"),
  next: redirectSchema,
});

/**
 * Set password schema
 */
export const setPasswordSchema = z.object({
  newPassword: passwordSchema,
});

/**
 * Change password schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password required"),
  newPassword: passwordSchema,
});
