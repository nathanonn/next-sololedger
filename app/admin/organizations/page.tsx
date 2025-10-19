import { db } from "@/lib/db";
import { env } from "@/lib/env";
import Link from "next/link";
import { Eye, Users } from "lucide-react";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { OrganizationsFilters } from "@/components/features/admin/organizations-filters";
import { CreateOrganizationButton } from "@/components/features/admin/create-organization-button";

/**
 * Admin Organizations List Page
 * Server component with search, sort, and pagination
 */

type SearchParams = {
  page?: string;
  pageSize?: string;
  q?: string;
  sort?: string;
  dir?: string;
};

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;

  // Parse and validate search params
  const parsedPage = parseInt(params.page || "1", 10);
  const page = parsedPage > 0 && !isNaN(parsedPage) ? parsedPage : 1;

  const parsedPageSize = parseInt(params.pageSize || "20", 10);
  const validPageSizes = [10, 20, 50];
  const effectivePageSize = validPageSizes.includes(parsedPageSize) ? parsedPageSize : 20;

  const q = params.q || "";
  const sort = params.sort || "createdAt";
  const dir = params.dir || "desc";

  // Build where clause for search
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { slug: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  // Build orderBy clause
  const orderBy =
    sort === "name"
      ? { name: dir as "asc" | "desc" }
      : { createdAt: dir as "asc" | "desc" };

  // Fetch organizations with member counts
  const [organizations, total] = await Promise.all([
    db.organization.findMany({
      where,
      include: {
        _count: {
          select: { memberships: true },
        },
      },
      orderBy,
      skip: (page - 1) * effectivePageSize,
      take: effectivePageSize,
    }),
    db.organization.count({ where }),
  ]);

  const totalPages = Math.ceil(total / effectivePageSize);

  // Build query string helper
  function buildQueryString(updates: Partial<SearchParams>): string {
    const newParams = new URLSearchParams();
    const merged = { ...params, ...updates };

    if (merged.page && merged.page !== "1") newParams.set("page", merged.page);
    if (merged.pageSize && merged.pageSize !== "20")
      newParams.set("pageSize", merged.pageSize);
    if (merged.q) newParams.set("q", merged.q);
    if (merged.sort && merged.sort !== "createdAt")
      newParams.set("sort", merged.sort);
    if (merged.dir && merged.dir !== "desc") newParams.set("dir", merged.dir);

    return newParams.toString() ? `?${newParams.toString()}` : "";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Organizations</h1>
          <p className="text-muted-foreground">
            View and manage all organizations in the system
          </p>
        </div>
        <CreateOrganizationButton appUrl={env.APP_URL} />
      </div>

      {/* Search and Filters */}
      <OrganizationsFilters />

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {organizations.length === 0 ? 0 : (page - 1) * effectivePageSize + 1}–
        {Math.min(page * effectivePageSize, total)} of {total} organizations
      </div>

      {/* Table */}
      {organizations.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground">No organizations found</p>
          {q && <p className="text-sm text-muted-foreground mt-1">Try adjusting your search</p>}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {org.slug}
                  </TableCell>
                  <TableCell className="text-right">
                    {org._count.memberships}
                  </TableCell>
                  <TableCell>
                    {new Date(org.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/organizations/${org.slug}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </Link>
                      <Link href={`/admin/organizations/${org.slug}/members`}>
                        <Button variant="ghost" size="sm">
                          <Users className="h-4 w-4 mr-2" />
                          View members
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            {page > 1 && (
              <PaginationItem>
                <PaginationPrevious
                  href={`/admin/organizations${buildQueryString({ page: (page - 1).toString() })}`}
                />
              </PaginationItem>
            )}

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }

              return (
                <PaginationItem key={pageNum}>
                  <PaginationLink
                    href={`/admin/organizations${buildQueryString({ page: pageNum.toString() })}`}
                    isActive={pageNum === page}
                  >
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              );
            })}

            {page < totalPages && (
              <PaginationItem>
                <PaginationNext
                  href={`/admin/organizations${buildQueryString({ page: (page + 1).toString() })}`}
                />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
