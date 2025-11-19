"use client";

import { useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  organizationId: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  scopes: string[] | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  expiryOption: z.enum(["never", "90days", "30days", "custom"]),
  customDays: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type Props = {
  apiKey: ApiKey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function EditApiKeyDialog({ apiKey, open, onOpenChange, onSuccess }: Props): JSX.Element {
  const [loading, setLoading] = useState(false);

  // Calculate initial expiry option
  const getInitialExpiryOption = (): "never" | "90days" | "30days" | "custom" => {
    if (!apiKey.expiresAt) return "never";
    const expiresAt = new Date(apiKey.expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 85 && diffDays <= 95) return "90days";
    if (diffDays >= 28 && diffDays <= 32) return "30days";
    return "custom";
  };

  // Calculate initial custom days value
  const getInitialCustomDays = (): string => {
    if (!apiKey.expiresAt) return "";
    const expiresAt = new Date(apiKey.expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // If it's a custom duration (not 30 or 90 days), return the number of days
    if (diffDays < 28 || (diffDays > 32 && diffDays < 85) || diffDays > 95) {
      return diffDays.toString();
    }
    return ""; // Standard durations (30 or 90 days) don't need custom value
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: apiKey.name,
      expiryOption: getInitialExpiryOption(),
      customDays: getInitialCustomDays(),
    },
  });

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

      const response = await fetch(`/api/auth/api-keys/${apiKey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          expiresAt,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update API key");
      }

      toast.success("API key updated successfully");
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update API key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit API Key</DialogTitle>
          <DialogDescription>
            Update the name or expiry date of this API key.
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

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Organization</Label>
              <p className="text-sm mt-1">{apiKey.organization.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">(cannot be changed)</p>
            </div>

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
                        <RadioGroupItem value="never" id="edit-never" />
                        <label htmlFor="edit-never" className="text-sm font-normal cursor-pointer">
                          Never
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="90days" id="edit-90days" />
                        <label htmlFor="edit-90days" className="text-sm font-normal cursor-pointer">
                          90 days
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="30days" id="edit-30days" />
                        <label htmlFor="edit-30days" className="text-sm font-normal cursor-pointer">
                          30 days
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="custom" id="edit-custom" />
                        <label htmlFor="edit-custom" className="text-sm font-normal cursor-pointer">
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
                      Number of days from now until the key expires
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
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function Label({ className, children }: { className?: string; children: React.ReactNode }): JSX.Element {
  return <label className={className}>{children}</label>;
}
