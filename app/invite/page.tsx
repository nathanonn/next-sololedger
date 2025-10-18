"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

// Force dynamic rendering since we use searchParams
export const dynamic = "force-dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

/**
 * Invitation accept page
 * Allows users to accept organization invitations
 */

interface InvitationInfo {
  valid: boolean;
  error?: string;
  invitation?: {
    orgName: string;
    email: string;
    role: string;
  };
}

export default function InvitePage(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = React.useState(true);
  const [isAccepting, setIsAccepting] = React.useState(false);
  const [invitationInfo, setInvitationInfo] =
    React.useState<InvitationInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = React.useState<
    boolean | null
  >(null);

  // Check authentication and validate token
  React.useEffect(() => {
    async function checkAuth() {
      try {
        // Check if user is authenticated by trying to fetch their orgs
        const authResponse = await fetch("/api/orgs");
        const authenticated = authResponse.ok;
        setIsAuthenticated(authenticated);

        if (!authenticated) {
          // Not signed in - redirect to login
          const loginUrl = `/login?next=${encodeURIComponent(
            `/invite?token=${token}`
          )}`;
          router.push(loginUrl);
          return;
        }

        // Authenticated - validate the token
        if (!token) {
          setInvitationInfo({
            valid: false,
            error: "No invitation token provided",
          });
          setIsLoading(false);
          return;
        }

        // Note: We'll validate the token when accepting
        // For now, show a generic "ready to accept" message
        setInvitationInfo({
          valid: true,
          invitation: {
            orgName: "an organization",
            email: "",
            role: "member",
          },
        });
        setIsLoading(false);
      } catch (error) {
        console.error("Error checking authentication:", error);
        setInvitationInfo({
          valid: false,
          error: "Failed to validate invitation",
        });
        setIsLoading(false);
      }
    }

    checkAuth();
  }, [token, router]);

  async function handleAccept(): Promise<void> {
    if (!token) return;

    try {
      setIsAccepting(true);

      const response = await fetch("/api/orgs/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to accept invitation");
        setInvitationInfo({
          valid: false,
          error: result.error || "Failed to accept invitation",
        });
        return;
      }

      // Success
      toast.success(result.message || "Invitation accepted successfully");

      // Redirect to organization
      if (result.organization) {
        setTimeout(() => {
          router.push(`/o/${result.organization.slug}/dashboard`);
        }, 1000);
      } else {
        // Fallback to home
        setTimeout(() => {
          router.push("/");
        }, 1000);
      }
    } catch (error) {
      toast.error("Network error. Please try again.");
    } finally {
      setIsAccepting(false);
    }
  }

  function handleDecline(): void {
    router.push("/");
  }

  // Loading state
  if (isLoading || isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Validating invitation...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid invitation
  if (!invitationInfo?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <CardTitle>Invalid Invitation</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {invitationInfo?.error ||
                "This invitation link is invalid or has expired."}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => router.push("/")} className="flex-1">
                Go to Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/login")}
                className="flex-1"
              >
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid invitation - show accept screen
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <CardTitle>You&apos;ve been invited!</CardTitle>
          </div>
          <CardDescription>
            You&apos;ve been invited to join an organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Organization:</span>
              <span className="font-medium">
                {invitationInfo.invitation?.orgName}
              </span>
            </div>
            {invitationInfo.invitation?.role && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Role:</span>
                <span className="font-medium capitalize">
                  {invitationInfo.invitation.role}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleAccept}
              disabled={isAccepting}
              className="flex-1"
            >
              {isAccepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                "Accept & Join"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleDecline}
              disabled={isAccepting}
              className="flex-1"
            >
              Decline
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Having trouble? This invitation may have expired. Ask an admin to
            resend it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
