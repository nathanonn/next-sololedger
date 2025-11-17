"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronsUpDown } from "lucide-react";
import type { DashboardFilters, DashboardDateRange } from "@/lib/dashboard-types";

interface Category {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
}

interface DashboardFiltersBarProps {
  orgSlug: string;
  categories: Category[];
  availableOriginCurrencies: string[];
  onFiltersChange: (filters: DashboardFilters) => void;
}

/**
 * Parse filters from URL search params
 */
function parseFiltersFromURL(searchParams: URLSearchParams): DashboardFilters {
  const dateKind = searchParams.get("dateKind") || "ytd";
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const view = searchParams.get("view") || "both";
  const origin = searchParams.get("origin") || "all";
  const categoryIds = searchParams.get("categoryIds")
    ? searchParams.get("categoryIds")!.split(",").filter(Boolean)
    : [];

  const dateRange: DashboardDateRange = {
    kind: (dateKind as "ytd" | "last30" | "thisMonth" | "lastMonth" | "custom") || "ytd",
    from,
    to,
  };

  return {
    dateRange,
    categoryIds,
    view: view as "income" | "expense" | "both",
    originCurrency: origin,
  };
}

/**
 * Encode filters to URL search params
 */
function encodeFiltersToURL(filters: DashboardFilters): URLSearchParams {
  const params = new URLSearchParams();

  params.set("dateKind", filters.dateRange.kind);
  if (filters.dateRange.from) params.set("from", filters.dateRange.from);
  if (filters.dateRange.to) params.set("to", filters.dateRange.to);
  params.set("view", filters.view);
  params.set("origin", filters.originCurrency);
  if (filters.categoryIds.length > 0) {
    params.set("categoryIds", filters.categoryIds.join(","));
  }

  return params;
}

