"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
 * Allows users to accept organization invitations with proper validation
 */

interface InvitationValidation {
  valid: boolean;
  error?: string;
  invitation?: {
    id: string;
    orgId: string;
    orgSlug: string;
    orgName: string;
    email: string;
    role: string;
    expiresAt: string;
  };
  alreadyMember?: boolean;
  userIsSuperadmin?: boolean;
}

export default function InvitePage(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = React.useState(true);
  const [isAccepting, setIsAccepting] = React.useState(false);
  const [validation, setValidation] = React.useState<InvitationValidation | null>(null);

  // Check authentication and validate token
  React.useEffect(() => {
    async function validateInvitation() {
      try {
        if (!token) {
          setValidation({
            valid: false,
            error: "No invitation token provided",
          });
          setIsLoading(false);
          return;
        }

        // Check if user is authenticated by trying to fetch their orgs
        const authResponse = await fetch("/api/orgs");
        const authenticated = authResponse.ok;

        if (!authenticated) {
          // Not signed in - redirect to login with next param
          const loginUrl = `/login?next=${encodeURIComponent(
            `/invite?token=${token}`
          )}`;
          router.push(loginUrl);
          return;
        }

        // Authenticated - validate the token via API
        const validateResponse = await fetch(
          `/api/orgs/invitations/validate?token=${encodeURIComponent(token)}`
        );

        const result: InvitationValidation = await validateResponse.json();

        setValidation(result);
        setIsLoading(false);
      } catch (error) {
        console.error("Error validating invitation:", error);
        setValidation({
          valid: false,
          error: "Failed to validate invitation",
        });
        setIsLoading(false);
      }
    }

    validateInvitation();
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
        setValidation({
          valid: false,
          error: result.error || "Failed to accept invitation",
        });
        return;
      }

      // Success
      toast.success(result.message || "Invitation accepted successfully");

      // Redirect to organization (use slug from response)
      if (result.organization?.slug) {
        setTimeout(() => {
          router.push(`/o/${result.organization.slug}`);
        }, 1000);
      } else {
        // Fallback to home
        setTimeout(() => {
          router.push("/");
        }, 1000);
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsAccepting(false);
    }
  }

  function handleDecline(): void {
    router.push("/");
  }

  // Loading state
  if (isLoading) {
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
  if (!validation?.valid) {
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
              {validation?.error ||
                "This invitation link is invalid or has expired."}
            </p>
            <p className="text-xs text-muted-foreground">
              Having trouble? Ask an admin to resend the invitation.
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

  // Already a member or superadmin
  if (validation.alreadyMember || validation.userIsSuperadmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <CardTitle>You&apos;re already a member</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You already have access to {validation.invitation?.orgName}.
            </p>
            <Button
              onClick={() =>
                router.push(`/o/${validation.invitation?.orgSlug}`)
              }
              className="w-full"
            >
              Go to Dashboard
            </Button>
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
                {validation.invitation?.orgName}
              </span>
            </div>
            {validation.invitation?.role && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Role:</span>
                <span className="font-medium capitalize">
                  {validation.invitation.role}
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
            Having trouble? Ask an admin to resend it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
