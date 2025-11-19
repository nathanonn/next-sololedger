"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Organization = {
  id: string;
  name: string;
  slug: string;
};

type NewApiKeyResponse = {
  apiKey: {
    id: string;
    name: string;
    prefix: string;
    organizationId: string;
    organization: Organization;
    scopes: string[] | null;
    expiresAt: string | null;
    createdAt: string;
  };
  fullKey: string;
};

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  organizationId: z.string().cuid("Please select an organization"),
  expiryOption: z.enum(["never", "90days", "30days", "custom"]),
  customDays: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (data: NewApiKeyResponse) => void;
};

export function CreateApiKeyDialog({ open, onOpenChange, onSuccess }: Props): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      organizationId: "",
      expiryOption: "90days",
      customDays: "",
    },
  });

  // Load organizations
  useEffect(() => {
    const loadOrganizations = async (): Promise<void> => {
      try {
        const response = await fetch("/api/user/organizations");
        if (!response.ok) throw new Error("Failed to load organizations");
        const data = await response.json();
        setOrganizations(data.organizations || []);
        // Auto-select if only one org
        if (data.organizations?.length === 1) {
          form.setValue("organizationId", data.organizations[0].id);
        }
      } catch {
        toast.error("Failed to load organizations");
      } finally {
        setLoadingOrgs(false);
      }
    };

    if (open) {
      loadOrganizations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = async (values: FormValues): Promise<void> => {
    setLoading(true);
    try {
      // Calculate expiry date
      let expiresAt: string | null = null;
      if (values.expiryOption === "90days") {
        const date = new Date();
        date.setDate(date.getDate() + 90);
        expiresAt = date.toISOString();
      } else if (values.expiryOption === "30days") {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        expiresAt = date.toISOString();
      } else if (values.expiryOption === "custom" && values.customDays) {
        const days = parseInt(values.customDays, 10);
        if (!isNaN(days) && days > 0) {
          const date = new Date();
          date.setDate(date.getDate() + days);
          expiresAt = date.toISOString();
        }
      }

      const response = await fetch("/api/auth/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          organizationId: values.organizationId,
          expiresAt,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create API key");
      }

      const data: NewApiKeyResponse = await response.json();
      toast.success("API key created successfully");
      form.reset();
      onSuccess(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create API key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>
            Create a new API key to access your organization programmatically.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="MCP Server for My Org" {...field} />
                  </FormControl>
                  <FormDescription>
                    A descriptive name to identify this API key
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="organizationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={loadingOrgs || organizations.length === 1}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The organization this key will have access to
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expiryOption"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Expiry</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="never" id="never" />
                        <label htmlFor="never" className="text-sm font-normal cursor-pointer">
                          Never
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="90days" id="90days" />
                        <label htmlFor="90days" className="text-sm font-normal cursor-pointer">
                          90 days (recommended)
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="30days" id="30days" />
                        <label htmlFor="30days" className="text-sm font-normal cursor-pointer">
                          30 days
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="custom" id="custom" />
                        <label htmlFor="custom" className="text-sm font-normal cursor-pointer">
                          Custom
                        </label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("expiryOption") === "custom" && (
              <FormField
                control={form.control}
                name="customDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom days</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="365" {...field} />
                    </FormControl>
                    <FormDescription>
                      Number of days until the key expires
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Key
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
