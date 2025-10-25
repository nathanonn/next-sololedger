import { env } from "@/lib/env";

/**
 * Integration provider configuration
 * Defines supported providers and their OAuth/API parameters
 */

export type IntegrationProvider = "reddit" | "notion" | "linkedin" | "wordpress";

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
  linkedin: {
    displayName: "LinkedIn",
    baseUrl: "https://api.linkedin.com/v2",
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    defaultScopes: env.LINKEDIN_SCOPES,
    defaultHeaders: {
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    supportsRefresh: true,
  },
  wordpress: {
    displayName: "WordPress",
    baseUrl: "", // Determined per-site at runtime
    authorizeUrl: "", // Not OAuth
    tokenUrl: "", // Not OAuth
    defaultScopes: "",
    defaultHeaders: {},
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
 * Get Notion variant flags from environment
 * Returns which Notion integration types are enabled
 */
export function getNotionVariantFlags(): { public: boolean; internal: boolean } {
  if (!env.INTEGRATIONS_ENABLED) {
    return { public: false, internal: false };
  }

  const allowed = env.INTEGRATIONS_ALLOWED.split(",").map((p) => p.trim());

  return {
    public: allowed.includes("notion_public"),
    internal: allowed.includes("notion_internal"),
  };
}

/**
 * Get list of allowed integration providers from environment
 * Collapses notion_public and notion_internal into "notion"
 */
export function getAllowedIntegrations(): IntegrationProvider[] {
  if (!env.INTEGRATIONS_ENABLED) {
    return [];
  }

  const allowed = env.INTEGRATIONS_ALLOWED.split(",").map((p) => p.trim());
  const providers = new Set<IntegrationProvider>();

  for (const item of allowed) {
    if (item === "notion_public" || item === "notion_internal") {
      providers.add("notion");
    } else if (item === "linkedin" || item === "wordpress" || item === "reddit") {
      providers.add(item as IntegrationProvider);
    }
  }

  return Array.from(providers);
}

/**
 * Get provider configuration
 */
export function getProviderConfig(
  provider: IntegrationProvider
): ProviderConfig {
  return PROVIDER_INFO[provider];
}
