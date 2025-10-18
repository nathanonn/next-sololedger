"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Client component for organizations list filters
 * Handles search, sort, and pagination controls
 */

export function OrganizationsFilters(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") || "";
  const sort = searchParams.get("sort") || "createdAt";
  const dir = searchParams.get("dir") || "desc";
  const pageSize = searchParams.get("pageSize") || "20";

  function buildQueryString(updates: Record<string, string>): string {
    const params = new URLSearchParams(searchParams.toString());

    // Apply updates
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== getDefaultValue(key)) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    // Reset page when filters change (except when updating page itself)
    if (!updates.page && updates.q !== undefined || updates.sort !== undefined || updates.dir !== undefined || updates.pageSize !== undefined) {
      params.delete("page");
    }

    return params.toString() ? `?${params.toString()}` : "";
  }

  function getDefaultValue(key: string): string {
    const defaults: Record<string, string> = {
      page: "1",
      pageSize: "20",
      sort: "createdAt",
      dir: "desc",
      q: "",
    };
    return defaults[key] || "";
  }

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const searchValue = formData.get("q") as string;
    router.push(`/admin/organizations${buildQueryString({ q: searchValue })}`);
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex-1 max-w-md">
        <form onSubmit={handleSearchSubmit}>
          <Input
            name="q"
            placeholder="Search by name or slug..."
            defaultValue={q}
            className="w-full"
          />
        </form>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-sm font-medium whitespace-nowrap">
            Sort:
          </label>
          <Select
            value={sort}
            onValueChange={(value) => {
              router.push(`/admin/organizations${buildQueryString({ sort: value })}`);
            }}
          >
            <SelectTrigger id="sort" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Created</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="dir" className="text-sm font-medium whitespace-nowrap">
            Order:
          </label>
          <Select
            value={dir}
            onValueChange={(value) => {
              router.push(`/admin/organizations${buildQueryString({ dir: value })}`);
            }}
          >
            <SelectTrigger id="dir" className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Asc</SelectItem>
              <SelectItem value="desc">Desc</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="pageSize" className="text-sm font-medium whitespace-nowrap">
            Per page:
          </label>
          <Select
            value={pageSize}
            onValueChange={(value) => {
              router.push(`/admin/organizations${buildQueryString({ pageSize: value })}`);
            }}
          >
            <SelectTrigger id="pageSize" className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
