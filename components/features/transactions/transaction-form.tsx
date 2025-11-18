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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertCircle, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ISO_CURRENCIES, COMMON_CURRENCIES, isValidCurrencyCode } from "@/lib/currencies";

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

interface Client {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

interface OrgSettings {
  baseCurrency: string;
  softClosedBefore?: string | null;
}

interface TransactionData {
  type: "INCOME" | "EXPENSE";
  status: "DRAFT" | "POSTED";
  amountBase: number;
  // Note: currencyBase is NOT a user input - always org's baseCurrency
  amountSecondary?: number | null;
  currencySecondary?: string | null;
  date: string;
  description: string;
  categoryId: string;
  accountId: string;
  vendorName?: string;
  clientName?: string;
  notes?: string;
}

interface TransactionFormProps {
  orgSlug: string;
  settings: OrgSettings;
  categories: Category[];
  accounts: Account[];
  initialData?: TransactionData;
  transactionId?: string;
  softClosedBefore?: string | null;
}

export function TransactionForm({
  orgSlug,
  settings,
  categories,
  accounts,
  initialData,
  transactionId,
  softClosedBefore,
}: TransactionFormProps): React.JSX.Element {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [showSoftClosedConfirm, setShowSoftClosedConfirm] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  // Form state - dual-currency model
  const [type, setType] = React.useState<"INCOME" | "EXPENSE">(
    initialData?.type || "INCOME"
  );
  const [status, setStatus] = React.useState<"DRAFT" | "POSTED">(
    initialData?.status || "POSTED"
  );
  const [amountBase, setAmountBase] = React.useState<string>(
    initialData?.amountBase?.toString() || ""
  );
  // Note: currencyBase is NOT a form field - always use org's baseCurrency
  const [amountSecondary, setAmountSecondary] = React.useState<string>(
    initialData?.amountSecondary?.toString() || ""
  );
  const [currencySecondary, setCurrencySecondary] = React.useState<string>(
    initialData?.currencySecondary || ""
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
  const [clientName, setClientName] = React.useState<string>(
    initialData?.clientName || ""
  );
  const [clientId, setClientId] = React.useState<string | null>(null);
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

  // Client autocomplete state
  const [clientSuggestions, setClientSuggestions] = React.useState<Client[]>(
    []
  );
  const [isClientSearching, setIsClientSearching] = React.useState(false);
  const [clientPopoverOpen, setClientPopoverOpen] = React.useState(false);
  const clientSearchTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(
    undefined
  );

  // Computed values for dual-currency model
  const isDualCurrency = !!(amountSecondary && currencySecondary);
  const calculatedExchangeRate =
    isDualCurrency && parseFloat(amountBase) > 0 && parseFloat(amountSecondary) > 0
      ? (parseFloat(amountBase) / parseFloat(amountSecondary)).toFixed(8)
      : null;

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

  // Debounced client search function
  const searchClients = React.useCallback(
    (query: string) => {
      if (clientSearchTimeoutRef.current) {
        clearTimeout(clientSearchTimeoutRef.current);
      }

      if (!query.trim()) {
        setClientSuggestions([]);
        setIsClientSearching(false);
        return;
      }

      setIsClientSearching(true);

      clientSearchTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch(
            `/api/orgs/${orgSlug}/clients?query=${encodeURIComponent(query)}`
          );
          if (response.ok) {
            const data = await response.json();
            setClientSuggestions(data.clients || []);
          } else {
            setClientSuggestions([]);
          }
        } catch (error) {
          console.error("Client search error:", error);
          setClientSuggestions([]);
        } finally {
          setIsClientSearching(false);
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
      if (clientSearchTimeoutRef.current) {
        clearTimeout(clientSearchTimeoutRef.current);
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

  // Check if transaction is in soft-closed period (for edits only)
  const isInSoftClosedPeriod =
    transactionId &&
    initialData?.status === "POSTED" &&
    softClosedBefore &&
    new Date(initialData.date) < new Date(softClosedBefore);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation - dual-currency model
    if (!amountBase || parseFloat(amountBase) <= 0) {
      toast.error("Please enter a valid base amount");
      return;
    }

    // Validate secondary currency fields
    const hasSecondaryAmount = amountSecondary && parseFloat(amountSecondary) > 0;
    const hasSecondaryCurrency = currencySecondary && currencySecondary.trim();

    if (hasSecondaryAmount !== !!hasSecondaryCurrency) {
      toast.error("Please provide both secondary amount and currency, or neither");
      return;
    }

    if (currencySecondary && currencySecondary.length !== 3) {
      toast.error("Secondary currency code must be 3 characters");
      return;
    }

    if (currencySecondary && !isValidCurrencyCode(currencySecondary)) {
      toast.error("Invalid secondary currency code");
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

    // Check if editing a POSTED transaction in soft-closed period
    if (isInSoftClosedPeriod && !showSoftClosedConfirm) {
      setShowSoftClosedConfirm(true);
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
            amountBase: parseFloat(amountBase),
            // Note: currencyBase is NOT sent - server always uses org's baseCurrency
            amountSecondary: hasSecondaryAmount ? parseFloat(amountSecondary) : null,
            currencySecondary: hasSecondaryCurrency ? currencySecondary : null,
            date,
            description,
            categoryId,
            accountId,
            // Send vendor fields only for EXPENSE
            vendorName: type === "EXPENSE" ? vendorName || null : null,
            vendorId: type === "EXPENSE" ? vendorId || null : null,
            // Send client fields only for INCOME
            clientName: type === "INCOME" ? clientName || null : null,
            clientId: type === "INCOME" ? clientId || null : null,
            notes: notes || null,
            // Include soft-closed override if confirming
            ...(isInSoftClosedPeriod && { allowSoftClosedOverride: true }),
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
    <>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        {/* Soft-Closed Period Warning */}
        {isInSoftClosedPeriod && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This transaction is POSTED in a soft-closed period. Editing it
              may affect previously reported figures. You will be asked to
              confirm before saving changes.
            </AlertDescription>
          </Alert>
        )}

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

      {/* Base Amount */}
      <div className="space-y-2">
        <Label htmlFor="amountBase">
          Base Amount ({settings.baseCurrency}) <span className="text-destructive">*</span>
        </Label>
        <Input
          id="amountBase"
          type="number"
          step="0.01"
          value={amountBase}
          onChange={(e) => setAmountBase(e.target.value)}
          placeholder="0.00"
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          Amount in your organization&apos;s base currency ({settings.baseCurrency})
        </p>
      </div>

      {/* Secondary Amount (for dual-currency) */}
      <div className="space-y-2">
        <Label htmlFor="amountSecondary">
          Original Amount (optional)
        </Label>
        <Input
          id="amountSecondary"
          type="number"
          step="0.01"
          value={amountSecondary}
          onChange={(e) => setAmountSecondary(e.target.value)}
          placeholder="0.00"
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          For foreign currency transactions, enter the original amount
        </p>
      </div>

      {/* Secondary Currency */}
      <div className="space-y-2">
        <Label htmlFor="currencySecondary">
          Original Currency (optional)
        </Label>
        <Select
          value={currencySecondary || "none"}
          onValueChange={(value) => setCurrencySecondary(value === "none" ? "" : value)}
          disabled={isLoading}
        >
          <SelectTrigger id="currencySecondary">
            <SelectValue placeholder="Select currency" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="none">None (base currency only)</SelectItem>
            {COMMON_CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} – {c.name}
              </SelectItem>
            ))}
            {ISO_CURRENCIES.filter(
              c => !COMMON_CURRENCIES.some(cc => cc.code === c.code)
            ).map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} – {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {calculatedExchangeRate && (
          <p className="text-xs text-muted-foreground">
            Exchange rate: 1 {currencySecondary} = {calculatedExchangeRate} {settings.baseCurrency}
          </p>
        )}
      </div>

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

      {/* Client Name with Autocomplete (for INCOME) */}
      {type === "INCOME" && (
        <div className="space-y-2">
          <Label htmlFor="clientName">Client Name (optional)</Label>
          <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={clientPopoverOpen}
                className="w-full justify-between font-normal"
                disabled={isLoading}
              >
                {clientName || "Select or type client name..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search clients..."
                  value={clientName}
                  onValueChange={(value) => {
                    setClientName(value);
                    searchClients(value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && clientSuggestions.length === 0) {
                      e.preventDefault();
                      setClientPopoverOpen(false);
                    }
                  }}
                />
                <CommandList>
                  {isClientSearching && <CommandEmpty>Searching...</CommandEmpty>}
                  {!isClientSearching &&
                    clientName &&
                    clientSuggestions.length === 0 && (
                      <CommandEmpty className="text-muted-foreground p-4 text-sm">
                        No clients found.
                        <br />
                        Press Enter to create &quot;{clientName}&quot;
                      </CommandEmpty>
                    )}
                  {clientSuggestions.length > 0 && (
                    <CommandGroup>
                      {clientSuggestions.map((client) => (
                        <CommandItem
                          key={client.id}
                          value={client.id}
                          onSelect={() => {
                            setClientName(client.name);
                            setClientId(client.id);
                            setClientPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              clientId === client.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{client.name}</span>
                            {(client.email || client.phone) && (
                              <span className="text-xs text-muted-foreground">
                                {client.email || client.phone}
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
            Select an existing client or type a new name to create one
            automatically
          </p>
        </div>
      )}

      {/* Vendor Name with Autocomplete (for EXPENSE) */}
      {type === "EXPENSE" && (
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
      )}

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

    {/* Soft-Closed Period Confirmation Dialog */}
    <Dialog open={showSoftClosedConfirm} onOpenChange={setShowSoftClosedConfirm}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Posted Transaction in Soft-Closed Period</DialogTitle>
          <DialogDescription>
            This transaction is POSTED in a soft-closed period. Changing it may
            alter previously reported figures.
            <br />
            <br />
            Are you sure you want to proceed?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowSoftClosedConfirm(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setShowSoftClosedConfirm(false);
              // Trigger form submission using the form ref
              formRef.current?.requestSubmit();
            }}
            disabled={isLoading}
          >
            Confirm & Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}
