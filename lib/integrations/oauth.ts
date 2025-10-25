import { randomBytes, createHash } from "crypto";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/secrets";
import {
  type IntegrationProvider,
  getProviderConfig,
} from "@/lib/integrations/providers";

/**
 * OAuth flow utilities for integrations (Reddit, Notion)
 * Handles state management, PKCE, token exchange, and refresh
 */

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate cryptographically secure random string
 */
function generateRandomString(length: number = 32): string {
  return randomBytes(length).toString("base64url");
}

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = generateRandomString(64);
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return { codeVerifier, codeChallenge };
}

/**
 * Build authorization URL for provider OAuth flow
 */
export async function buildAuthorizeUrl(
  orgId: string,
  userId: string,
  provider: IntegrationProvider
): Promise<{ url: string; stateId: string }> {
  const config = getProviderConfig(provider);
  const state = generateRandomString();
  const pkce = generatePKCE();

  // Store state in database for later validation
  const authState = await db.integrationAuthState.create({
    data: {
      state,
      provider,
      organizationId: orgId,
      userId,
      codeVerifier: pkce.codeVerifier,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    },
  });

  // Build authorization URL
  const redirectUri = `${env.APP_URL}/api/integrations/${provider}/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getClientId(provider),
    redirect_uri: redirectUri,
    state,
    code_challenge: pkce.codeChallenge,
    code_challenge_method: "S256",
  });

  // Add provider-specific params
  if (provider === "reddit") {
    params.set("duration", "permanent"); // Request refresh token
    params.set("scope", config.defaultScopes);
  } else if (provider === "notion") {
    params.set("owner", "workspace");
  }

  const url = `${config.authorizeUrl}?${params.toString()}`;

  return { url, stateId: authState.id };
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  provider: IntegrationProvider,
  code: string,
  state: string
): Promise<{
  organizationId: string;
  userId: string;
  accountName: string | null;
}> {
  // Validate state and retrieve auth data
  const authState = await db.integrationAuthState.findFirst({
    where: {
      state,
      provider,
      expiresAt: { gte: new Date() },
    },
  });

  if (!authState) {
    throw new Error("Invalid or expired state");
  }

  // Delete state (single-use)
  await db.integrationAuthState.delete({
    where: { id: authState.id },
  });

  const config = getProviderConfig(provider);
  const redirectUri = `${env.APP_URL}/api/integrations/${provider}/callback`;

  // Exchange code for token
  const tokenResponse = await fetchToken(provider, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: authState.codeVerifier || undefined,
  });

  // Fetch account info
  const accountInfo = await fetchAccountInfo(provider, tokenResponse.access_token);

  // Upsert integration
  await db.organizationIntegration.upsert({
    where: {
      organizationId_provider: {
        organizationId: authState.organizationId,
        provider,
      },
    },
    create: {
      organizationId: authState.organizationId,
      provider,
      connectionType: "public",
      status: "connected",
      accountId: accountInfo.accountId,
      accountName: accountInfo.accountName,
      encryptedAccessToken: encryptSecret(tokenResponse.access_token),
      encryptedRefreshToken: tokenResponse.refresh_token
        ? encryptSecret(tokenResponse.refresh_token)
        : null,
      tokenType: tokenResponse.token_type,
      expiresAt: tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : null,
      scope: tokenResponse.scope || config.defaultScopes,
      createdByUserId: authState.userId,
      updatedByUserId: authState.userId,
    },
    update: {
      connectionType: "public",
      status: "connected",
      accountId: accountInfo.accountId,
      accountName: accountInfo.accountName,
      encryptedAccessToken: encryptSecret(tokenResponse.access_token),
      encryptedRefreshToken: tokenResponse.refresh_token
        ? encryptSecret(tokenResponse.refresh_token)
        : null,
      tokenType: tokenResponse.token_type,
      expiresAt: tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : null,
      scope: tokenResponse.scope || config.defaultScopes,
      updatedByUserId: authState.userId,
      updatedAt: new Date(),
    },
  });

  return {
    organizationId: authState.organizationId,
    userId: authState.userId,
    accountName: accountInfo.accountName,
  };
}

/**
 * Refresh access token (Reddit only)
 */
export async function refreshAccessToken(
  provider: IntegrationProvider,
  integrationId: string
): Promise<void> {
  const integration = await db.organizationIntegration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || !integration.encryptedRefreshToken) {
    throw new Error("Integration not found or no refresh token available");
  }

  const refreshToken = decryptSecret(integration.encryptedRefreshToken);

  // Exchange refresh token for new access token
  const tokenResponse = await fetchToken(provider, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  // Update integration with new tokens
  await db.organizationIntegration.update({
    where: { id: integrationId },
    data: {
      encryptedAccessToken: encryptSecret(tokenResponse.access_token),
      encryptedRefreshToken: tokenResponse.refresh_token
        ? encryptSecret(tokenResponse.refresh_token)
        : integration.encryptedRefreshToken, // Keep old refresh token if new one not provided
      expiresAt: tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : null,
      status: "connected",
      updatedAt: new Date(),
    },
  });
}

/**
 * Revoke integration tokens
 */
export async function revokeIntegration(
  provider: IntegrationProvider,
  integrationId: string
): Promise<void> {
  const integration = await db.organizationIntegration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    throw new Error("Integration not found");
  }

  const config = getProviderConfig(provider);

  // Attempt to revoke with provider (Reddit supports this)
  if (config.revokeUrl && provider === "reddit") {
    try {
      const accessToken = decryptSecret(integration.encryptedAccessToken);
      await revokeToken(provider, accessToken, "access_token");

      if (integration.encryptedRefreshToken) {
        const refreshToken = decryptSecret(integration.encryptedRefreshToken);
        await revokeToken(provider, refreshToken, "refresh_token");
      }
    } catch (error) {
      console.error(`Failed to revoke ${provider} token:`, error);
      // Continue with local deletion even if revocation fails
    }
  }

  // Delete integration from database
  await db.organizationIntegration.delete({
    where: { id: integrationId },
  });
}

// Helper functions

function getClientId(provider: IntegrationProvider): string {
  switch (provider) {
    case "reddit":
      return env.REDDIT_CLIENT_ID || "";
    case "notion":
      return env.NOTION_CLIENT_ID || "";
  }
}

function getClientSecret(provider: IntegrationProvider): string {
  switch (provider) {
    case "reddit":
      return env.REDDIT_CLIENT_SECRET || "";
    case "notion":
      return env.NOTION_CLIENT_SECRET || "";
  }
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
};

async function fetchToken(
  provider: IntegrationProvider,
  params: Record<string, string | undefined>
): Promise<TokenResponse> {
  const config = getProviderConfig(provider);
  const clientId = getClientId(provider);
  const clientSecret = getClientSecret(provider);

  const body = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined)
    ) as Record<string, string>
  );

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  // Reddit uses Basic auth
  if (provider === "reddit") {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${auth}`;
    headers["User-Agent"] = config.defaultHeaders["User-Agent"];
  } else {
    // Notion uses client_id/client_secret in body
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Token exchange failed: ${response.status} ${response.statusText} - ${text}`
    );
  }

  return response.json();
}

type AccountInfo = {
  accountId: string;
  accountName: string;
};

async function fetchAccountInfo(
  provider: IntegrationProvider,
  accessToken: string
): Promise<AccountInfo> {
  const config = getProviderConfig(provider);

  let endpoint: string;
  let headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...config.defaultHeaders,
  };

  switch (provider) {
    case "reddit":
      endpoint = `${config.baseUrl}/api/v1/me`;
      break;
    case "notion":
      endpoint = `${config.baseUrl}/users/me`;
      break;
  }

  const response = await fetch(endpoint, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch account info: ${response.status}`);
  }

  const data = await response.json();

  if (provider === "reddit") {
    return {
      accountId: data.id,
      accountName: data.name,
    };
  } else {
    // Notion
    return {
      accountId: data.bot?.id || data.id,
      accountName: data.bot?.workspace_name || data.name || "Notion Workspace",
    };
  }
}

async function revokeToken(
  provider: IntegrationProvider,
  token: string,
  tokenTypeHint: string
): Promise<void> {
  const config = getProviderConfig(provider);

  if (!config.revokeUrl) {
    return;
  }

  const clientId = getClientId(provider);
  const clientSecret = getClientSecret(provider);

  const body = new URLSearchParams({
    token,
    token_type_hint: tokenTypeHint,
  });

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  await fetch(config.revokeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
      "User-Agent": config.defaultHeaders["User-Agent"] || "",
    },
    body: body.toString(),
  });
}
