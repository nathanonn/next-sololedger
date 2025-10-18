import { z } from "zod";

/**
 * Environment variable validation
 * Validates required env vars at runtime with Zod
 */

const envSchema = z.object({
  // Core
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),

  // JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ACCESS_COOKIE_NAME: z.string().default("__access"),
  JWT_REFRESH_COOKIE_NAME: z.string().default("__session"),

  // Auth
  ALLOWED_EMAILS: z.string().min(1, "ALLOWED_EMAILS required for authentication"),
  ALLOWED_ORIGINS: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  RESEND_EMAIL_DOMAIN: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),

  // Dev password signin
  ENABLE_DEV_PASSWORD_SIGNIN: z
    .string()
    .transform((val) => val === "true")
    .default("false"),

  // hCaptcha (optional)
  HCAPTCHA_ENABLED: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  HCAPTCHA_SITE_KEY: z.string().optional(),
  HCAPTCHA_SECRET_KEY: z.string().optional(),

  // OTP tunables
  OTP_EXP_MINUTES: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default("10"),
  OTP_LENGTH: z
    .string()
    .transform((val) => Math.max(4, Math.min(8, parseInt(val, 10))))
    .default("6"),
  BCRYPT_ROUNDS: z
    .string()
    .transform((val) => Math.max(10, Math.min(15, parseInt(val, 10))))
    .default("12"),

  // Dev helpers
  SKIP_PASSWORD_VALIDATION: z
    .string()
    .transform((val) => val === "true")
    .default("false"),

  // Multi-tenant
  INVITE_EXP_MINUTES: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default("10080"), // 7 days
  INVITES_PER_ORG_PER_DAY: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default("20"),
  INVITES_PER_IP_15M: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default("5"),
  ORG_RESERVED_SLUGS: z
    .string()
    .default("o,api,dashboard,settings,login,invite,onboarding,_next,assets,auth,public"),
  LAST_ORG_COOKIE_NAME: z.string().default("__last_org"),
});

// Parse and export validated env
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error("Environment validation failed:");
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join(".")}: ${err.message}`);
      });
    }
    throw new Error("Invalid environment configuration");
  }
};

export const env = parseEnv();

export type Env = z.infer<typeof envSchema>;
