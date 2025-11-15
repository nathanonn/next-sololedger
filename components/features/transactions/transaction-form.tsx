"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { AlertCircle, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  sortOrder: number;
  parentId: string | null;
  parent?: {
    id: string;
    name: string;
  } | null;
}

interface Account {
  id: string;
  name: string;
  isDefault: boolean;
}

interface Vendor {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

interface OrgSettings {
  baseCurrency: string;
}

interface TransactionData {
  type: "INCOME" | "EXPENSE";
  status: "DRAFT" | "POSTED";
  amountOriginal: number;
  currencyOriginal: string;
  exchangeRateToBase: number;
  date: string;
  description: string;
  categoryId: string;
  accountId: string;
  vendorName?: string;
  notes?: string;
}

interface TransactionFormProps {
  orgSlug: string;
  settings: OrgSettings;
  categories: Category[];
  accounts: Account[];
  initialData?: TransactionData;
  transactionId?: string;
}

const CURRENCIES = [
  { code: "MYR", label: "MYR" },
  { code: "USD", label: "USD" },
  { code: "EUR", label: "EUR" },
  { code: "GBP", label: "GBP" },
  { code: "SGD", label: "SGD" },
  { code: "OTHER", label: "Other..." },
];

export function TransactionForm({
  orgSlug,
  settings,
  categories,
  accounts,
  initialData,
  transactionId,
}: TransactionFormProps): React.JSX.Element {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  // Form state
  const [type, setType] = React.useState<"INCOME" | "EXPENSE">(
    initialData?.type || "INCOME"
  );
  const [status, setStatus] = React.useState<"DRAFT" | "POSTED">(
    initialData?.status || "POSTED"
  );
  const [amountOriginal, setAmountOriginal] = React.useState<string>(
    initialData?.amountOriginal?.toString() || ""
  );
  const [currency, setCurrency] = React.useState<string>(
    initialData?.currencyOriginal || settings.baseCurrency
  );
  const [customCurrency, setCustomCurrency] = React.useState<string>("");
  const [exchangeRate, setExchangeRate] = React.useState<string>(
    initialData?.exchangeRateToBase?.toString() || "1.0"
  );
  const [date, setDate] = React.useState<string>(
    initialData?.date
      ? new Date(initialData.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [description, setDescription] = React.useState<string>(
    initialData?.description || ""
  );
  const [categoryId, setCategoryId] = React.useState<string>(
    initialData?.categoryId || ""
  );
  const [accountId, setAccountId] = React.useState<string>(
    initialData?.accountId || accounts.find((a) => a.isDefault)?.id || ""
  );
  const [vendorName, setVendorName] = React.useState<string>(
    initialData?.vendorName || ""
  );
  const [vendorId, setVendorId] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<string>(initialData?.notes || "");

  // Vendor autocomplete state
  const [vendorSuggestions, setVendorSuggestions] = React.useState<Vendor[]>(
    []
  );
  const [isVendorSearching, setIsVendorSearching] = React.useState(false);
  const [vendorPopoverOpen, setVendorPopoverOpen] = React.useState(false);
  const vendorSearchTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(
    undefined
  );

  // Computed values
  const finalCurrency =
    currency === "OTHER" ? customCurrency.toUpperCase() : currency;
  const isForeignCurrency = finalCurrency !== settings.baseCurrency;
  const amountBase = parseFloat(amountOriginal) * parseFloat(exchangeRate) || 0;

  // Filter and sort categories by type and sortOrder
  const filteredCategories = categories
    .filter((c) => c.type === type)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Helper function to format category display name
  const getCategoryDisplayName = (category: Category): string => {
    if (category.parent) {
      return `${category.parent.name} / ${category.name}`;
    }
    return category.name;
  };

  // Debounced vendor search function
  const searchVendors = React.useCallback(
    (query: string) => {
      if (vendorSearchTimeoutRef.current) {
        clearTimeout(vendorSearchTimeoutRef.current);
      }

      if (!query.trim()) {
        setVendorSuggestions([]);
        setIsVendorSearching(false);
        return;
      }

      setIsVendorSearching(true);

      vendorSearchTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch(
            `/api/orgs/${orgSlug}/vendors?query=${encodeURIComponent(query)}`
          );
          if (response.ok) {
            const data = await response.json();
            setVendorSuggestions(data.vendors || []);
          } else {
            setVendorSuggestions([]);
          }
        } catch (error) {
          console.error("Vendor search error:", error);
          setVendorSuggestions([]);
        } finally {
          setIsVendorSearching(false);
        }
      }, 300); // 300ms debounce
    },
    [orgSlug]
  );

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (vendorSearchTimeoutRef.current) {
        clearTimeout(vendorSearchTimeoutRef.current);
      }
    };
  }, []);

  // Check for future date warning/error
  const selectedDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isFutureDate = selectedDate > today;
  const showDateWarning = status === "DRAFT" && isFutureDate;
  const showDateError = status === "POSTED" && isFutureDate;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (!amountOriginal || parseFloat(amountOriginal) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (currency === "OTHER" && !customCurrency.trim()) {
      toast.error("Please enter a currency code");
      return;
    }

    if (finalCurrency.length !== 3) {
      toast.error("Currency code must be 3 characters");
      return;
    }

    if (!exchangeRate || parseFloat(exchangeRate) <= 0) {
      toast.error("Please enter a valid exchange rate");
      return;
    }

    if (!date) {
      toast.error("Please select a date");
      return;
    }

    if (showDateError) {
      toast.error("Posted transactions cannot have a future date");
      return;
    }

    if (!description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    if (!categoryId) {
      toast.error("Please select a category");
      return;
    }

    if (!accountId) {
      toast.error("Please select an account");
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(
        transactionId
          ? `/api/orgs/${orgSlug}/transactions/${transactionId}`
          : `/api/orgs/${orgSlug}/transactions`,
        {
          method: transactionId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            status,
            amountOriginal: parseFloat(amountOriginal),
            currencyOriginal: finalCurrency,
            exchangeRateToBase: parseFloat(exchangeRate),
            date,
            description,
            categoryId,
            accountId,
            vendorName: vendorName || null,
            vendorId: vendorId || null,
            notes: notes || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to save transaction");
        return;
      }

      toast.success(
        transactionId ? "Transaction updated" : "Transaction created"
      );
      router.push(`/o/${orgSlug}/transactions`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Type */}
      <div className="space-y-3">
        <Label>
          Type <span className="text-destructive">*</span>
        </Label>
        <RadioGroup
          value={type}
          onValueChange={(v) => {
            setType(v as "INCOME" | "EXPENSE");
            setCategoryId(""); // Reset category when type changes
          }}
          className="flex gap-4"
          disabled={isLoading}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="INCOME" id="income" />
            <Label htmlFor="income" className="font-normal">
              Income
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="EXPENSE" id="expense" />
            <Label htmlFor="expense" className="font-normal">
              Expense
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label htmlFor="status">
          Status <span className="text-destructive">*</span>
        </Label>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as "DRAFT" | "POSTED")}
          disabled={isLoading}
        >
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="POSTED">Posted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount">
          Amount <span className="text-destructive">*</span>
        </Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          value={amountOriginal}
          onChange={(e) => setAmountOriginal(e.target.value)}
          placeholder="0.00"
          disabled={isLoading}
        />
      </div>

      {/* Currency */}
      <div className="space-y-2">
        <Label htmlFor="currency">
          Currency <span className="text-destructive">*</span>
        </Label>
        <Select
          value={currency}
          onValueChange={setCurrency}
          disabled={isLoading}
        >
          <SelectTrigger id="currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Base currency: {settings.baseCurrency}
        </p>
      </div>

      {currency === "OTHER" && (
        <div className="space-y-2">
          <Label htmlFor="customCurrency">
            Currency Code <span className="text-destructive">*</span>
          </Label>
          <Input
            id="customCurrency"
            value={customCurrency}
            onChange={(e) => setCustomCurrency(e.target.value.toUpperCase())}
            placeholder="e.g., JPY, AUD"
            maxLength={3}
            className="uppercase"
            disabled={isLoading}
          />
        </div>
      )}

      {/* Exchange Rate */}
      {isForeignCurrency && (
        <div className="space-y-2">
          <Label htmlFor="exchangeRate">
            Exchange Rate to {settings.baseCurrency}{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="exchangeRate"
            type="number"
            step="0.00000001"
            value={exchangeRate}
            onChange={(e) => setExchangeRate(e.target.value)}
            placeholder="1.00000000"
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            Base amount: {settings.baseCurrency} {amountBase.toFixed(2)}
          </p>
        </div>
      )}

      {/* Date */}
      <div className="space-y-2">
        <Label htmlFor="date">
          Date <span className="text-destructive">*</span>
        </Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={isLoading}
        />
        {showDateWarning && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Warning: This is a future date</AlertDescription>
          </Alert>
        )}
        {showDateError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Posted transactions cannot have a future date
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">
          Description <span className="text-destructive">*</span>
        </Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Client invoice #123"
          disabled={isLoading}
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category">
          Category <span className="text-destructive">*</span>
        </Label>
        <Select
          value={categoryId}
          onValueChange={setCategoryId}
          disabled={isLoading}
        >
          <SelectTrigger id="category">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {filteredCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {getCategoryDisplayName(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filteredCategories.length === 0 && (
          <p className="text-xs text-destructive">
            No {type.toLowerCase()} categories available
          </p>
        )}
      </div>

      {/* Account */}
      <div className="space-y-2">
        <Label htmlFor="account">
          Account <span className="text-destructive">*</span>
        </Label>
        <Select
          value={accountId}
          onValueChange={setAccountId}
          disabled={isLoading}
        >
          <SelectTrigger id="account">
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
                {a.isDefault && " (Default)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Vendor Name with Autocomplete */}
      <div className="space-y-2">
        <Label htmlFor="vendorName">Vendor Name (optional)</Label>
        <Popover open={vendorPopoverOpen} onOpenChange={setVendorPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={vendorPopoverOpen}
              className="w-full justify-between font-normal"
              disabled={isLoading}
            >
              {vendorName || "Select or type vendor name..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search vendors..."
                value={vendorName}
                onValueChange={(value) => {
                  setVendorName(value);
                  searchVendors(value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && vendorSuggestions.length === 0) {
                    e.preventDefault();
                    setVendorPopoverOpen(false);
                  }
                }}
              />
              <CommandList>
                {isVendorSearching && <CommandEmpty>Searching...</CommandEmpty>}
                {!isVendorSearching &&
                  vendorName &&
                  vendorSuggestions.length === 0 && (
                    <CommandEmpty className="text-muted-foreground p-4 text-sm">
                      No vendors found.
                      <br />
                      Press Enter to create &quot;{vendorName}&quot;
                    </CommandEmpty>
                  )}
                {vendorSuggestions.length > 0 && (
                  <CommandGroup>
                    {vendorSuggestions.map((vendor) => (
                      <CommandItem
                        key={vendor.id}
                        value={vendor.id}
                        onSelect={() => {
                          setVendorName(vendor.name);
                          setVendorId(vendor.id);
                          setVendorPopoverOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            vendorId === vendor.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span>{vendor.name}</span>
                          {(vendor.email || vendor.phone) && (
                            <span className="text-xs text-muted-foreground">
                              {vendor.email || vendor.phone}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">
          Select an existing vendor or type a new name to create one
          automatically
        </p>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes..."
          rows={3}
          disabled={isLoading}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/o/${orgSlug}/transactions`)}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? "Saving..." : transactionId ? "Update" : "Create"}{" "}
          Transaction
        </Button>
      </div>
    </form>
  );
}
