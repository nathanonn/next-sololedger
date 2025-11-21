"use client";

import * as React from "react";
import type { TagOption } from "@/components/features/tags/tag-multi-select";

export function useOrgTags(orgSlug: string) {
  const [tags, setTags] = React.useState<TagOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;
    async function loadTags() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/orgs/${orgSlug}/tags`);
        if (!response.ok) return;
        const data = await response.json();
        if (isMounted) {
          setTags(data.tags || []);
        }
      } catch (error) {
        console.error("Failed to load tags", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTags();

    return () => {
      isMounted = false;
    };
  }, [orgSlug]);

  return { tags, isLoading };
}
