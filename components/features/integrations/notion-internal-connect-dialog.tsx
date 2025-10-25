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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const connectSchema = z.object({
  token: z.string().min(1, "Token is required"),
  workspaceId: z.string().optional(),
});

const updateSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

type ConnectFormData = z.infer<typeof connectSchema>;
type UpdateFormData = z.infer<typeof updateSchema>;

type NotionInternalConnectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  mode: "connect" | "update";
  onSuccess: () => void;
};

export function NotionInternalConnectDialog({
  open,
  onOpenChange,
  orgSlug,
  mode,
  onSuccess,
}: NotionInternalConnectDialogProps): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);

  const schema = mode === "connect" ? connectSchema : updateSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ConnectFormData | UpdateFormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: ConnectFormData | UpdateFormData): Promise<void> {
    try {
      setSubmitting(true);

      const endpoint =
        mode === "connect"
          ? `/api/orgs/${orgSlug}/integrations/notion/internal-connect`
          : `/api/orgs/${orgSlug}/integrations/notion/token`;

      const method = mode === "connect" ? "POST" : "PATCH";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || `Failed to ${mode === "connect" ? "connect" : "update token"}`);
        return;
      }

      toast.success(
        mode === "connect"
          ? "Notion internal integration connected successfully"
          : "Notion token updated successfully"
      );

      reset();
      onSuccess();
    } catch (error) {
      console.error(`Error ${mode === "connect" ? "connecting" : "updating token"}:`, error);
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "connect" ? "Connect Notion (Internal)" : "Update Notion Token"}
          </DialogTitle>
          <DialogDescription>
            {mode === "connect"
              ? "Use your Notion Internal Integration token. Ensure the integration has access to required pages and databases."
              : "Rotate your Notion Internal Integration token."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">
              {mode === "connect" ? "Token" : "New Token"} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="token"
              type="password"
              placeholder="Paste your Notion internal integration token"
              {...register("token")}
              disabled={submitting}
            />
            {errors.token && (
              <p className="text-sm text-destructive">{errors.token.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Your Notion internal integration token (starts with secret_).
            </p>
          </div>

          {mode === "connect" && (
            <div className="space-y-2">
              <Label htmlFor="workspaceId">Workspace ID (optional)</Label>
              <Input
                id="workspaceId"
                type="text"
                placeholder="Workspace ID (if needed for your logic)"
                {...register("workspaceId")}
                disabled={submitting}
              />
              {"workspaceId" in errors && errors.workspaceId && (
                <p className="text-sm text-destructive">{errors.workspaceId.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                If you use it in downstream logic, supply the Notion workspace ID.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "connect" ? "Connect" : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
