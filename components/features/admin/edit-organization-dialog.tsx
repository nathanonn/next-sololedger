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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Schema for editing an organization
 */
const editOrgSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .refine(
      (val) => {
        return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(val);
      },
      {
        message: "Slug must be lowercase letters, numbers, and hyphens only",
      }
    ),
});

type EditOrgFormData = z.infer<typeof editOrgSchema>;

export type EditOrganizationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  orgSlug: string;
  appUrl: string;
  lastOrgCookieName: string;
};

/**
 * Dialog for editing organization details
 */
export function EditOrganizationDialog({
  open,
  onOpenChange,
  orgName,
  orgSlug,
  appUrl,
  lastOrgCookieName,
}: EditOrganizationDialogProps): React.JSX.Element {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<EditOrgFormData>({
    resolver: zodResolver(editOrgSchema),
    defaultValues: {
      name: orgName,
      slug: orgSlug,
    },
  });

  // Reset form when org changes
  React.useEffect(() => {
    form.reset({
      name: orgName,
      slug: orgSlug,
    });
  }, [orgName, orgSlug, form]);

  const slugValue = form.watch("slug");

  async function onSubmit(data: EditOrgFormData): Promise<void> {
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/orgs/${orgSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name !== orgName ? data.name : undefined,
          slug: data.slug !== orgSlug ? data.slug : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to update organization");
        setIsSubmitting(false);
        return;
      }

      toast.success("Organization updated successfully");
      setIsSubmitting(false);
      onOpenChange(false);

      // If slug changed, update cookie and redirect
      if (data.slug !== orgSlug) {
        // Update last-org cookie if it matched the old slug
        const cookies = document.cookie.split("; ");
        const lastOrgCookie = cookies.find((c) =>
          c.startsWith(`${lastOrgCookieName}=`)
        );
        if (lastOrgCookie) {
          const cookieSlug = lastOrgCookie.split("=")[1];
          if (cookieSlug === orgSlug) {
            // Update cookie to new slug
            document.cookie = `${lastOrgCookieName}=${data.slug}; path=/; max-age=31536000; samesite=strict`;
          }
        }

        router.replace(`/admin/organizations/${data.slug}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("Error updating organization:", error);
      toast.error("Network error. Please try again.");
      setIsSubmitting(false);
    }
  }

  function handleOpenChange(isOpen: boolean): void {
    onOpenChange(isOpen);
    if (!isOpen) {
      // Restore pointer events after dialog closes
      setTimeout(() => {
        document.body.style.pointerEvents = "";
      }, 300);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Acme Inc"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug (kebab-case)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="acme"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    URL Preview: {appUrl}/o/{slugValue}
                  </FormDescription>
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
  );
}
