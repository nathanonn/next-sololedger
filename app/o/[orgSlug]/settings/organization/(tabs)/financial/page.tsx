"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Info, Loader2, AlertTriangle } from "lucide-react";
import { useFinancialSettings } from "@/hooks/use-financial-settings";

const financialSettingsSchema = z.object({
  baseCurrency: z.string().length(3),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
  dateFormat: z.enum(["DD_MM_YYYY", "MM_DD_YYYY", "YYYY_MM_DD"]),
  decimalSeparator: z.enum(["DOT", "COMMA"]),
  thousandsSeparator: z.enum(["COMMA", "DOT", "SPACE", "NONE"]),
});

type FinancialSettingsFormData = z.infer<typeof financialSettingsSchema>;

// Common currencies
const CURRENCIES = [
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "INR", name: "Indian Rupee" },
];

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export default function FinancialSettingsPage(): React.JSX.Element {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [userRole, setUserRole] = React.useState<"admin" | "member" | null>(null);

  // Base currency change dialog
  const [currencyDialogOpen, setCurrencyDialogOpen] = React.useState(false);
  const [newCurrency, setNewCurrency] = React.useState("");
  const [confirmationText, setConfirmationText] = React.useState("");
  const [confirmCheckbox, setConfirmCheckbox] = React.useState(false);

  const { data: settingsData, isLoading, error, refetch } = useFinancialSettings(orgSlug);

  const form = useForm<FinancialSettingsFormData>({
    resolver: zodResolver(financialSettingsSchema),
    defaultValues: {
      baseCurrency: "MYR",
      fiscalYearStartMonth: 1,
      dateFormat: "YYYY_MM_DD",
      decimalSeparator: "DOT",
      thousandsSeparator: "COMMA",
    },
  });

  // Load settings data into form
  React.useEffect(() => {
    if (settingsData?.settings) {
      form.reset({
        baseCurrency: settingsData.settings.baseCurrency,
        fiscalYearStartMonth: settingsData.settings.fiscalYearStartMonth,
        dateFormat: settingsData.settings.dateFormat,
        decimalSeparator: settingsData.settings.decimalSeparator,
        thousandsSeparator: settingsData.settings.thousandsSeparator,
      });
    }
  }, [settingsData, form]);

  // Determine user role
  React.useEffect(() => {
    async function checkRole() {
      try {
        const response = await fetch(`/api/orgs/${orgSlug}/members?page=1&pageSize=1`);
        if (response.ok) {
          setUserRole("admin");
        } else if (response.status === 403) {
          setUserRole("member");
        }
      } catch {
        setUserRole("member");
      }
    }
    checkRole();
  }, [orgSlug]);

  const watchDecimalSeparator = form.watch("decimalSeparator");
  const watchThousandsSeparator = form.watch("thousandsSeparator");

  async function onSubmit(data: FinancialSettingsFormData) {
    if (userRole === "member") {
      toast.error("You don't have permission to edit financial settings");
      return;
    }

    // Validate separator combination
    if (data.decimalSeparator === "DOT" && data.thousandsSeparator === "DOT") {
      toast.error("Decimal and thousands separators cannot both be DOT");
      return;
    }
    if (data.decimalSeparator === "COMMA" && data.thousandsSeparator === "COMMA") {
      toast.error("Decimal and thousands separators cannot both be COMMA");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/orgs/${orgSlug}/settings/financial`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to update financial settings");
        return;
      }

      toast.success("Financial settings updated successfully");
      refetch();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openCurrencyDialog() {
    const currentCurrency = form.getValues("baseCurrency");
    setNewCurrency(currentCurrency);
    setConfirmationText("");
    setConfirmCheckbox(false);
    setCurrencyDialogOpen(true);
  }

  async function handleCurrencyChange() {
    if (!confirmCheckbox) {
      toast.error("Please confirm that you understand the implications");
      return;
    }

    if (confirmationText.toUpperCase() !== "CHANGE") {
      toast.error('Please type "CHANGE" to confirm');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/orgs/${orgSlug}/settings/financial`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseCurrency: newCurrency,
          fiscalYearStartMonth: form.getValues("fiscalYearStartMonth"),
          dateFormat: form.getValues("dateFormat"),
          decimalSeparator: form.getValues("decimalSeparator"),
          thousandsSeparator: form.getValues("thousandsSeparator"),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to change base currency");
        return;
      }

      toast.success("Base currency changed successfully");
      setCurrencyDialogOpen(false);
      refetch();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const isAdmin = userRole === "admin";
  const isMember = userRole === "member";
  const currentCurrency = form.watch("baseCurrency");
  const currencyDisplay = CURRENCIES.find((c) => c.code === currentCurrency);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Financial Settings</CardTitle>
          <CardDescription>
            Configure financial reporting preferences and base currency
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isMember && (
            <Alert className="mb-6">
              <Info className="h-4 w-4" />
              <AlertDescription>
                You are viewing financial settings in read-only mode. Only administrators can make changes.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Base Currency Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Base Currency</h3>
                <p className="text-sm text-muted-foreground">
                  The primary currency for financial reporting and analysis
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div>
                  <div className="font-medium">
                    Current Base Currency: {currentCurrency}
                  </div>
                  {currencyDisplay && (
                    <div className="text-sm text-muted-foreground">
                      {currencyDisplay.name}
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openCurrencyDialog}
                    disabled={isSubmitting}
                  >
                    Change Currency
                  </Button>
                )}
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Changing the base currency does not automatically recalculate historical transaction amounts.
                  Existing transactions will retain their original base amounts.
                </AlertDescription>
              </Alert>
            </div>

            {/* Fiscal Year */}
            <div className="space-y-2">
              <Label htmlFor="fiscalYearStartMonth">Fiscal Year Start Month</Label>
              <Select
                value={form.watch("fiscalYearStartMonth").toString()}
                onValueChange={(value) =>
                  form.setValue("fiscalYearStartMonth", parseInt(value))
                }
                disabled={!isAdmin || isSubmitting}
              >
                <SelectTrigger id="fiscalYearStartMonth">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Month when your fiscal year begins (e.g., January for calendar year)
              </p>
            </div>

            {/* Date Format */}
            <div className="space-y-2">
              <Label htmlFor="dateFormat">Date Format</Label>
              <Select
                value={form.watch("dateFormat")}
                onValueChange={(value) =>
                  form.setValue("dateFormat", value as FinancialSettingsFormData["dateFormat"])
                }
                disabled={!isAdmin || isSubmitting}
              >
                <SelectTrigger id="dateFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD_MM_YYYY">DD/MM/YYYY (31/12/2025)</SelectItem>
                  <SelectItem value="MM_DD_YYYY">MM/DD/YYYY (12/31/2025)</SelectItem>
                  <SelectItem value="YYYY_MM_DD">YYYY-MM-DD (2025-12-31)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Number Formatting */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Number Formatting</h3>
                <p className="text-sm text-muted-foreground">
                  Configure how numbers are displayed
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="decimalSeparator">Decimal Separator</Label>
                <Select
                  value={form.watch("decimalSeparator")}
                  onValueChange={(value) =>
                    form.setValue("decimalSeparator", value as FinancialSettingsFormData["decimalSeparator"])
                  }
                  disabled={!isAdmin || isSubmitting}
                >
                  <SelectTrigger id="decimalSeparator">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DOT">Dot (1234.56)</SelectItem>
                    <SelectItem value="COMMA">Comma (1234,56)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="thousandsSeparator">Thousands Separator</Label>
                <Select
                  value={form.watch("thousandsSeparator")}
                  onValueChange={(value) =>
                    form.setValue("thousandsSeparator", value as FinancialSettingsFormData["thousandsSeparator"])
                  }
                  disabled={!isAdmin || isSubmitting}
                >
                  <SelectTrigger id="thousandsSeparator">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMMA">Comma (1,234,567)</SelectItem>
                    <SelectItem value="DOT">Dot (1.234.567)</SelectItem>
                    <SelectItem value="SPACE">Space (1 234 567)</SelectItem>
                    <SelectItem value="NONE">None (1234567)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preview */}
              <div className="p-3 border rounded-lg bg-muted/50">
                <div className="text-sm font-medium mb-1">Preview</div>
                <div className="text-sm text-muted-foreground">
                  {watchDecimalSeparator === "DOT"
                    ? `1${watchThousandsSeparator === "COMMA" ? "," : watchThousandsSeparator === "DOT" ? "." : watchThousandsSeparator === "SPACE" ? " " : ""}234${watchThousandsSeparator === "COMMA" ? "," : watchThousandsSeparator === "DOT" ? "." : watchThousandsSeparator === "SPACE" ? " " : ""}567.89`
                    : `1${watchThousandsSeparator === "COMMA" ? "," : watchThousandsSeparator === "DOT" ? "." : watchThousandsSeparator === "SPACE" ? " " : ""}234${watchThousandsSeparator === "COMMA" ? "," : watchThousandsSeparator === "DOT" ? "." : watchThousandsSeparator === "SPACE" ? " " : ""}567,89`
                  }
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Change Base Currency Dialog */}
      <Dialog open={currencyDialogOpen} onOpenChange={setCurrencyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Change Base Currency
            </DialogTitle>
            <DialogDescription>
              This is a critical change that affects all financial reporting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <div className="font-medium">Important Warnings:</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>This does NOT recalculate historical transaction amounts</li>
                  <li>Existing transactions retain their original base amounts</li>
                  <li>Historical comparisons may be less meaningful</li>
                  <li>Reports will use the new currency going forward</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="newCurrency">New Base Currency</Label>
              <Select value={newCurrency} onValueChange={setNewCurrency} disabled={isSubmitting}>
                <SelectTrigger id="newCurrency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="confirmCheckbox"
                checked={confirmCheckbox}
                onCheckedChange={(checked) => setConfirmCheckbox(checked as boolean)}
                disabled={isSubmitting}
              />
              <Label htmlFor="confirmCheckbox" className="text-sm font-normal leading-tight cursor-pointer">
                I understand that this change does not recalculate existing transactions and
                may affect the accuracy of historical financial reports.
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmationText">
                Type <strong>CHANGE</strong> to confirm
              </Label>
              <Input
                id="confirmationText"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="Type CHANGE"
                disabled={isSubmitting}
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCurrencyDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCurrencyChange}
                disabled={isSubmitting || !confirmCheckbox || confirmationText.toUpperCase() !== "CHANGE"}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Changing...
                  </>
                ) : (
                  "Change Base Currency"
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
