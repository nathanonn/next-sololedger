import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteOrganizationDialog } from "@/components/features/admin/delete-organization-dialog";
import { RoleSelect } from "@/components/features/admin/role-select";
import { RemoveMemberButton } from "@/components/features/admin/remove-member-button";

/**
 * Admin Organization Detail Page
 * Server component showing organization details and members
 */

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
};

export default async function OrganizationDetailPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { orgSlug } = await params;
  const search = await searchParams;

  // Parse and validate pagination params
  const parsedPage = parseInt(search.page || "1", 10);
  const page = parsedPage > 0 && !isNaN(parsedPage) ? parsedPage : 1;

  const parsedPageSize = parseInt(search.pageSize || "20", 10);
  const validPageSizes = [10, 20, 50];
  const effectivePageSize = validPageSizes.includes(parsedPageSize) ? parsedPageSize : 20;

  // Load organization
  const org = await db.organization.findUnique({
    where: { slug: orgSlug },
    include: {
      _count: {
        select: { memberships: true },
      },
    },
  });

  if (!org) {
    notFound();
  }

  // Fetch members with pagination
  const [memberships, total, adminCount] = await Promise.all([
    db.membership.findMany({
      where: { organizationId: org.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * effectivePageSize,
      take: effectivePageSize,
    }),
    db.membership.count({
      where: { organizationId: org.id },
    }),
    db.membership.count({
      where: {
        organizationId: org.id,
        role: "admin",
      },
    }),
  ]);

  const totalPages = Math.ceil(total / effectivePageSize);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/admin/organizations">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Organizations
        </Button>
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{org.name}</h1>
            <p className="text-muted-foreground font-mono text-sm">
              {org.slug}
            </p>
          </div>
          <DeleteOrganizationDialog orgSlug={org.slug} orgName={org.name} />
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Created: {new Date(org.createdAt).toLocaleDateString()}</span>
          <span>•</span>
          <span>Members: {org._count.memberships}</span>
        </div>
      </div>

      {/* Members Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Members</h2>
          <div className="text-sm text-muted-foreground">
            Showing {memberships.length === 0 ? 0 : (page - 1) * effectivePageSize + 1}–
            {Math.min(page * effectivePageSize, total)} of {total}
          </div>
        </div>

        {memberships.length === 0 ? (
          <div className="text-center py-12 border rounded-lg">
            <p className="text-muted-foreground">No members yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Invite users from the organization settings
            </p>
          </div>
        ) : (
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
                {memberships.map((membership) => {
                  const isAdmin = membership.role === "admin";
                  const isLastAdmin = isAdmin && adminCount <= 1;

                  return (
                    <TableRow key={membership.id}>
                      <TableCell className="font-medium">
                        {membership.user.name || (
                          <span className="text-muted-foreground italic">
                            No name
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{membership.user.email}</TableCell>
                      <TableCell>
                        <RoleSelect
                          orgSlug={orgSlug}
                          userId={membership.user.id}
                          currentRole={membership.role}
                          isLastAdmin={isLastAdmin}
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(membership.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <RemoveMemberButton
                          orgSlug={orgSlug}
                          orgName={org.name}
                          userId={membership.user.id}
                          userEmail={membership.user.email}
                          isLastAdmin={isLastAdmin}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {page > 1 && (
              <Link
                href={`/admin/organizations/${orgSlug}?page=${page - 1}&pageSize=${effectivePageSize}`}
              >
                <Button variant="outline" size="sm">
                  Previous
                </Button>
              </Link>
            )}

            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>

            {page < totalPages && (
              <Link
                href={`/admin/organizations/${orgSlug}?page=${page + 1}&pageSize=${effectivePageSize}`}
              >
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
