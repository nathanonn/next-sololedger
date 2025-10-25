"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";

const connectSchema = z.object({
  siteUrl: z.string().url("Valid site URL is required"),
  username: z.string().min(1, "Username is required"),
  applicationPassword: z.string().min(1, "Application password is required"),
  defaultStatus: z.enum(["draft", "publish", "none"]).optional(),
  defaultCategoryId: z.string().optional(),
  defaultAuthorId: z.string().optional(),
});

type ConnectFormData = z.infer<typeof connectSchema>;

type WordPressInternalConnectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  mode: "connect" | "update";
  onSuccess: () => void;
};

export function WordPressInternalConnectDialog({
  open,
  onOpenChange,
  orgSlug,
  mode,
  onSuccess,
}: WordPressInternalConnectDialogProps): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<ConnectFormData>({
    resolver: zodResolver(connectSchema),
    defaultValues: {
      siteUrl: "",
      username: "",
      applicationPassword: "",
      defaultStatus: "none",
      defaultCategoryId: "",
      defaultAuthorId: "",
    },
  });

  async function onSubmit(data: ConnectFormData): Promise<void> {
    try {
      setLoading(true);

      // Prepare defaults (exclude "none" values)
      const defaults: {
        status?: "draft" | "publish";
        categoryId?: number;
        authorId?: number;
      } = {};

      if (data.defaultStatus && data.defaultStatus !== "none") {
        defaults.status = data.defaultStatus;
      }

      if (data.defaultCategoryId && data.defaultCategoryId.trim()) {
        const categoryId = parseInt(data.defaultCategoryId, 10);
        if (!isNaN(categoryId)) {
          defaults.categoryId = categoryId;
        }
      }

      if (data.defaultAuthorId && data.defaultAuthorId.trim()) {
        const authorId = parseInt(data.defaultAuthorId, 10);
        if (!isNaN(authorId)) {
          defaults.authorId = authorId;
        }
      }

      const response = await fetch(
        `/api/orgs/${orgSlug}/integrations/wordpress/internal-connect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteUrl: data.siteUrl,
            username: data.username,
            applicationPassword: data.applicationPassword,
            defaults: Object.keys(defaults).length > 0 ? defaults : undefined,
          }),
        }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to connect");
      }

      const result = await response.json();

      toast.success(
        mode === "update"
          ? "WordPress credentials updated successfully"
          : `WordPress connected successfully${result.accountName ? ` - ${result.accountName}` : ""}`
      );

      form.reset();
      onSuccess();
    } catch (error) {
      console.error("Error connecting WordPress:", error);
      toast.error(error instanceof Error ? error.message : "Failed to connect");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "update" ? "Update WordPress Credentials" : "Connect WordPress"}
          </DialogTitle>
          <DialogDescription>
            Connect your self-hosted WordPress site using Application Passwords.
            {mode === "connect" && (
              <>
                <br />
                <span className="text-xs mt-1 block">
                  Note: Your site must use HTTPS and have Application Passwords enabled (WordPress 5.6+).
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="siteUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormDescription>
                    Your WordPress site URL (must use HTTPS)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="admin"
                      {...field}
                      disabled={loading}
                      autoComplete="username"
                    />
                  </FormControl>
                  <FormDescription>Your WordPress username</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="applicationPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Application Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                        {...field}
                        disabled={loading}
                        autoComplete="new-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Generate at: Users → Profile → Application Passwords
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Default Settings (Optional)</h4>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="defaultStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Post Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={loading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select default status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="publish">Publish</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defaultCategoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Category ID</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 1"
                          {...field}
                          disabled={loading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defaultAuthorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Author ID</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 1"
                          {...field}
                          disabled={loading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

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
                {mode === "update" ? "Update" : "Connect"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
