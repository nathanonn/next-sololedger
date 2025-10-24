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
  AUTH_SAMESITE_STRATEGY: z.enum(["strict", "lax", "none"]).default("lax"),

  // Auth
  AUTH_ALLOWLIST_ENABLED: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  AUTH_SIGNUP_ENABLED: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  ALLOWED_EMAILS: z.string().optional(), // Only required when AUTH_ALLOWLIST_ENABLED=true
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
  ORG_CREATION_ENABLED: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  ORG_CREATION_LIMIT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default("1"),
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

  // Seed (for scripts)
  SEED_EMAIL: z.string().email().optional(),

  // AI Features
  AI_FEATURES_ENABLED: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  APP_ENCRYPTION_KEY: z.string().optional(), // base64-encoded 32 bytes (AES-256-GCM), required when AI_FEATURES_ENABLED=true
  AI_RATE_LIMIT_PER_MIN_ORG: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default("60"),
  AI_RATE_LIMIT_PER_MIN_IP: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default("120"),
  AI_ALLOWED_PROVIDERS: z
    .string()
    .default("openai,gemini,anthropic"),

  // External Integrations
  INTEGRATIONS_ENABLED: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  INTEGRATIONS_ALLOWED: z
    .string()
    .default("reddit,notion"),
  INTEGRATIONS_USAGE_LOGGING_ENABLED: z
    .string()
    .transform((val) => val === "true")
    .default("false"),

  // Reddit Integration
  REDDIT_CLIENT_ID: z.string().optional(),
  REDDIT_CLIENT_SECRET: z.string().optional(),
  REDDIT_USER_AGENT: z.string().optional(),
  REDDIT_SCOPES: z.string().default("identity read"),

  // Notion Integration
  NOTION_CLIENT_ID: z.string().optional(),
  NOTION_CLIENT_SECRET: z.string().optional(),
  NOTION_API_VERSION: z.string().default("2022-06-28"),
})
  .refine(
    (data) => {
      // If allowlist is enabled, ALLOWED_EMAILS must be provided
      if (data.AUTH_ALLOWLIST_ENABLED && !data.ALLOWED_EMAILS) {
        return false;
      }
      return true;
    },
    {
      message: "ALLOWED_EMAILS is required when AUTH_ALLOWLIST_ENABLED=true",
      path: ["ALLOWED_EMAILS"],
    }
  )
  .refine(
    (data) => {
      // If AI features are enabled, APP_ENCRYPTION_KEY must be provided
      if (data.AI_FEATURES_ENABLED && !data.APP_ENCRYPTION_KEY) {
        return false;
      }
      return true;
    },
    {
      message: "APP_ENCRYPTION_KEY is required when AI_FEATURES_ENABLED=true",
      path: ["APP_ENCRYPTION_KEY"],
    }
  )
  .refine(
    (data) => {
      // If integrations are enabled, APP_ENCRYPTION_KEY must be provided
      if (data.INTEGRATIONS_ENABLED && !data.APP_ENCRYPTION_KEY) {
        return false;
      }
      return true;
    },
    {
      message: "APP_ENCRYPTION_KEY is required when INTEGRATIONS_ENABLED=true",
      path: ["APP_ENCRYPTION_KEY"],
    }
  )
  .refine(
    (data) => {
      // If integrations are enabled and reddit is allowed, validate Reddit credentials
      if (data.INTEGRATIONS_ENABLED) {
        const allowed = data.INTEGRATIONS_ALLOWED.split(",").map((p) => p.trim());
        if (allowed.includes("reddit")) {
          if (!data.REDDIT_CLIENT_ID || !data.REDDIT_CLIENT_SECRET || !data.REDDIT_USER_AGENT) {
            return false;
          }
        }
      }
      return true;
    },
    {
      message: "REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and REDDIT_USER_AGENT are required when reddit is in INTEGRATIONS_ALLOWED",
      path: ["REDDIT_CLIENT_ID"],
    }
  )
  .refine(
    (data) => {
      // If integrations are enabled and notion is allowed, validate Notion credentials
      if (data.INTEGRATIONS_ENABLED) {
        const allowed = data.INTEGRATIONS_ALLOWED.split(",").map((p) => p.trim());
        if (allowed.includes("notion")) {
          if (!data.NOTION_CLIENT_ID || !data.NOTION_CLIENT_SECRET) {
            return false;
          }
        }
      }
      return true;
    },
    {
      message: "NOTION_CLIENT_ID and NOTION_CLIENT_SECRET are required when notion is in INTEGRATIONS_ALLOWED",
      path: ["NOTION_CLIENT_ID"],
    }
  );

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
