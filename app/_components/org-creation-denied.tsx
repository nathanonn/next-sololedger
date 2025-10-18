"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Page shown when authenticated user has no orgs and cannot create
 */

export function OrgCreationDenied(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const noticeParam = searchParams.get("notice");

  // Show toast on mount if notice param present
  React.useEffect(() => {
    if (noticeParam === "org_creation_disabled") {
      toast.error("Organization creation is disabled. You must be invited to join an organization.");
    }
  }, [noticeParam]);

  async function handleSignOut(): Promise<void> {
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      router.replace("/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>No Organizations</CardTitle>
          <CardDescription>
            You don't have access to any organizations yet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Organization creation is currently disabled. Please contact an administrator to receive
            an invitation to join an organization.
          </p>

          <div className="flex gap-2">
            <Button onClick={handleSignOut} variant="outline" className="flex-1">
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
