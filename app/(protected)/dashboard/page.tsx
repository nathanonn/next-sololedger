import { getCurrentUser } from "@/lib/auth-helpers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Dashboard page
 * Example protected page content
 */

export default async function DashboardPage(): Promise<JSX.Element> {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name || user?.email}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Role:</span>
                <span className="font-medium">{user?.role}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Email Verified:</span>
                <span className="font-medium">
                  {user?.emailVerifiedAt ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Account security status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Password Set:</span>
                <span className="font-medium">
                  {user?.passwordHash ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Session Version:</span>
                <span className="font-medium">{user?.sessionVersion}</span>
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
              <a
                href="/settings/profile"
                className="block text-sm text-primary hover:underline"
              >
                {user?.passwordHash ? "Change Password" : "Set Password"}
              </a>
              <a
                href="/settings/profile"
                className="block text-sm text-primary hover:underline"
              >
                View Profile Settings
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            Your authentication system is fully configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <p>
              This dashboard demonstrates a complete authentication implementation with:
            </p>
            <ul>
              <li>Email OTP authentication with Resend</li>
              <li>JWT sessions with access + refresh token rotation</li>
              <li>Session version tracking for global invalidation</li>
              <li>CSRF protection and rate limiting</li>
              <li>Audit logging for security events</li>
              <li>Dev-mode password signin for testing</li>
            </ul>
            <p>
              Visit the{" "}
              <a
                href="/settings/profile"
                className="text-primary hover:underline"
              >
                Profile Settings
              </a>{" "}
              page to manage your account.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
