"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Info, Loader2 } from "lucide-react";
import { useBusinessSettings } from "@/hooks/use-business-settings";

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

export default function BusinessInfoPage(): React.JSX.Element {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const { data: settingsData, isLoading, error, refetch } = useBusinessSettings(orgSlug);

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

  // Determine if current user is admin
  // If we have member data and the user can see this page, they have at least member role
  // We check if they're admin by attempting to submit (which will fail if they're not admin)
  const [userRole, setUserRole] = React.useState<"admin" | "member" | null>(null);

  // Load settings data into form
  React.useEffect(() => {
    if (settingsData?.settings) {
      form.reset({
        businessName: settingsData.organization.name || "",
        businessType: settingsData.settings.businessType as BusinessDetailsFormData["businessType"],
        businessTypeOther: settingsData.settings.businessTypeOther || "",
        address: settingsData.settings.address || "",
        phone: settingsData.settings.phone || "",
        email: settingsData.settings.email || "",
        taxId: settingsData.settings.taxId || "",
      });
    }
  }, [settingsData, form]);

  // Determine user role by checking if they have write access
  React.useEffect(() => {
    async function checkRole() {
      try {
        // Try a HEAD request or check memberships endpoint
        // For now, we'll assume if they can access members data they're an admin
        // A more robust solution would check the user's actual role
        const response = await fetch(`/api/orgs/${orgSlug}/members?page=1&pageSize=1`);
        if (response.ok) {
          await response.json();
          // If we can fetch members, we're likely an admin
          // This is a simplification - in production you'd have a dedicated role check
          setUserRole("admin");
        } else if (response.status === 403) {
          setUserRole("member");
        }
      } catch {
        setUserRole("member");
      }
    }
    checkRole();
  }, [orgSlug]);

  async function onSubmit(data: BusinessDetailsFormData) {
    if (userRole === "member") {
      toast.error("You don't have permission to edit business information");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/orgs/${orgSlug}/settings/business`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to update business information");
        return;
      }

      toast.success("Business information updated successfully");
      refetch();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const isAdmin = userRole === "admin";
  const isMember = userRole === "member";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Information</CardTitle>
        <CardDescription>
          Manage your organization&apos;s business details and contact information
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isMember && (
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              You are viewing business information in read-only mode. Only administrators can make changes.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name</Label>
            <Input
              id="businessName"
              {...form.register("businessName")}
              disabled={!isAdmin || isSubmitting}
            />
            {form.formState.errors.businessName && (
              <p className="text-sm text-destructive">
                {form.formState.errors.businessName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessType">Business Type</Label>
            <Select
              value={form.watch("businessType")}
              onValueChange={(value) =>
                form.setValue("businessType", value as BusinessDetailsFormData["businessType"])
              }
              disabled={!isAdmin || isSubmitting}
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
          </div>

          {watchBusinessType === "Other" && (
            <div className="space-y-2">
              <Label htmlFor="businessTypeOther">Please specify</Label>
              <Input
                id="businessTypeOther"
                {...form.register("businessTypeOther")}
                placeholder="e.g., E-commerce, Retail"
                disabled={!isAdmin || isSubmitting}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="address">Business Address (Optional)</Label>
            <Textarea
              id="address"
              {...form.register("address")}
              placeholder="Street address, city, postal code, country"
              rows={3}
              disabled={!isAdmin || isSubmitting}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                {...form.register("phone")}
                placeholder="+60 12 345 6789"
                disabled={!isAdmin || isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Business Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
                placeholder="contact@business.com"
                disabled={!isAdmin || isSubmitting}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="taxId">Tax ID / Registration Number (Optional)</Label>
            <Input
              id="taxId"
              {...form.register("taxId")}
              placeholder="e.g., 1234567890"
              disabled={!isAdmin || isSubmitting}
            />
          </div>

          {isAdmin && (
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
