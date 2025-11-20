/**
 * Configuration for SoloLedger MCP Server
 *
 * Environment variables:
 * - SOLOLEDGER_API_KEY: Your API key (slk_...)
 * - SOLOLEDGER_API_URL: Base URL (default: http://localhost:3000)
 * - SOLOLEDGER_ORG_SLUG: Organization slug to use
 */

export interface Config {
  apiKey: string;
  apiUrl: string;
  orgSlug: string;
}

export function loadConfig(): Config {
  const apiKey = process.env.SOLOLEDGER_API_KEY;
  const apiUrl = process.env.SOLOLEDGER_API_URL || "http://localhost:3000";
  const orgSlug = process.env.SOLOLEDGER_ORG_SLUG;

  if (!apiKey) {
    throw new Error("SOLOLEDGER_API_KEY environment variable is required");
  }

  if (!orgSlug) {
    throw new Error("SOLOLEDGER_ORG_SLUG environment variable is required");
  }

  if (!apiKey.startsWith("slk_")) {
    throw new Error("SOLOLEDGER_API_KEY must start with 'slk_'");
  }

  return {
    apiKey,
    apiUrl,
    orgSlug,
  };
}
