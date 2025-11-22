"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";

interface TemplateConfig {
  columnMapping: {
    date?: string;
    amount?: string;
    currency?: string;
    type?: string;
    description?: string;
    category?: string;
    account?: string;
    vendor?: string;
    client?: string;
    notes?: string;
    tags?: string;
    secondaryAmount?: string;
    secondaryCurrency?: string;
    document?: string;
  };
  parsingOptions: {
    delimiter: string;
    headerRowIndex: number;
    hasHeaders: boolean;
    dateFormat: "DD_MM_YYYY" | "MM_DD_YYYY" | "YYYY_MM_DD";
    decimalSeparator: "DOT" | "COMMA";
    thousandsSeparator: "COMMA" | "DOT" | "SPACE" | "NONE";
    directionMode: "type_column" | "sign_based";
  };
}

interface ImportTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  template?: {
    id: string;
    name: string;
    config: TemplateConfig;
  } | null;
  onSave: (data: { name: string; config: TemplateConfig }) => Promise<void>;
}

export function ImportTemplateDialog({
  isOpen,
  onClose,
  template,
  onSave,
}: ImportTemplateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [columnMapping, setColumnMapping] = useState<
    TemplateConfig["columnMapping"]
  >({});
  const [parsingOptions, setParsingOptions] = useState<
    TemplateConfig["parsingOptions"]
  >({
    delimiter: ",",
    headerRowIndex: 0,
    hasHeaders: true,
    dateFormat: "YYYY_MM_DD",
    decimalSeparator: "DOT",
    thousandsSeparator: "COMMA",
    directionMode: "type_column",
  });

  // Load template data when editing
  useEffect(() => {
    if (template) {
      setName(template.name);
      setColumnMapping(template.config.columnMapping);
      setParsingOptions(template.config.parsingOptions);
    } else {
      // Reset for create mode
      setName("");
      setColumnMapping({});
      setParsingOptions({
        delimiter: ",",
        headerRowIndex: 0,
        hasHeaders: true,
        dateFormat: "YYYY_MM_DD",
        decimalSeparator: "DOT",
        thousandsSeparator: "COMMA",
        directionMode: "type_column",
      });
    }
  }, [template, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSave({
        name,
        config: {
          columnMapping,
          parsingOptions,
        },
      });
      onClose();
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const mappingFields = [
    { field: "date", label: "Date *", required: true },
    { field: "amount", label: "Amount *", required: true },
    { field: "currency", label: "Currency *", required: true },
    ...(parsingOptions.directionMode === "type_column"
      ? [{ field: "type", label: "Type *", required: true }]
      : []),
    { field: "description", label: "Description *", required: true },
    { field: "category", label: "Category *", required: true },
    { field: "account", label: "Account *", required: true },
    { field: "vendor", label: "Vendor (Expenses)", required: false },
    { field: "client", label: "Client (Income)", required: false },
    { field: "notes", label: "Notes", required: false },
    { field: "tags", label: "Tags", required: false },
    {
      field: "secondaryAmount",
      label: "Secondary Amount",
      required: false,
    },
    {
      field: "secondaryCurrency",
      label: "Secondary Currency",
      required: false,
    },
    { field: "document", label: "Document", required: false },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit" : "Create"} Import Template
          </DialogTitle>
          <DialogDescription>
            {template
              ? "Modify the template configuration"
              : "Create a new CSV import template with column mappings and parsing options"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Template Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Bank Statement Import"
                required
              />
            </div>

            {/* Tabs for Mapping and Parsing */}
            <Tabs defaultValue="mapping">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="mapping">Column Mapping</TabsTrigger>
                <TabsTrigger value="parsing">Parsing Options</TabsTrigger>
              </TabsList>

              <TabsContent value="mapping" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Enter the expected column names from your CSV file. Leave
                  blank if not applicable.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {mappingFields.map(({ field, label }) => (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={`mapping-${field}`}>{label}</Label>
                      <Input
                        id={`mapping-${field}`}
                        value={
                          (columnMapping[
                            field as keyof typeof columnMapping
                          ] as string) || ""
                        }
                        onChange={(e) =>
                          setColumnMapping((prev) => ({
                            ...prev,
                            [field]: e.target.value || undefined,
                          }))
                        }
                        placeholder={`Column name for ${field}`}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="parsing" className="space-y-6 mt-4">
                {/* Direction Mode */}
                <div className="space-y-3">
                  <Label>Transaction Direction</Label>
                  <RadioGroup
                    value={parsingOptions.directionMode}
                    onValueChange={(value: "type_column" | "sign_based") =>
                      setParsingOptions((prev) => ({
                        ...prev,
                        directionMode: value,
                      }))
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="type_column" id="type-column" />
                      <Label htmlFor="type-column" className="font-normal">
                        Type Column (CSV has INCOME/EXPENSE column)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sign_based" id="sign-based" />
                      <Label htmlFor="sign-based" className="font-normal">
                        Sign-Based (positive = income, negative = expense)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Delimiter */}
                <div className="space-y-3">
                  <Label>Delimiter</Label>
                  <RadioGroup
                    value={parsingOptions.delimiter}
                    onValueChange={(value) =>
                      setParsingOptions((prev) => ({ ...prev, delimiter: value }))
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="," id="comma" />
                      <Label htmlFor="comma" className="font-normal">
                        Comma (,)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value=";" id="semicolon" />
                      <Label htmlFor="semicolon" className="font-normal">
                        Semicolon (;)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="\t" id="tab" />
                      <Label htmlFor="tab" className="font-normal">
                        Tab
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="|" id="pipe" />
                      <Label htmlFor="pipe" className="font-normal">
                        Pipe (|)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Header Options */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="has-headers"
                      checked={parsingOptions.hasHeaders}
                      onCheckedChange={(checked) =>
                        setParsingOptions((prev) => ({
                          ...prev,
                          hasHeaders: checked === true,
                        }))
                      }
                    />
                    <Label htmlFor="has-headers" className="font-normal">
                      First row contains headers
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="header-row">Header Row Index</Label>
                    <Input
                      id="header-row"
                      type="number"
                      min={0}
                      value={parsingOptions.headerRowIndex}
                      onChange={(e) =>
                        setParsingOptions((prev) => ({
                          ...prev,
                          headerRowIndex: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Date Format */}
                <div className="space-y-2">
                  <Label htmlFor="date-format">Date Format</Label>
                  <Select
                    value={parsingOptions.dateFormat}
                    onValueChange={(
                      value: "DD_MM_YYYY" | "MM_DD_YYYY" | "YYYY_MM_DD"
                    ) =>
                      setParsingOptions((prev) => ({
                        ...prev,
                        dateFormat: value,
                      }))
                    }
                  >
                    <SelectTrigger id="date-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD_MM_YYYY">
                        DD/MM/YYYY (31/12/2024)
                      </SelectItem>
                      <SelectItem value="MM_DD_YYYY">
                        MM/DD/YYYY (12/31/2024)
                      </SelectItem>
                      <SelectItem value="YYYY_MM_DD">
                        YYYY-MM-DD (2024-12-31)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Decimal Separator */}
                <div className="space-y-3">
                  <Label>Decimal Separator</Label>
                  <RadioGroup
                    value={parsingOptions.decimalSeparator}
                    onValueChange={(value: "DOT" | "COMMA") =>
                      setParsingOptions((prev) => ({
                        ...prev,
                        decimalSeparator: value,
                      }))
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="DOT" id="decimal-dot" />
                      <Label htmlFor="decimal-dot" className="font-normal">
                        Dot (1234.56)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="COMMA" id="decimal-comma" />
                      <Label htmlFor="decimal-comma" className="font-normal">
                        Comma (1234,56)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Thousands Separator */}
                <div className="space-y-3">
                  <Label>Thousands Separator</Label>
                  <RadioGroup
                    value={parsingOptions.thousandsSeparator}
                    onValueChange={(
                      value: "COMMA" | "DOT" | "SPACE" | "NONE"
                    ) =>
                      setParsingOptions((prev) => ({
                        ...prev,
                        thousandsSeparator: value,
                      }))
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="COMMA" id="thousands-comma" />
                      <Label htmlFor="thousands-comma" className="font-normal">
                        Comma (1,234,567)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="DOT" id="thousands-dot" />
                      <Label htmlFor="thousands-dot" className="font-normal">
                        Dot (1.234.567)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="SPACE" id="thousands-space" />
                      <Label htmlFor="thousands-space" className="font-normal">
                        Space (1 234 567)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="NONE" id="thousands-none" />
                      <Label htmlFor="thousands-none" className="font-normal">
                        None (1234567)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : template
                  ? "Save Changes"
                  : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
