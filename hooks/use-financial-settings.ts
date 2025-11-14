"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Financial settings data type
 */
export type FinancialSettings = {
  settings: {
    baseCurrency: string;
    fiscalYearStartMonth: number;
    dateFormat: "DD_MM_YYYY" | "MM_DD_YYYY" | "YYYY_MM_DD";
    decimalSeparator: "DOT" | "COMMA";
    thousandsSeparator: "COMMA" | "DOT" | "SPACE" | "NONE";
  } | null;
};

/**
 * useFinancialSettings hook return type
 */
export type UseFinancialSettingsReturn = {
  data: FinancialSettings | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  mutate: (newData: FinancialSettings) => void;
};

/**
 * Hook for fetching organization financial settings
 *
 * @param orgSlug - Organization slug
 * @returns Financial settings data, loading state, error, refetch function, and mutate function
 *
 * @example
 * const { data, isLoading, error, refetch, mutate } = useFinancialSettings("acme");
 */
export function useFinancialSettings(
  orgSlug: string
): UseFinancialSettingsReturn {
  const [data, setData] = useState<FinancialSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orgs/${orgSlug}/settings/financial`);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to fetch financial settings");
      }

      const settingsData = await response.json();
      setData(settingsData);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to load financial settings";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Optimistic update function for immediate UI updates
  const mutate = useCallback((newData: FinancialSettings) => {
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
