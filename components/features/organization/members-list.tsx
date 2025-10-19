"use client";

import * as React from "react";
import { toast } from "sonner";
import { useMembers } from "@/hooks/use-members";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InviteMemberDialog } from "@/components/features/admin/invite-member-dialog";
import { EditMemberDialog } from "@/components/features/admin/edit-member-dialog";
import { RemoveMemberButton } from "@/components/features/admin/remove-member-button";

/**
 * Props for MembersList component
 */
export type MembersListProps = {
  /** Organization slug */
  orgSlug: string;
  /** Organization name (for remove confirmation dialog) */
  orgName: string;
  /** Context: admin area or org-level settings */
  context: "admin" | "org";
  /** Whether to exclude superadmins from the list (typically true for org context) */
  excludeSuperadmins?: boolean;
  /** Initial page number (default: 1) */
  initialPage?: number;
  /** Initial page size (default: 20) */
  initialPageSize?: number;
  /** Callback when invite member succeeds */
  onInvited?: () => void;
  /** Callback when edit member succeeds */
  onEdited?: () => void;
  /** Callback when remove member succeeds */
  onRemoved?: () => void;
};

/**
 * Reusable members list component with pagination
 *
 * Displays organization members in a table with Edit and Remove actions.
 * Includes an Invite Member button at the top.
 * Supports pagination with page size selection (10/20/50).
 *
 * @example
 * // Admin context (show all members including superadmins)
 * <MembersList orgSlug="acme" orgName="Acme Inc" context="admin" />
 *
 * @example
 * // Org-level context (exclude superadmins)
 * <MembersList
 *   orgSlug="acme"
 *   orgName="Acme Inc"
 *   context="org"
 *   excludeSuperadmins={true}
 *   onInvited={refetch}
 *   onEdited={refetch}
 *   onRemoved={refetch}
 * />
 */
export function MembersList({
  orgSlug,
  orgName,
  context,
  excludeSuperadmins = false,
  initialPage = 1,
  initialPageSize = 20,
  onInvited,
  onEdited,
  onRemoved,
}: MembersListProps): React.JSX.Element {
  const { data, isLoading, error, refetch, setPage, setPageSize } = useMembers(
    orgSlug,
    {
      page: initialPage,
      pageSize: initialPageSize,
      excludeSuperadmins,
    }
  );

  // Show error toast if fetch fails
  React.useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // Handle invite success
  const handleInvited = React.useCallback(async () => {
    await refetch();
    if (onInvited) {
      onInvited();
    }
  }, [refetch, onInvited]);

  // Handle edit success
  const handleEdited = React.useCallback(async () => {
    await refetch();
    if (onEdited) {
      onEdited();
    }
  }, [refetch, onEdited]);

  // Handle remove success
  const handleRemoved = React.useCallback(async () => {
    await refetch();
    if (onRemoved) {
      onRemoved();
    }
  }, [refetch, onRemoved]);

  // Handle pagination changes
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPage(1); // Reset to first page when changing page size
    setPageSize(newPageSize);
  };

  // Loading state
  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Members</CardTitle>
            <InviteMemberDialog orgSlug={orgSlug} onInvited={handleInvited} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading members...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (data.total === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Members ({data.total})</CardTitle>
            <InviteMemberDialog orgSlug={orgSlug} onInvited={handleInvited} />
          </div>
          <CardDescription>
            {excludeSuperadmins
              ? "Active team members (excluding superadmins)"
              : "Active team members"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-muted-foreground">No members yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Invite users to get started
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentPage = data.page;
  const totalPages = data.totalPages;
  const pageSize = data.pageSize;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Members ({data.total})</CardTitle>
          <InviteMemberDialog orgSlug={orgSlug} onInvited={handleInvited} />
        </div>
        <CardDescription>
          {excludeSuperadmins
            ? "Active team members (excluding superadmins)"
            : "Active team members"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground mb-4">
          Showing {(currentPage - 1) * pageSize + 1}–
          {Math.min(currentPage * pageSize, data.total)} of {data.total}
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
                          onEdited={handleEdited}
                        />
                        <RemoveMemberButton
                          orgSlug={orgSlug}
                          orgName={orgName}
                          userId={member.id}
                          userEmail={member.email}
                          isLastAdmin={isLastAdmin}
                          onRemoved={handleRemoved}
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
            {currentPage > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
              >
                Previous
              </Button>
            )}

            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>

            {currentPage < totalPages && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
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
                handlePageSizeChange(parseInt(value, 10))
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
      </CardContent>
    </Card>
  );
}
