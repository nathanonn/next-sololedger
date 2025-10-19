"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EditMemberDialog } from "@/components/features/admin/edit-member-dialog";
import { RemoveMemberButton } from "@/components/features/admin/remove-member-button";
import { InviteMemberDialog } from "@/components/features/admin/invite-member-dialog";

/**
 * Organization Members Tab
 * Client component with members table, pagination, and invitations
 */

type Member = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  joinedAt: string;
};

type MembersResponse = {
  members: Member[];
  total: number;
  adminCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  invitedBy: string;
  createdAt: string;
};

export default function OrganizationMembersPage(): React.JSX.Element {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;

  // Pagination state from URL
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

  // Data state
  const [data, setData] = useState<MembersResponse | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [orgName, setOrgName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch members
  useEffect(() => {
    async function fetchMembers(): Promise<void> {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/orgs/${orgSlug}/members?page=${page}&pageSize=${pageSize}`
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch members");
        }

        const membersData = await response.json();
        setData(membersData);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load members"
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchMembers();
  }, [orgSlug, page, pageSize]);

  // Fetch org name and invitations
  useEffect(() => {
    async function fetchOrgAndInvitations(): Promise<void> {
      try {
        const [orgRes, invitationsRes] = await Promise.all([
          fetch(`/api/orgs/${orgSlug}`),
          fetch(`/api/orgs/${orgSlug}/invitations`),
        ]);

        if (orgRes.ok) {
          const org = await orgRes.json();
          setOrgName(org.name);
        }

        if (invitationsRes.ok) {
          const invitationsData = await invitationsRes.json();
          setInvitations(invitationsData.invitations || []);
        }
      } catch {
        // Silently fail - these are secondary data
      }
    }

    fetchOrgAndInvitations();
  }, [orgSlug]);

  // Update URL when pagination changes
  function updatePagination(updates: { page?: number; pageSize?: number }): void {
    const newParams = new URLSearchParams();
    const newPage = updates.page !== undefined ? updates.page : page;
    const newPageSize = updates.pageSize !== undefined ? updates.pageSize : pageSize;

    if (newPage !== 1) newParams.set("page", newPage.toString());
    if (newPageSize !== 20) newParams.set("pageSize", newPageSize.toString());

    const search = newParams.toString();
    router.push(
      `/o/${orgSlug}/settings/organization/members${search ? `?${search}` : ""}`,
      { scroll: false }
    );
  }

  // Resend invitation
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

      // Refresh invitations
      const invitationsRes = await fetch(`/api/orgs/${orgSlug}/invitations`);
      if (invitationsRes.ok) {
        const invitationsData = await invitationsRes.json();
        setInvitations(invitationsData.invitations || []);
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  // Revoke invitation
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

      // Refresh invitations
      const invitationsRes = await fetch(`/api/orgs/${orgSlug}/invitations`);
      if (invitationsRes.ok) {
        const invitationsData = await invitationsRes.json();
        setInvitations(invitationsData.invitations || []);
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  // Loading state
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground">Loading members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invite Member Dialog */}
      <div>
        <InviteMemberDialog orgSlug={orgSlug} />
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({data.total})</CardTitle>
          <CardDescription>Active team members</CardDescription>
        </CardHeader>
        <CardContent>
          {data.total === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No members yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Invite users to get started
              </p>
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground mb-4">
                Showing {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, data.total)} of {data.total}
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.members.map((member) => {
                      const isAdmin = member.role === "admin";
                      const isLastAdmin = isAdmin && data.adminCount <= 1;

                      return (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">
                            {member.name || (
                              <span className="text-muted-foreground italic">
                                No name
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{member.email}</TableCell>
                          <TableCell>
                            <span className="capitalize">{member.role}</span>
                          </TableCell>
                          <TableCell>
                            {new Date(member.joinedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <EditMemberDialog
                                orgSlug={orgSlug}
                                userId={member.id}
                                email={member.email}
                                initialName={member.name}
                                initialRole={member.role}
                                isLastAdmin={isLastAdmin}
                              />
                              <RemoveMemberButton
                                orgSlug={orgSlug}
                                orgName={orgName}
                                userId={member.id}
                                userEmail={member.email}
                                isLastAdmin={isLastAdmin}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination controls */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  {page > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updatePagination({ page: page - 1 })}
                    >
                      Previous
                    </Button>
                  )}

                  <span className="text-sm text-muted-foreground">
                    Page {page} of {data.totalPages}
                  </span>

                  {page < data.totalPages && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updatePagination({ page: page + 1 })}
                    >
                      Next
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Page size:</span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) =>
                      updatePagination({ page: 1, pageSize: parseInt(value, 10) })
                    }
                  >
                    <SelectTrigger className="w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
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
    </div>
  );
}
