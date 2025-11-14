"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/**
 * Organization creation onboarding page
 * Required for new users who don't have any organizations
 */

const createOrgSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(50, "Slug too long")
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Only lowercase letters, numbers, and hyphens"
    )
    .refine((val) => !val.startsWith("-") && !val.endsWith("-"), {
      message: "Cannot start or end with a hyphen",
    }),
});

type CreateOrgFormData = z.infer<typeof createOrgSchema>;

export default function CreateOrganizationPage(): React.JSX.Element {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<CreateOrgFormData>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  // Auto-generate slug from name
  const watchName = form.watch("name");
  React.useEffect(() => {
    if (watchName && !form.formState.dirtyFields.slug) {
      const generatedSlug = watchName
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .substring(0, 50);

      form.setValue("slug", generatedSlug, { shouldValidate: false });
    }
  }, [watchName, form]);

  async function onSubmit(data: CreateOrgFormData): Promise<void> {
    try {
      setIsLoading(true);

      const response = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to create business");
        return;
      }

      toast.success("Business created successfully");

      // Redirect to onboarding step 2: Business Details
      router.push(`/onboarding/${result.organization.slug}/business`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="text-sm text-muted-foreground mb-2">
            Step 1 of 4
          </div>
          <CardTitle>Create your business</CardTitle>
          <CardDescription>
            Set up a business to track your Sololedger data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Business Name</Label>
              <Input
                id="name"
                placeholder="My Business"
                {...form.register("name")}
                disabled={isLoading}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Business URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="slug"
                  placeholder="my-business"
                  {...form.register("slug")}
                  disabled={isLoading}
                  className="font-mono text-sm"
                />
              </div>
              {form.formState.errors.slug && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.slug.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {typeof window !== "undefined" &&
                  `${window.location.origin}/o/${form.watch("slug") || "your-business"}`}
              </p>
              <p className="text-xs text-muted-foreground">
                Tip: You can&apos;t change the slug later.
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? "Creating..." : "Continue"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
