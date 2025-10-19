"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Invitation data type
 */
export type Invitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  invitedBy: string;
  createdAt: string;
};

/**
 * useInvitations hook return type
 */
export type UseInvitationsReturn = {
  items: Invitation[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

/**
 * Hook for fetching organization invitations with refetch capability
 *
 * @param orgSlug - Organization slug
 * @returns Invitations data, loading state, error, and refetch function
 *
 * @example
 * const { items, isLoading, error, refetch } = useInvitations("acme");
 */
export function useInvitations(orgSlug: string): UseInvitationsReturn {
  const [items, setItems] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orgs/${orgSlug}/invitations`);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to fetch invitations");
      }

      const data = await response.json();
      setItems(data.invitations || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load invitations";
      setError(errorMessage);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  return {
    items,
    isLoading,
    error,
    refetch: fetchInvitations,
  };
}
