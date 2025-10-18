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
 * Schema for creating an organization
 */
const createOrgSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  slug: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val === "") return true;
        return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(val);
      },
      {
        message: "Slug must be lowercase letters, numbers, and hyphens only",
      }
    ),
});

type CreateOrgFormData = z.infer<typeof createOrgSchema>;

export type CreateOrganizationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appUrl: string;
};

/**
 * Dialog for creating a new organization
 */
export function CreateOrganizationDialog({
  open,
  onOpenChange,
  appUrl,
}: CreateOrganizationDialogProps): React.JSX.Element {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CreateOrgFormData>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const slugValue = form.watch("slug");
  const nameValue = form.watch("name");

  // Generate slug preview from name if slug is empty
  const slugPreview = React.useMemo(() => {
    if (slugValue && slugValue.trim() !== "") {
      return slugValue;
    }
    if (nameValue && nameValue.trim() !== "") {
      return nameValue
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }
    return "your-org-slug";
  }, [slugValue, nameValue]);

  async function onSubmit(data: CreateOrgFormData): Promise<void> {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          ...(data.slug && data.slug.trim() !== "" && { slug: data.slug }),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to create organization");
        setIsSubmitting(false);
        return;
      }

      toast.success("Organization created successfully");
      form.reset();
      onOpenChange(false);
      router.replace(`/admin/organizations/${result.organization.slug}`);
    } catch (error) {
      console.error("Error creating organization:", error);
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
      form.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
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
                  <FormLabel>Slug (optional, kebab-case)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="acme"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    URL Preview: {appUrl}/o/{slugPreview}
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
                {isSubmitting ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
