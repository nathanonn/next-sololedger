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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Copy, ExternalLink } from "lucide-react";

/**
 * Schema for inviting a member
 */
const inviteMemberSchema = z.object({
  name: z.string().max(255, "Name too long").optional(),
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "member"]),
  sendEmail: z.boolean().optional(),
});

type InviteMemberFormData = z.infer<typeof inviteMemberSchema>;

export type InviteMemberDialogProps = {
  orgSlug: string;
  onInvited?: () => void;
};

/**
 * Dialog for inviting a new member
 */
export function InviteMemberDialog({
  orgSlug,
  onInvited,
}: InviteMemberDialogProps): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const [emailSent, setEmailSent] = React.useState(false);

  const form = useForm<InviteMemberFormData>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "member",
      sendEmail: false,
    },
  });

  async function onSubmit(data: InviteMemberFormData): Promise<void> {
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/orgs/${orgSlug}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          role: data.role,
          ...(data.name && data.name.trim() !== "" && { name: data.name }),
          ...(data.sendEmail && { sendEmail: data.sendEmail }),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to create invitation");
        setIsSubmitting(false);
        return;
      }

      // Show invite URL
      setInviteUrl(result.invitation.inviteUrl);
      setEmailSent(result.invitation.sent || false);

      toast.success("Invitation created successfully");
      router.refresh();
      setIsSubmitting(false);

      // Call onInvited callback
      if (onInvited) {
        onInvited();
      }
    } catch (error) {
      console.error("Error creating invitation:", error);
      toast.error("Network error. Please try again.");
      setIsSubmitting(false);
    }
  }

  function handleCopyUrl(): void {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      toast.success("Invite link copied to clipboard");
    }
  }

  function handleOpenInvite(): void {
    if (inviteUrl) {
      window.open(inviteUrl, "_blank");
    }
  }

  function handleOpenChange(isOpen: boolean): void {
    setOpen(isOpen);
    if (!isOpen) {
      // Restore pointer events after dialog closes
      setTimeout(() => {
        document.body.style.pointerEvents = "";
      }, 300);
      // Reset state
      form.reset();
      setInviteUrl(null);
      setEmailSent(false);
    }
  }

  // If showing invite URL, render success view
  if (inviteUrl) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Invitation Sent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Invitation link:</label>
              <div className="mt-1.5 p-2 bg-muted rounded-md break-all text-sm font-mono">
                {inviteUrl}
              </div>
            </div>
            {emailSent && (
              <div className="text-sm text-muted-foreground">
                ✓ Email sent to {form.getValues("email")}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleCopyUrl} variant="outline" className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
              <Button onClick={handleOpenInvite} variant="outline" className="flex-1">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Invite Page
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4 mr-2" />
        Invite Member
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name (optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="John Doe"
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="user@example.com"
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sendEmail"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Send email invitation (if email provider configured)
                      </FormLabel>
                    </div>
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
                  {isSubmitting ? "Sending..." : "Send Invite"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
