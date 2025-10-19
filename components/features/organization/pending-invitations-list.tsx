"use client";

import * as React from "react";
import { toast } from "sonner";
import { useInvitations } from "@/hooks/use-invitations";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Props for PendingInvitationsList component
 */
export type PendingInvitationsListProps = {
  /** Organization slug */
  orgSlug: string;
  /** Callback when invitation is resent */
  onResent?: () => void;
  /** Callback when invitation is revoked */
  onRevoked?: () => void;
};

/**
 * Reusable pending invitations list component
 *
 * Displays pending organization invitations with Resend and Revoke actions.
 * Each action shows a confirmation dialog before executing.
 *
 * @example
 * <PendingInvitationsList
 *   orgSlug="acme"
 *   onResent={refetch}
 *   onRevoked={refetch}
 * />
 */
export function PendingInvitationsList({
  orgSlug,
  onResent,
  onRevoked,
}: PendingInvitationsListProps): React.JSX.Element {
  const { items, isLoading, error, refetch } = useInvitations(orgSlug);
  const [resendDialogOpen, setResendDialogOpen] = React.useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = React.useState(false);
  const [selectedInvitation, setSelectedInvitation] = React.useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Show error toast if fetch fails
  React.useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // Handle resend confirmation
  const handleOpenResendDialog = (invitationId: string, email: string) => {
    setSelectedInvitation(invitationId);
    setSelectedEmail(email);
    setResendDialogOpen(true);
  };

  // Handle revoke confirmation
  const handleOpenRevokeDialog = (invitationId: string, email: string) => {
    setSelectedInvitation(invitationId);
    setSelectedEmail(email);
    setRevokeDialogOpen(true);
  };

  // Resend invitation
  async function handleResend(): Promise<void> {
    if (!selectedInvitation) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/invitations/${selectedInvitation}/resend`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to resend invitation");
        setIsSubmitting(false);
        return;
      }

      toast.success("Invitation resent successfully");
      setResendDialogOpen(false);
      setIsSubmitting(false);

      // Refetch invitations
      await refetch();
      if (onResent) {
        onResent();
      }
    } catch (error) {
      console.error("Error resending invitation:", error);
      toast.error("Network error. Please try again.");
      setIsSubmitting(false);
    }
  }

  // Revoke invitation
  async function handleRevoke(): Promise<void> {
    if (!selectedInvitation) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/invitations/${selectedInvitation}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to revoke invitation");
        setIsSubmitting(false);
        return;
      }

      toast.success("Invitation revoked successfully");
      setRevokeDialogOpen(false);
      setIsSubmitting(false);

      // Refetch invitations
      await refetch();
      if (onRevoked) {
        onRevoked();
      }
    } catch (error) {
      console.error("Error revoking invitation:", error);
      toast.error("Network error. Please try again.");
      setIsSubmitting(false);
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>Invitations waiting to be accepted</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading invitations...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate expiry info for each invitation
  const invitationsWithExpiry = items.map((invitation) => {
    const expiresAt = new Date(invitation.expiresAt);
    const now = new Date();
    const daysLeft = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const isExpired = daysLeft <= 0;

    return {
      ...invitation,
      daysLeft,
      isExpired,
    };
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations ({items.length})</CardTitle>
          <CardDescription>Invitations waiting to be accepted</CardDescription>
        </CardHeader>
        <CardContent>
          {invitationsWithExpiry.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No pending invitations</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invitationsWithExpiry.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{invitation.email}</p>
                      <Badge
                        variant={
                          invitation.role === "admin" ? "default" : "secondary"
                        }
                      >
                        {invitation.role}
                      </Badge>
                      {invitation.isExpired && (
                        <Badge variant="destructive">Expired</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Invited by {invitation.invitedBy} •{" "}
                      {invitation.isExpired
                        ? "Expired"
                        : `Expires in ${invitation.daysLeft}d`}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleOpenResendDialog(invitation.id, invitation.email)
                      }
                    >
                      Resend
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        handleOpenRevokeDialog(invitation.id, invitation.email)
                      }
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resend Confirmation Dialog */}
      <Dialog
        open={resendDialogOpen}
        onOpenChange={(isOpen) => {
          setResendDialogOpen(isOpen);
          if (!isOpen) {
            setTimeout(() => {
              document.body.style.pointerEvents = "";
            }, 300);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resend Invitation</DialogTitle>
            <DialogDescription>
              Resend invitation to {selectedEmail}? A new invitation link will
              be generated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResendDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleResend} disabled={isSubmitting}>
              {isSubmitting ? "Resending..." : "Resend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog
        open={revokeDialogOpen}
        onOpenChange={(isOpen) => {
          setRevokeDialogOpen(isOpen);
          if (!isOpen) {
            setTimeout(() => {
              document.body.style.pointerEvents = "";
            }, 300);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Invitation</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke the invitation for {selectedEmail}?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Revoking..." : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