export function DashboardFiltersBar({
  orgSlug,
  categories,
  availableOriginCurrencies,
  onFiltersChange,
}: DashboardFiltersBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local filter state
  const [dateKind, setDateKind] = React.useState<DashboardDateRange["kind"]>("ytd");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const [view, setView] = React.useState<"income" | "expense" | "both">("both");
  const [originCurrency, setOriginCurrency] = React.useState("all");
  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<string[]>([]);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = React.useState(false);

  // Load filters from URL or localStorage on mount
  React.useEffect(() => {
    // First, try to load from URL
    const urlFilters = parseFiltersFromURL(searchParams);

    // Check if URL has any filters (not just defaults)
    const hasUrlFilters =
      searchParams.get("dateKind") ||
      searchParams.get("from") ||
      searchParams.get("to") ||
      searchParams.get("view") ||
      searchParams.get("origin") ||
      searchParams.get("categoryIds");

    let filters: DashboardFilters;

    if (!hasUrlFilters && typeof window !== "undefined") {
      // No URL filters, try localStorage
      const key = `dashboardFilters:${orgSlug}`;
      const savedFilters = localStorage.getItem(key);

      if (savedFilters) {
        try {
          filters = JSON.parse(savedFilters);
        } catch {
          filters = urlFilters; // Fallback to defaults if parse fails
        }
      } else {
        filters = urlFilters; // No saved filters, use defaults
      }
    } else {
      filters = urlFilters; // Use URL filters
    }

    // Apply filters to state
    setDateKind(filters.dateRange.kind);
    setCustomFrom(filters.dateRange.from || "");
    setCustomTo(filters.dateRange.to || "");
    setView(filters.view);
    setOriginCurrency(filters.originCurrency);
    setSelectedCategoryIds(filters.categoryIds);

    // Notify parent
    onFiltersChange(filters);
  }, [searchParams, onFiltersChange, orgSlug]);

  // Apply filters
  const handleApplyFilters = React.useCallback(() => {
    const filters: DashboardFilters = {
      dateRange: {
        kind: dateKind,
        from: dateKind === "custom" ? customFrom : undefined,
        to: dateKind === "custom" ? customTo : undefined,
      },
      categoryIds: selectedCategoryIds,
      view,
      originCurrency,
    };

    // Update URL
    const params = encodeFiltersToURL(filters);
    router.replace(`/o/${orgSlug}/dashboard?${params.toString()}`, { scroll: false });

    // Save to localStorage
    if (typeof window !== "undefined") {
      const key = `dashboardFilters:${orgSlug}`;
      localStorage.setItem(key, JSON.stringify(filters));
    }

    // Notify parent
    onFiltersChange(filters);
  }, [dateKind, customFrom, customTo, selectedCategoryIds, view, originCurrency, orgSlug, router, onFiltersChange]);

  // Reset filters
  const handleResetFilters = React.useCallback(() => {
    setDateKind("ytd");
    setCustomFrom("");
    setCustomTo("");
    setView("both");
    setOriginCurrency("all");
    setSelectedCategoryIds([]);

    const defaultFilters: DashboardFilters = {
      dateRange: { kind: "ytd" },
      categoryIds: [],
      view: "both",
      originCurrency: "all",
    };

    // Update URL
    router.replace(`/o/${orgSlug}/dashboard`, { scroll: false });

    // Clear localStorage
    if (typeof window !== "undefined") {
      const key = `dashboardFilters:${orgSlug}`;
      localStorage.removeItem(key);
    }

    // Notify parent
    onFiltersChange(defaultFilters);
  }, [orgSlug, router, onFiltersChange]);

  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Row 1: Date Range, View, Origin Currency */}
          <div className="grid gap-4 md:grid-cols-4">
            {/* Date Range Selector */}
            <div className="space-y-2">
              <Label htmlFor="dateKind">Date Range</Label>
              <Select
                value={dateKind}
                onValueChange={(v) =>
                  setDateKind(v as "ytd" | "last30" | "thisMonth" | "lastMonth" | "custom")
                }
              >
                <SelectTrigger id="dateKind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ytd">YTD (Fiscal Year)</SelectItem>
                  <SelectItem value="last30">Last 30 Days</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="lastMonth">Last Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category Multi-Select */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={categoryPopoverOpen}
                    className="w-full justify-between"
                  >
                    {selectedCategoryIds.length === 0
                      ? "All categories"
                      : `${selectedCategoryIds.length} selected`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search categories..." />
                    <CommandEmpty>No category found.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {categories.map((category) => (
                        <CommandItem
                          key={category.id}
                          onSelect={() => toggleCategorySelection(category.id)}
                        >
                          <Checkbox
                            checked={selectedCategoryIds.includes(category.id)}
                            className="mr-2"
                          />
                          {category.name}
                          <Badge variant="outline" className="ml-2 text-xs">
                            {category.type}
                          </Badge>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* View Selector */}
            <div className="space-y-2">
              <Label htmlFor="view">View</Label>
              <Select
                value={view}
                onValueChange={(v) => setView(v as "income" | "expense" | "both")}
              >
                <SelectTrigger id="view">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both</SelectItem>
                  <SelectItem value="income">Income Only</SelectItem>
                  <SelectItem value="expense">Expense Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Origin Currency Selector */}
            <div className="space-y-2">
              <Label htmlFor="originCurrency">Origin Currency</Label>
              <Select value={originCurrency} onValueChange={setOriginCurrency}>
                <SelectTrigger id="originCurrency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Currencies</SelectItem>
                  <SelectItem value="base">Base Currency Only</SelectItem>
                  {availableOriginCurrencies.map((curr) => (
                    <SelectItem key={curr} value={curr}>
                      {curr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Custom Date Pickers (shown only when dateKind = custom) */}
          {dateKind === "custom" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customFrom">From Date</Label>
                <Input
                  id="customFrom"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customTo">To Date</Label>
                <Input
                  id="customTo"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleApplyFilters}>Apply Filters</Button>
            <Button variant="outline" onClick={handleResetFilters}>
              Reset
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
