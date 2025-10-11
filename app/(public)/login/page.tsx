"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

/**
 * Login page with Email OTP (default) and Dev Password signin
 * Implements the wireframes from authentication_wireframes.md
 */

const emailSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase(),
});

const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

const devSigninSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase(),
  password: z.string().min(1, "Password required"),
});

type EmailFormData = z.infer<typeof emailSchema>;
type OtpFormData = z.infer<typeof otpSchema>;
type DevSigninFormData = z.infer<typeof devSigninSchema>;

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next") || undefined;

  const [step, setStep] = React.useState<"email" | "code">("email");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [requiresCaptcha, setRequiresCaptcha] = React.useState(false);

  // Check if dev password signin is enabled
  const isDevMode =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ENABLE_DEV_PASSWORD_SIGNIN === "true";

  // Email form
  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  // OTP form
  const otpForm = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
  });

  // Dev signin form
  const devForm = useForm<DevSigninFormData>({
    resolver: zodResolver(devSigninSchema),
  });

  // Request OTP
  async function onRequestOtp(data: EmailFormData): Promise<void> {
    try {
      setIsLoading(true);
      setError("");

      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.requiresCaptcha) {
          setRequiresCaptcha(true);
          setError("Please complete the captcha verification");
        } else {
          setError(result.error || "Failed to send verification code");
        }
        return;
      }

      // Success - advance to code entry
      setEmail(data.email);
      setStep("code");
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // Verify OTP
  async function onVerifyOtp(data: OtpFormData): Promise<void> {
    try {
      setIsLoading(true);
      setError("");

      const payload: { email: string; code: string; next?: string } = {
        email,
        code: data.code,
      };
      if (nextParam) {
        payload.next = nextParam;
      }

      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Invalid verification code");
        return;
      }

      // Success - redirect
      router.replace(result.redirect || "/dashboard");
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // Dev password signin
  async function onDevSignin(data: DevSigninFormData): Promise<void> {
    try {
      setIsLoading(true);
      setError("");

      const payload: { email: string; password: string; next?: string } = {
        email: data.email,
        password: data.password,
      };
      if (nextParam) {
        payload.next = nextParam;
      }

      const response = await fetch("/api/auth/dev-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Invalid credentials");
        return;
      }

      // Success - redirect
      router.replace(result.redirect || "/dashboard");
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome Back</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="otp" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="otp">Email OTP</TabsTrigger>
              {isDevMode && (
                <TabsTrigger value="dev">Password (Dev)</TabsTrigger>
              )}
            </TabsList>

            {/* Email OTP Tab */}
            <TabsContent value="otp" className="space-y-4 mt-4">
              {step === "email" ? (
                <form
                  onSubmit={emailForm.handleSubmit(onRequestOtp)}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      {...emailForm.register("email")}
                      disabled={isLoading}
                    />
                    {emailForm.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {emailForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  {requiresCaptcha && (
                    <div className="text-sm text-muted-foreground">
                      Note: hCaptcha integration pending
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Sending..." : "Send verification code"}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    If your email is allowed, you will receive a 6-digit code.
                  </p>
                </form>
              ) : (
                <form
                  onSubmit={otpForm.handleSubmit(onVerifyOtp)}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label>Verification Code</Label>
                    <p className="text-sm text-muted-foreground">
                      Enter the 6-digit code sent to: {email}
                    </p>
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        {...otpForm.register("code")}
                        onChange={(value) => otpForm.setValue("code", value)}
                        disabled={isLoading}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {otpForm.formState.errors.code && (
                      <p className="text-sm text-destructive text-center">
                        {otpForm.formState.errors.code.message}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setStep("email");
                        setError("");
                        otpForm.reset();
                      }}
                      disabled={isLoading}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={isLoading || otpForm.watch("code")?.length !== 6}
                    >
                      {isLoading ? "Verifying..." : "Verify and sign in"}
                    </Button>
                  </div>
                </form>
              )}

              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  {error}
                </div>
              )}
            </TabsContent>

            {/* Dev Password Tab */}
            {isDevMode && (
              <TabsContent value="dev" className="space-y-4 mt-4">
                <form
                  onSubmit={devForm.handleSubmit(onDevSignin)}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="dev-email">Email</Label>
                    <Input
                      id="dev-email"
                      type="email"
                      placeholder="you@example.com"
                      {...devForm.register("email")}
                      disabled={isLoading}
                    />
                    {devForm.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {devForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dev-password">Password</Label>
                    <Input
                      id="dev-password"
                      type="password"
                      placeholder="••••••••"
                      {...devForm.register("password")}
                      disabled={isLoading}
                    />
                    {devForm.formState.errors.password && (
                      <p className="text-sm text-destructive">
                        {devForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign in"}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Development-only password sign-in
                  </p>
                </form>

                {error && (
                  <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                    {error}
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
