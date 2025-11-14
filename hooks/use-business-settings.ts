"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Business settings data type
 */
export type BusinessSettings = {
  organization: {
    id: string;
    name: string;
  };
  settings: {
    businessType: string;
    businessTypeOther: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    taxId: string | null;
  } | null;
};

/**
 * useBusinessSettings hook return type
 */
export type UseBusinessSettingsReturn = {
  data: BusinessSettings | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  mutate: (newData: BusinessSettings) => void;
};

/**
 * Hook for fetching organization business settings
 *
 * @param orgSlug - Organization slug
 * @returns Business settings data, loading state, error, refetch function, and mutate function
 *
 * @example
 * const { data, isLoading, error, refetch, mutate } = useBusinessSettings("acme");
 */
export function useBusinessSettings(
  orgSlug: string
): UseBusinessSettingsReturn {
  const [data, setData] = useState<BusinessSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orgs/${orgSlug}/settings/business`);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to fetch business settings");
      }

      const settingsData = await response.json();
      setData(settingsData);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load business settings";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Optimistic update function for immediate UI updates
  const mutate = useCallback((newData: BusinessSettings) => {
    setData(newData);
  }, []);

  return {
    data,
    isLoading,
    error,
    refetch: fetchSettings,
    mutate,
  };
}
