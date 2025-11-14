"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

const financialConfigSchema = z.object({
  baseCurrency: z.string().length(3, "Currency code must be 3 characters"),
  baseCurrencyCustom: z.string().optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
  dateFormat: z.enum(["DD_MM_YYYY", "MM_DD_YYYY", "YYYY_MM_DD"]),
  decimalSeparator: z.enum(["DOT", "COMMA"]),
  thousandsSeparator: z.enum(["COMMA", "DOT", "SPACE", "NONE"]),
});

type FinancialConfigFormData = z.infer<typeof financialConfigSchema>;

const CURRENCIES = [
  { code: "MYR", label: "MYR – Malaysian Ringgit" },
  { code: "USD", label: "USD – US Dollar" },
  { code: "EUR", label: "EUR – Euro" },
  { code: "GBP", label: "GBP – British Pound" },
  { code: "SGD", label: "SGD – Singapore Dollar" },
  { code: "OTHER", label: "Other..." },
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

export default function FinancialConfigPage(): React.JSX.Element {
  const router = useRouter();
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);

  const form = useForm<FinancialConfigFormData>({
    resolver: zodResolver(financialConfigSchema),
    defaultValues: {
      baseCurrency: "MYR",
      baseCurrencyCustom: "",
      fiscalYearStartMonth: 1,
      dateFormat: "YYYY_MM_DD",
      decimalSeparator: "DOT",
      thousandsSeparator: "COMMA",
    },
  });

  const watchBaseCurrency = form.watch("baseCurrency");
  const watchDateFormat = form.watch("dateFormat");
  const watchDecimalSeparator = form.watch("decimalSeparator");
  const watchThousandsSeparator = form.watch("thousandsSeparator");

  // Load organization data
  React.useEffect(() => {
    async function loadOrg() {
      try {
        // Load existing settings using orgSlug
        const settingsResponse = await fetch(
          `/api/orgs/${orgSlug}/settings/financial`
        );

        if (settingsResponse.ok) {
          const data = await settingsResponse.json();

          if (data.settings) {
            const currencyInList = CURRENCIES.some(
              (c) => c.code === data.settings.baseCurrency
            );

            form.reset({
              baseCurrency: currencyInList
                ? data.settings.baseCurrency
                : "OTHER",
              baseCurrencyCustom: currencyInList
                ? ""
                : data.settings.baseCurrency,
              fiscalYearStartMonth: data.settings.fiscalYearStartMonth,
              dateFormat: data.settings.dateFormat,
              decimalSeparator: data.settings.decimalSeparator,
              thousandsSeparator: data.settings.thousandsSeparator,
            });
          }
        } else if (settingsResponse.status === 404) {
          toast.error("Organization not found");
          router.push("/onboarding/create-organization");
          return;
        }
      } catch (error) {
        console.error("Error loading organization:", error);
        toast.error("Failed to load organization");
      } finally {
        setIsInitialLoading(false);
      }
    }

    loadOrg();
  }, [orgSlug, router, form]);

  // Format date preview
  const getDatePreview = (): string => {
    const day = "31";
    const month = "01";
    const year = "2025";

    switch (watchDateFormat) {
      case "DD_MM_YYYY":
        return `${day}/${month}/${year}`;
      case "MM_DD_YYYY":
        return `${month}/${day}/${year}`;
      case "YYYY_MM_DD":
        return `${year}-${month}-${day}`;
      default:
        return "2025-01-31";
    }
  };

  // Format number preview
  const getNumberPreview = (): string => {
    const decimal =
      watchDecimalSeparator === "DOT" ? "." : ",";
    let thousands = "";

    switch (watchThousandsSeparator) {
      case "COMMA":
        thousands = ",";
        break;
      case "DOT":
        thousands = ".";
        break;
      case "SPACE":
        thousands = " ";
        break;
      case "NONE":
        thousands = "";
        break;
    }

    if (thousands) {
      return `1${thousands}234${decimal}56`;
    }
    return `1234${decimal}56`;
  };

  async function onSubmit(data: FinancialConfigFormData): Promise<void> {
    try {
      setIsLoading(true);

      // Determine final currency code
      let finalCurrency = data.baseCurrency;
      if (data.baseCurrency === "OTHER") {
        if (!data.baseCurrencyCustom?.trim()) {
          toast.error("Please enter a currency code");
          return;
        }
        finalCurrency = data.baseCurrencyCustom.trim().toUpperCase();

        if (finalCurrency.length !== 3) {
          toast.error("Currency code must be 3 characters (e.g., EUR, JPY)");
          return;
        }
      }

      // Validate separator combination
      if (
        data.decimalSeparator === "DOT" &&
        data.thousandsSeparator === "DOT"
      ) {
        toast.error("Decimal and thousands separators cannot both be DOT");
        return;
      }

      if (
        data.decimalSeparator === "COMMA" &&
        data.thousandsSeparator === "COMMA"
      ) {
        toast.error("Decimal and thousands separators cannot both be COMMA");
        return;
      }

      const response = await fetch(`/api/orgs/${orgSlug}/settings/financial`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseCurrency: finalCurrency,
          fiscalYearStartMonth: data.fiscalYearStartMonth,
          dateFormat: data.dateFormat,
          decimalSeparator: data.decimalSeparator,
          thousandsSeparator: data.thousandsSeparator,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to update financial configuration");
        return;
      }

      toast.success("Financial configuration saved");

      // Redirect to category setup step
      router.push(`/onboarding/${orgSlug}/categories`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="text-sm text-muted-foreground mb-2">
            Step 3 of 4 – Financial configuration
          </div>
          <CardTitle>Financial configuration</CardTitle>
          <CardDescription>
            Choose your base currency, fiscal year, and formats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Base Currency */}
            <div className="space-y-2">
              <Label htmlFor="baseCurrency">
                Base Currency <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watchBaseCurrency}
                onValueChange={(value) =>
                  form.setValue("baseCurrency", value)
                }
                disabled={isLoading}
              >
                <SelectTrigger id="baseCurrency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Reports and dashboards use this currency
              </p>
            </div>

            {watchBaseCurrency === "OTHER" && (
              <div className="space-y-2">
                <Label htmlFor="baseCurrencyCustom">
                  Enter currency code (ISO 4217){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="baseCurrencyCustom"
                  {...form.register("baseCurrencyCustom")}
                  disabled={isLoading}
                  placeholder="e.g., JPY, AUD, CAD"
                  maxLength={3}
                  className="uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  3-letter ISO currency code
                </p>
              </div>
            )}

            {/* Fiscal Year Start */}
            <div className="space-y-2">
              <Label htmlFor="fiscalYearStartMonth">
                Fiscal year starts in{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={String(form.watch("fiscalYearStartMonth"))}
                onValueChange={(value) =>
                  form.setValue("fiscalYearStartMonth", Number(value))
                }
                disabled={isLoading}
              >
                <SelectTrigger id="fiscalYearStartMonth">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={String(month.value)}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used to calculate YTD and fiscal labels
              </p>
            </div>

            {/* Date Format */}
            <div className="space-y-3">
              <Label>Date format</Label>
              <RadioGroup
                value={watchDateFormat}
                onValueChange={(value) =>
                  form.setValue(
                    "dateFormat",
                    value as FinancialConfigFormData["dateFormat"]
                  )
                }
                disabled={isLoading}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="DD_MM_YYYY" id="dd_mm_yyyy" />
                  <Label htmlFor="dd_mm_yyyy" className="font-normal">
                    DD/MM/YYYY
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="MM_DD_YYYY" id="mm_dd_yyyy" />
                  <Label htmlFor="mm_dd_yyyy" className="font-normal">
                    MM/DD/YYYY
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="YYYY_MM_DD" id="yyyy_mm_dd" />
                  <Label htmlFor="yyyy_mm_dd" className="font-normal">
                    YYYY-MM-DD (default)
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                Preview: {getDatePreview()}
              </p>
            </div>

            {/* Number Format */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-medium">Number format</h3>

              <div className="space-y-2">
                <Label htmlFor="decimalSeparator">Decimal separator</Label>
                <Select
                  value={watchDecimalSeparator}
                  onValueChange={(value) =>
                    form.setValue(
                      "decimalSeparator",
                      value as FinancialConfigFormData["decimalSeparator"]
                    )
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger id="decimalSeparator">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DOT">DOT (.)</SelectItem>
                    <SelectItem value="COMMA">COMMA (,)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="thousandsSeparator">
                  Thousands separator
                </Label>
                <Select
                  value={watchThousandsSeparator}
                  onValueChange={(value) =>
                    form.setValue(
                      "thousandsSeparator",
                      value as FinancialConfigFormData["thousandsSeparator"]
                    )
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger id="thousandsSeparator">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMMA">COMMA (,)</SelectItem>
                    <SelectItem value="DOT">DOT (.)</SelectItem>
                    <SelectItem value="SPACE">SPACE ( )</SelectItem>
                    <SelectItem value="NONE">NONE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-muted-foreground">
                Preview: {getNumberPreview()}
              </p>
            </div>

            <div className="flex gap-3 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/onboarding/${orgSlug}/business`)}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? "Saving..." : "Save & Continue"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center pt-4">
              Owners/Admins can change these later in Business Settings.
              We&apos;ll show a warning before applying changes.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
