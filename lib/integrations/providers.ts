import { env } from "@/lib/env";

/**
 * Integration provider configuration
 * Defines supported providers and their OAuth/API parameters
 */

export type IntegrationProvider = "reddit" | "notion";

export type ProviderConfig = {
  displayName: string;
  baseUrl: string;
  authorizeUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  defaultScopes: string;
  defaultHeaders: Record<string, string>;
  supportsRefresh: boolean;
};

export const PROVIDER_INFO: Record<IntegrationProvider, ProviderConfig> = {
  reddit: {
    displayName: "Reddit",
    baseUrl: "https://oauth.reddit.com",
    authorizeUrl: "https://www.reddit.com/api/v1/authorize",
    tokenUrl: "https://www.reddit.com/api/v1/access_token",
    revokeUrl: "https://www.reddit.com/api/v1/revoke_token",
    defaultScopes: env.REDDIT_SCOPES,
    defaultHeaders: {
      "User-Agent": env.REDDIT_USER_AGENT || "next-app/1.0",
    },
    supportsRefresh: true,
  },
  notion: {
    displayName: "Notion",
    baseUrl: "https://api.notion.com/v1",
    authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    defaultScopes: "",
    defaultHeaders: {
      "Notion-Version": env.NOTION_API_VERSION,
      "Content-Type": "application/json",
    },
    supportsRefresh: false,
  },
};

/**
 * Check if a provider is allowed based on environment configuration
 */
export function isIntegrationAllowed(
  provider: string
): provider is IntegrationProvider {
  if (!env.INTEGRATIONS_ENABLED) {
    return false;
  }

  const allowed = getAllowedIntegrations();
  return allowed.includes(provider as IntegrationProvider);
}

/**
 * Get list of allowed integration providers from environment
 */
export function getAllowedIntegrations(): IntegrationProvider[] {
  if (!env.INTEGRATIONS_ENABLED) {
    return [];
  }

  const allowed = env.INTEGRATIONS_ALLOWED.split(",")
    .map((p) => p.trim())
    .filter((p) => p in PROVIDER_INFO) as IntegrationProvider[];

  return allowed;
}

/**
 * Get provider configuration
 */
export function getProviderConfig(
  provider: IntegrationProvider
): ProviderConfig {
  return PROVIDER_INFO[provider];
}
