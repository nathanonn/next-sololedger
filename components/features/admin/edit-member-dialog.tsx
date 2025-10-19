"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

/**
 * Schema for editing a member
 */
const editMemberSchema = z.object({
  name: z.string().max(255, "Name too long").optional(),
  role: z.enum(["admin", "member"]),
});

type EditMemberFormData = z.infer<typeof editMemberSchema>;

export type EditMemberDialogProps = {
  orgSlug: string;
  userId: string;
  email: string;
  initialName: string | null;
  initialRole: string;
  isLastAdmin: boolean;
  onEdited?: () => void;
};

/**
 * Dialog for editing member details
 */
export function EditMemberDialog({
  orgSlug,
  userId,
  email,
  initialName,
  initialRole,
  isLastAdmin,
  onEdited,
}: EditMemberDialogProps): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<EditMemberFormData>({
    resolver: zodResolver(editMemberSchema),
    defaultValues: {
      name: initialName || "",
      role: initialRole as "admin" | "member",
    },
  });

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      form.reset({
        name: initialName || "",
        role: initialRole as "admin" | "member",
      });
    }
  }, [open, initialName, initialRole, form]);

  async function onSubmit(data: EditMemberFormData): Promise<void> {
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/members/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(data.name !== undefined && data.name !== initialName && { name: data.name }),
            ...(data.role !== initialRole && { role: data.role }),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to update member");
        setIsSubmitting(false);
        return;
      }

      toast.success("Member updated successfully");
      setIsSubmitting(false);
      setOpen(false);
      router.refresh();

      // Call onEdited callback
      if (onEdited) {
        onEdited();
      }
    } catch (error) {
      console.error("Error updating member:", error);
      toast.error("Network error. Please try again.");
      setIsSubmitting(false);
    }
  }

  function handleOpenChange(isOpen: boolean): void {
    setOpen(isOpen);
    if (!isOpen) {
      // Restore pointer events after dialog closes
      setTimeout(() => {
        document.body.style.pointerEvents = "";
      }, 300);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-4 w-4 mr-2" />
        Edit
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Email (read-only)</label>
                <div className="mt-1.5 text-sm text-muted-foreground">{email}</div>
              </div>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter name"
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isSubmitting || (isLastAdmin && field.value === "admin")}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                    {isLastAdmin && field.value === "admin" && (
                      <p className="text-xs text-muted-foreground">
                        Cannot demote the last admin
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
