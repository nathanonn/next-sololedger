"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Role select for changing member role
 * Disabled for last admin with tooltip
 */

type RoleSelectProps = {
  orgSlug: string;
  userId: string;
  currentRole: string;
  isLastAdmin: boolean;
};

export function RoleSelect({
  orgSlug,
  userId,
  currentRole,
  isLastAdmin,
}: RoleSelectProps): React.JSX.Element {
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleRoleChange(newRole: string): Promise<void> {
    if (newRole === role || isUpdating) return;

    setIsUpdating(true);
    const previousRole = role;
    setRole(newRole); // Optimistic update

    try {
      const response = await fetch(`/api/orgs/${orgSlug}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update role");
      }

      toast.success("Role updated successfully");
      router.refresh();
    } catch (error) {
      // Revert optimistic update
      setRole(previousRole);
      toast.error(
        error instanceof Error ? error.message : "Failed to update role"
      );
    } finally {
      setIsUpdating(false);
    }
  }

  if (isLastAdmin) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-block">
              <Select value={role} disabled>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
              </Select>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Cannot demote the last admin</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Select
      value={role}
      onValueChange={handleRoleChange}
      disabled={isUpdating}
    >
      <SelectTrigger className="w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="member">Member</SelectItem>
      </SelectContent>
    </Select>
  );
}
