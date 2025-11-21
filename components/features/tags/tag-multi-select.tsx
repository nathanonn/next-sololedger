"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
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
import { ChevronsUpDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface TagOption {
  id: string;
  name: string;
}

interface TagMultiSelectProps {
  tags: TagOption[];
  selectedTagIds: string[];
  onChange: (ids: string[]) => void;
  tagMode: "any" | "all";
  onModeChange: (mode: "any" | "all") => void;
  disabled?: boolean;
  label?: string;
}

export function TagMultiSelect({
  tags,
  selectedTagIds,
  onChange,
  tagMode,
  onModeChange,
  disabled,
  label = "Tags",
}: TagMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filteredTags = React.useMemo(() => {
    if (!search.trim()) return tags;
    const lower = search.toLowerCase();
    return tags.filter((tag) => tag.name.toLowerCase().includes(lower));
  }, [search, tags]);

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const hasSelection = selectedTagIds.length > 0;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {hasSelection
              ? `${selectedTagIds.length} selected`
              : "All tags"}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search tags..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandEmpty>No tags found.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {filteredTags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  onSelect={() => toggleTag(tag.id)}
                  className="flex items-center gap-2"
                >
                  <Checkbox
                    checked={selectedTagIds.includes(tag.id)}
                    className="mr-2"
                  />
                  {tag.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Match mode</Label>
        <Select
          value={tagMode}
          onValueChange={(value) => onModeChange(value as "any" | "all")}
          disabled={disabled || !hasSelection}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Match any selected tag</SelectItem>
            <SelectItem value="all">Match all selected tags</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
