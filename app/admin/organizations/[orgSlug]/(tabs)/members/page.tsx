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
 * Organization Members Tab
 * Client component with client-driven pagination and member management
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
  const [isLoading, setIsLoading] = useState(true);
  const [orgName, setOrgName] = useState<string>("");

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

  // Fetch org name for RemoveMemberButton
  useEffect(() => {
    async function fetchOrgName(): Promise<void> {
      try {
        const response = await fetch(`/api/orgs/${orgSlug}`);
        if (response.ok) {
          const org = await response.json();
          setOrgName(org.name);
        }
      } catch {
        // Silently fail - org name is only for display in RemoveMemberButton
      }
    }

    fetchOrgName();
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
      `/admin/organizations/${orgSlug}/members${search ? `?${search}` : ""}`,
      { scroll: false }
    );
  }

  // Loading state
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Members</h2>
          <InviteMemberDialog orgSlug={orgSlug} />
        </div>
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground">Loading members...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (data.total === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Members</h2>
          <InviteMemberDialog orgSlug={orgSlug} />
        </div>
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground">No members yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Invite users to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Invite button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Members</h2>
        <InviteMemberDialog orgSlug={orgSlug} />
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {(page - 1) * pageSize + 1}–
        {Math.min(page * pageSize, data.total)} of {data.total}
      </div>

      {/* Members table */}
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
      <div className="flex items-center justify-between">
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
    </div>
  );
}
