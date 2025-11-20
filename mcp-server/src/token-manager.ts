/**
 * TokenManager handles bearer token caching and auto-refresh
 *
 * Features:
 * - Caches access token with expiry tracking
 * - Auto-exchanges API key when token expires
 * - 60-second buffer before expiry to prevent edge cases
 * - Thread-safe token refresh
 */

import fetch from "node-fetch";

interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export class TokenManager {
  private accessToken: string | null = null;
  private expiresAt: number = 0;
  private refreshPromise: Promise<string> | null = null;

  constructor(
    private apiUrl: string,
    private apiKey: string
  ) {}

  /**
   * Get a valid access token, exchanging for a new one if needed
   * Includes 60-second buffer before expiry to prevent edge cases
   */
  async getToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid (with 60s buffer)
    if (this.accessToken && now < this.expiresAt - 60000) {
      return this.accessToken;
    }

    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Start new token exchange
    this.refreshPromise = this.exchangeApiKey();

    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Exchange API key for a new access token
   */
  private async exchangeApiKey(): Promise<string> {
    const url = `${this.apiUrl}/api/auth/api-key/exchange`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `ApiKey ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Failed to exchange API key (${response.status}): ${error}`
      );
    }

    const data = (await response.json()) as TokenResponse;

    // Cache token with expiry timestamp
    this.accessToken = data.accessToken;
    this.expiresAt = Date.now() + data.expiresIn * 1000;

    return this.accessToken;
  }

  /**
   * Force refresh of the access token
   */
  async refreshToken(): Promise<string> {
    this.accessToken = null;
    this.expiresAt = 0;
    return this.getToken();
  }
}
