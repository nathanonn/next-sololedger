"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { toast } from "sonner";

/**
 * Profile settings page
 * Set/change password and sign out
 */

const setPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

type SetPasswordFormData = z.infer<typeof setPasswordSchema>;
type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export default function ProfilePage(): React.JSX.Element {
  const router = useRouter();
  const [user, setUser] = React.useState<{
    email: string;
    role: string;
    emailVerifiedAt: string | null;
    hasPassword: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Fetch user info
  React.useEffect(() => {
    async function fetchUser() {
      try {
        // In a real app, you'd have an API endpoint for this
        // For now, we'll use a placeholder
        setUser({
          email: "user@example.com",
          role: "user",
          emailVerifiedAt: new Date().toISOString(),
          hasPassword: false,
        });
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    }
    fetchUser();
  }, []);

  // Set password form
  const setPasswordForm = useForm<SetPasswordFormData>({
    resolver: zodResolver(setPasswordSchema),
  });

  // Change password form
  const changePasswordForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  async function onSetPassword(data: SetPasswordFormData): Promise<void> {
    try {
      setIsLoading(true);

      const response = await fetch("/api/auth/profile/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to set password");
        return;
      }

      toast.success("Password set successfully");

      setPasswordForm.reset();
      // Refresh user data
      setUser((prev) => (prev ? { ...prev, hasPassword: true } : null));
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function onChangePassword(data: ChangePasswordFormData): Promise<void> {
    try {
      setIsLoading(true);

      const response = await fetch("/api/auth/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to change password");
        return;
      }

      toast.success("Password changed successfully");

      changePasswordForm.reset();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignOut(): Promise<void> {
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      router.replace("/login");
    } catch {
      toast.error("Failed to sign out");
    }
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and security
        </p>
      </div>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <div className="text-sm">{user.email}</div>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <div className="text-sm capitalize">{user.role}</div>
          </div>
          {user.emailVerifiedAt && (
            <div className="space-y-2">
              <Label>Email Verified</Label>
              <div className="text-sm">
                {new Date(user.emailVerifiedAt).toLocaleDateString()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password Management */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            {user.hasPassword
              ? "Change your password"
              : "Set a password for your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!user.hasPassword ? (
            <form
              onSubmit={setPasswordForm.handleSubmit(onSetPassword)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  {...setPasswordForm.register("newPassword")}
                  disabled={isLoading}
                />
                {setPasswordForm.formState.errors.newPassword && (
                  <p className="text-sm text-destructive">
                    {setPasswordForm.formState.errors.newPassword.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters. Use a strong, unique password.
                </p>
              </div>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Setting..." : "Set Password"}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={changePasswordForm.handleSubmit(onChangePassword)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="••••••••"
                  {...changePasswordForm.register("currentPassword")}
                  disabled={isLoading}
                />
                {changePasswordForm.formState.errors.currentPassword && (
                  <p className="text-sm text-destructive">
                    {changePasswordForm.formState.errors.currentPassword.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="changeNewPassword">New Password</Label>
                <Input
                  id="changeNewPassword"
                  type="password"
                  placeholder="••••••••"
                  {...changePasswordForm.register("newPassword")}
                  disabled={isLoading}
                />
                {changePasswordForm.formState.errors.newPassword && (
                  <p className="text-sm text-destructive">
                    {changePasswordForm.formState.errors.newPassword.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters. Use a strong, unique password.
                </p>
              </div>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Changing..." : "Change Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Manage your current session</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleSignOut}>
            Sign Out
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Sign out from this device
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
