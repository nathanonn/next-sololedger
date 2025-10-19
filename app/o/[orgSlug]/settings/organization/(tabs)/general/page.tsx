"use client";

import * as React from "react";
import { useParams } from "next/navigation";
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
 * Organization General Settings Tab
 * Allows admins to update organization name
 */

const updateOrgSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
});

type UpdateOrgFormData = z.infer<typeof updateOrgSchema>;

export default function OrganizationGeneralPage(): React.JSX.Element {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  const [org, setOrg] = React.useState<{
    id: string;
    name: string;
    slug: string;
  } | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<UpdateOrgFormData>({
    resolver: zodResolver(updateOrgSchema),
    defaultValues: {
      name: "",
    },
  });

  // Fetch organization details
  React.useEffect(() => {
    async function fetchOrg() {
      try {
        const response = await fetch(`/api/orgs/${orgSlug}`);

        if (response.ok) {
          const data = await response.json();
          setOrg(data);
          form.setValue("name", data.name);
        } else {
          toast.error("Failed to load organization details");
        }
      } catch {
        toast.error("Failed to load organization details");
      }
    }

    fetchOrg();
  }, [orgSlug, form]);

  async function onSubmit(data: UpdateOrgFormData): Promise<void> {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/orgs/${orgSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to update organization");
        return;
      }

      toast.success("Organization updated successfully");
      setOrg(result.organization);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!org) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>Basic organization information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
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
            <Label htmlFor="slug">Slug (read-only)</Label>
            <Input
              id="slug"
              value={org.slug}
              disabled
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {typeof window !== "undefined" &&
                `${window.location.origin}/o/${org.slug}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Note: Organization slug cannot be changed.
            </p>
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
