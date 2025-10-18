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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

/**
 * Members management page
 * Allows admins to manage team members and invitations
 */

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "member"]),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: string;
  joinedAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  invitedBy: string;
  createdAt: string;
}

export default function MembersPage(): React.JSX.Element {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  const [members, setMembers] = React.useState<Member[]>([]);
  const [invitations, setInvitations] = React.useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<Member | null>(
    null
  );
  const [changeRoleDialogOpen, setChangeRoleDialogOpen] = React.useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = React.useState(false);
  const [newRole, setNewRole] = React.useState<string>("");

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      role: "member",
    },
  });

  // Fetch members and invitations
  const fetchData = React.useCallback(async () => {
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        fetch(`/api/orgs/${orgSlug}/members`),
        fetch(`/api/orgs/${orgSlug}/invitations`),
      ]);

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.members || []);
      }

      if (invitationsRes.ok) {
        const invitationsData = await invitationsRes.json();
        setInvitations(invitationsData.invitations || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, [orgSlug]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function onInvite(data: InviteFormData): Promise<void> {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/orgs/${orgSlug}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to send invitation");
        return;
      }

      toast.success(`Invitation sent to ${data.email}`);
      form.reset();
      fetchData();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleChangeRole(): Promise<void> {
    if (!selectedMember || !newRole) return;

    try {
      setIsLoading(true);

      const response = await fetch(
        `/api/orgs/${orgSlug}/members/${selectedMember.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to change role");
        return;
      }

      toast.success("Role updated successfully");
      setChangeRoleDialogOpen(false);
      setSelectedMember(null);
      fetchData();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRemoveMember(): Promise<void> {
    if (!selectedMember) return;

    try {
      setIsLoading(true);

      const response = await fetch(
        `/api/orgs/${orgSlug}/members/${selectedMember.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to remove member");
        return;
      }

      toast.success("Member removed successfully");
      setRemoveDialogOpen(false);
      setSelectedMember(null);
      fetchData();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendInvitation(invitationId: string): Promise<void> {
    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/invitations/${invitationId}/resend`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to resend invitation");
        return;
      }

      toast.success("Invitation resent successfully");
      fetchData();
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  async function handleRevokeInvitation(invitationId: string): Promise<void> {
    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/invitations/${invitationId}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to revoke invitation");
        return;
      }

      toast.success("Invitation revoked successfully");
      fetchData();
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  function openChangeRoleDialog(member: Member): void {
    setSelectedMember(member);
    setNewRole(member.role);
    setChangeRoleDialogOpen(true);
  }

  function openRemoveDialog(member: Member): void {
    setSelectedMember(member);
    setRemoveDialogOpen(true);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Members & Invitations
        </h1>
        <p className="text-muted-foreground">
          Manage team members and send invitations
        </p>
      </div>

      {/* Invite Form */}
      <Card>
        <CardHeader>
          <CardTitle>Invite Member</CardTitle>
          <CardDescription>
            Send an invitation to join this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onInvite)} className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  {...form.register("email")}
                  disabled={isLoading}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="w-32 space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={form.watch("role")}
                  onValueChange={(value) =>
                    form.setValue("role", value as "admin" | "member")
                  }
                >
                  <SelectTrigger id="role" disabled={isLoading}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Sending..." : "Send Invite"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
          <CardDescription>Active team members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{member.email}</p>
                    <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                      {member.role}
                    </Badge>
                  </div>
                  {member.name && (
                    <p className="text-sm text-muted-foreground">
                      {member.name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openChangeRoleDialog(member)}
                  >
                    Change Role
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openRemoveDialog(member)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}

            {members.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No members yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations ({invitations.length})</CardTitle>
          <CardDescription>Invitations waiting to be accepted</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {invitations.map((invitation) => {
              const expiresAt = new Date(invitation.expiresAt);
              const now = new Date();
              const daysLeft = Math.ceil(
                (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              );

              return (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{invitation.email}</p>
                      <Badge variant={invitation.role === "admin" ? "default" : "secondary"}>
                        {invitation.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Invited by {invitation.invitedBy} •{" "}
                      {daysLeft > 0
                        ? `Expires in ${daysLeft}d`
                        : "Expired"}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResendInvitation(invitation.id)}
                    >
                      Resend
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRevokeInvitation(invitation.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              );
            })}

            {invitations.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No pending invitations
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change Role Dialog */}
      <Dialog open={changeRoleDialogOpen} onOpenChange={setChangeRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Change the role for {selectedMember?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setChangeRoleDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleChangeRole} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedMember?.email} from this
              organization?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
              disabled={isLoading}
            >
              {isLoading ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
