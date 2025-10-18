import { getCurrentUser } from "@/lib/auth-helpers";
import { getOrgBySlug, getUserMembership } from "@/lib/org-helpers";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Organization Dashboard page
 * Shows organization-specific dashboard content
 */

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<JSX.Element> {
  const { orgSlug } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    redirect("/");
  }

  const membership = await getUserMembership(user.id, org.id);
  if (!membership) {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to {org.name}, {user.name || user.email}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>Current workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{org.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Slug:</span>
                <span className="font-mono text-xs">{org.slug}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your Role:</span>
                <span className="font-medium capitalize">{membership.role}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{user.email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Email Verified:</span>
                <span className="font-medium">
                  {user.emailVerifiedAt ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Password Set:</span>
                <span className="font-medium">
                  {user.passwordHash ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {membership.role === "admin" && (
                <a
                  href={`/o/${orgSlug}/settings/members`}
                  className="block text-sm text-primary hover:underline"
                >
                  Manage Members
                </a>
              )}
              <a
                href={`/o/${orgSlug}/settings/profile`}
                className="block text-sm text-primary hover:underline"
              >
                {user.passwordHash ? "Change Password" : "Set Password"}
              </a>
              {membership.role === "admin" && (
                <a
                  href={`/o/${orgSlug}/settings/organization`}
                  className="block text-sm text-primary hover:underline"
                >
                  Organization Settings
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Multi-Tenant Features</CardTitle>
          <CardDescription>
            Your app now supports multiple organizations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <p>
              This dashboard is now organization-scoped. Key features include:
            </p>
            <ul>
              <li>Organization-based access control with memberships</li>
              <li>Role-based permissions (admin/member)</li>
              <li>Invitation system with email-based invites</li>
              <li>Organization switcher for users in multiple workspaces</li>
              <li>Isolated data per organization</li>
              <li>Audit logging with org context</li>
            </ul>
            {membership.role === "admin" && (
              <p>
                As an admin, you can{" "}
                <a
                  href={`/o/${orgSlug}/settings/members`}
                  className="text-primary hover:underline"
                >
                  manage members and invitations
                </a>
                .
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
