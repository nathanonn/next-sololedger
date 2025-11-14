"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const businessDetailsSchema = z.object({
  businessName: z.string().min(1, "Business name is required").max(255),
  businessType: z.enum([
    "Freelance",
    "Consulting",
    "Agency",
    "SaaS",
    "Other",
  ]),
  businessTypeOther: z.string().max(255).optional(),
  address: z.string().max(1000).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  taxId: z.string().max(100).optional(),
});

type BusinessDetailsFormData = z.infer<typeof businessDetailsSchema>;

export default function BusinessDetailsPage(): React.JSX.Element {
  const router = useRouter();
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);

  const form = useForm<BusinessDetailsFormData>({
    resolver: zodResolver(businessDetailsSchema),
    defaultValues: {
      businessName: "",
      businessType: "Freelance",
      businessTypeOther: "",
      address: "",
      phone: "",
      email: "",
      taxId: "",
    },
  });

  const watchBusinessType = form.watch("businessType");

  // Load organization data
  React.useEffect(() => {
    async function loadOrg() {
      try {
        // Load existing settings using orgSlug
        const settingsResponse = await fetch(
          `/api/orgs/${orgSlug}/settings/business`
        );

        if (settingsResponse.ok) {
          const data = await settingsResponse.json();

          form.reset({
            businessName: data.organization.name || "",
            businessType: data.settings?.businessType || "Freelance",
            businessTypeOther: data.settings?.businessTypeOther || "",
            address: data.settings?.address || "",
            phone: data.settings?.phone || "",
            email: data.settings?.email || "",
            taxId: data.settings?.taxId || "",
          });
        } else if (settingsResponse.status === 404) {
          toast.error("Organization not found");
          router.push("/onboarding/create-organization");
          return;
        }
      } catch (error) {
        console.error("Error loading organization:", error);
        toast.error("Failed to load organization");
      } finally {
        setIsInitialLoading(false);
      }
    }

    loadOrg();
  }, [orgSlug, router, form]);

  async function onSubmit(data: BusinessDetailsFormData): Promise<void> {
    try {
      setIsLoading(true);

      // Validate businessTypeOther if type is "Other"
      if (data.businessType === "Other" && !data.businessTypeOther?.trim()) {
        toast.error("Please describe your business type");
        return;
      }

      const response = await fetch(`/api/orgs/${orgSlug}/settings/business`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to update business details");
        return;
      }

      toast.success("Business details saved");

      // Redirect to financial configuration step
      router.push(`/onboarding/${orgSlug}/financial`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="text-sm text-muted-foreground mb-2">
            Step 2 of 4 – Business details
          </div>
          <CardTitle>Tell us about your business</CardTitle>
          <CardDescription>
            This helps personalize your Sololedger setup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="businessName">
                Business Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="businessName"
                {...form.register("businessName")}
                disabled={isLoading}
              />
              {form.formState.errors.businessName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.businessName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessType">
                Business Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.watch("businessType")}
                onValueChange={(value) =>
                  form.setValue(
                    "businessType",
                    value as BusinessDetailsFormData["businessType"]
                  )
                }
                disabled={isLoading}
              >
                <SelectTrigger id="businessType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Freelance">Freelance</SelectItem>
                  <SelectItem value="Consulting">Consulting</SelectItem>
                  <SelectItem value="Agency">Agency</SelectItem>
                  <SelectItem value="SaaS">SaaS</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.businessType && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.businessType.message}
                </p>
              )}
            </div>

            {watchBusinessType === "Other" && (
              <div className="space-y-2">
                <Label htmlFor="businessTypeOther">
                  Describe your business{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="businessTypeOther"
                  {...form.register("businessTypeOther")}
                  disabled={isLoading}
                  placeholder="e.g., E-commerce, Education..."
                />
                {form.formState.errors.businessTypeOther && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.businessTypeOther.message}
                  </p>
                )}
              </div>
            )}

            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium mb-4">
                Contact details (optional)
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    {...form.register("address")}
                    disabled={isLoading}
                    rows={3}
                    placeholder="Street address, city, country..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    {...form.register("phone")}
                    disabled={isLoading}
                    placeholder="+60 12-345 6789"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register("email")}
                    disabled={isLoading}
                    placeholder="contact@business.com"
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxId">Tax ID / Registration</Label>
                  <Input
                    id="taxId"
                    {...form.register("taxId")}
                    disabled={isLoading}
                    placeholder="Business registration number"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  router.push("/onboarding/create-organization")
                }
                disabled={isLoading}
              >
                Back
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? "Saving..." : "Save & Continue"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center pt-4">
              You can change these later in Settings → Business (Owner/Admin
              only)
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
