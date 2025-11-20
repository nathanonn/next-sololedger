/**
 * APIClient provides a wrapper for all SoloLedger API calls
 *
 * Features:
 * - Auto bearer token management via TokenManager
 * - Consistent error handling with actionable messages
 * - Support for JSON and multipart/form-data requests
 * - Automatic 401 token refresh retry
 */

import fetch, { RequestInit, Response } from "node-fetch";
import { TokenManager } from "./token-manager.js";
import FormData from "form-data";

export class APIClient {
  private tokenManager: TokenManager;

  constructor(
    private apiUrl: string,
    private orgSlug: string,
    apiKey: string
  ) {
    this.tokenManager = new TokenManager(apiUrl, apiKey);
  }

  /**
   * Make an authenticated API request
   */
  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.tokenManager.getToken();
    const url = `${this.apiUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    };

    // Add Content-Type for JSON if not already set and body is present
    if (
      options.body &&
      typeof options.body === "string" &&
      !headers["Content-Type"]
    ) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 by refreshing token and retrying once
    if (response.status === 401) {
      await this.tokenManager.refreshToken();
      const retryToken = await this.tokenManager.getToken();
      headers.Authorization = `Bearer ${retryToken}`;

      const retryResponse = await fetch(url, {
        ...options,
        headers,
      });

      return this.handleResponse<T>(retryResponse);
    }

    return this.handleResponse<T>(response);
  }

  /**
   * Handle API response and errors
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage: string;

      try {
        const errorData = await response.json();
        errorMessage = (errorData as any).error || response.statusText;
      } catch {
        errorMessage = response.statusText;
      }

      const actionableError = this.getActionableError(
        response.status,
        errorMessage
      );
      throw new Error(actionableError);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  /**
   * Convert HTTP errors to actionable messages
   */
  private getActionableError(status: number, message: string): string {
    const prefix = `API Error (${status})`;

    switch (status) {
      case 400:
        return `${prefix}: Invalid request - ${message}. Check your input parameters.`;
      case 401:
        return `${prefix}: Authentication failed - ${message}. Check your API key.`;
      case 403:
        return `${prefix}: Permission denied - ${message}. You may lack required permissions or API key scope.`;
      case 404:
        return `${prefix}: Resource not found - ${message}. The resource may not exist or has been deleted.`;
      case 429:
        return `${prefix}: Rate limit exceeded - ${message}. Wait before retrying.`;
      case 500:
        return `${prefix}: Server error - ${message}. Contact support if this persists.`;
      default:
        return `${prefix}: ${message}`;
    }
  }

  /**
   * GET request helper
   */
  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    return this.request<T>(url, { method: "GET" });
  }

  /**
   * POST request helper
   */
  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * PATCH request helper
   */
  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  /**
   * DELETE request helper
   */
  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  /**
   * Upload files with multipart/form-data
   */
  async uploadFiles<T = any>(
    endpoint: string,
    files: Array<{ filename: string; content: Buffer; mimeType: string }>
  ): Promise<T> {
    const formData = new FormData();

    for (const file of files) {
      formData.append("files", file.content, {
        filename: file.filename,
        contentType: file.mimeType,
      });
    }

    const token = await this.tokenManager.getToken();
    const url = `${this.apiUrl}${endpoint}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...formData.getHeaders(),
      },
      body: formData as any,
    });

    return this.handleResponse<T>(response);
  }

  /**
   * Download file
   */
  async downloadFile(endpoint: string): Promise<Buffer> {
    const token = await this.tokenManager.getToken();
    const url = `${this.apiUrl}${endpoint}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to download file (${response.status}): ${response.statusText}`
      );
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Get organization slug
   */
  getOrgSlug(): string {
    return this.orgSlug;
  }
}
