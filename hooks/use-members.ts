"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Member data type
 */
export type Member = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  joinedAt: string;
};

/**
 * Members response from API
 */
type MembersResponse = {
  members: Member[];
  total: number;
  adminCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * useMembers hook options
 */
type UseMembersOptions = {
  page?: number;
  pageSize?: number;
  excludeSuperadmins?: boolean;
};

/**
 * useMembers hook return type
 */
export type UseMembersReturn = {
  data: MembersResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
};

/**
 * Hook for fetching organization members with pagination and refetch capability
 *
 * @param orgSlug - Organization slug
 * @param options - Pagination and filtering options
 * @returns Members data, loading state, error, refetch function, and pagination setters
 *
 * @example
 * const { data, isLoading, error, refetch } = useMembers("acme", {
 *   page: 1,
 *   pageSize: 20,
 *   excludeSuperadmins: true
 * });
 */
export function useMembers(
  orgSlug: string,
  options: UseMembersOptions = {}
): UseMembersReturn {
  const {
    page: initialPage = 1,
    pageSize: initialPageSize = 20,
    excludeSuperadmins = false
  } = options;

  const [data, setData] = useState<MembersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const fetchMembers = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (excludeSuperadmins) {
        params.append("excludeSuperadmins", "true");
      }

      const response = await fetch(
        `/api/orgs/${orgSlug}/members?${params.toString()}`
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to fetch members");
      }

      const membersData = await response.json();
      setData(membersData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load members";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [orgSlug, page, pageSize, excludeSuperadmins]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchMembers,
    setPage,
    setPageSize,
  };
}
