"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { ImportTemplateDialog } from "./import-template-dialog";
import { DeleteTemplateDialog } from "./delete-template-dialog";

interface Template {
  id: string;
  name: string;
  config: {
    columnMapping: Record<string, string | undefined>;
    parsingOptions: {
      delimiter: string;
      headerRowIndex: number;
      hasHeaders: boolean;
      dateFormat: string;
      decimalSeparator: string;
      thousandsSeparator: string;
      directionMode: string;
    };
  };
  createdAt: string;
  createdBy: {
    name: string | null;
    email: string;
  };
}

export function ImportTemplatesList() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(
    null
  );
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(
    null
  );

  // Fetch templates
  useEffect(() => {
    async function fetchTemplates() {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/orgs/${orgSlug}/transactions/import-templates`
        );
        if (!response.ok) throw new Error("Failed to fetch templates");
        const data = await response.json();
        setTemplates(data.templates || []);
      } catch (error) {
        console.error("Error fetching templates:", error);
        toast.error("Failed to load templates");
      } finally {
        setIsLoading(false);
      }
    }

    fetchTemplates();
  }, [orgSlug]);

  // Create template
  async function handleCreate(data: {
    name: string;
    config: Template["config"];
  }) {
    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/transactions/import-templates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create template");
      }

      const result = await response.json();
      setTemplates((prev) => [...prev, result.template]);
      toast.success("Template created successfully");
    } catch (error) {
      console.error("Create error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create template"
      );
      throw error;
    }
  }

  // Update template
  async function handleUpdate(data: {
    name: string;
    config: Template["config"];
  }) {
    if (!editingTemplate) return;

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/transactions/import-templates/${editingTemplate.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update template");
      }

      const result = await response.json();
      setTemplates((prev) =>
        prev.map((t) => (t.id === editingTemplate.id ? result.template : t))
      );
      setEditingTemplate(null);
      toast.success("Template updated successfully");
    } catch (error) {
      console.error("Update error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update template"
      );
      throw error;
    }
  }

  // Delete template
  async function handleDelete(id: string) {
    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/transactions/import-templates/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete template");
      }

      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template deleted successfully");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete template"
      );
      throw error;
    }
  }

  // Get mapping summary
  function getMappingSummary(template: Template): string {
    const mapped = Object.values(template.config.columnMapping).filter(
      (v) => v
    ).length;
    return `${mapped} fields mapped`;
  }

  // Format date
  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading templates...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Import Templates</CardTitle>
              <CardDescription>
                Manage CSV import templates for transaction imports
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No import templates yet.</p>
              <p className="text-sm mt-2">
                Create a template to save column mappings and parsing options
                for reuse.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium">{template.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {getMappingSummary(template)} •{" "}
                      {template.config.parsingOptions.delimiter === ","
                        ? "Comma"
                        : template.config.parsingOptions.delimiter === ";"
                          ? "Semicolon"
                          : template.config.parsingOptions.delimiter === "\t"
                            ? "Tab"
                            : "Pipe"}{" "}
                      delimiter
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {template.createdBy ? (
                        <>
                          Created by {template.createdBy.name || template.createdBy.email}{" "}
                          • {formatDate(template.createdAt)}
                        </>
                      ) : (
                        <>Created {formatDate(template.createdAt)}</>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingTemplate(template)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingTemplate(template)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <ImportTemplateDialog
        isOpen={showCreateDialog || editingTemplate !== null}
        onClose={() => {
          setShowCreateDialog(false);
          setEditingTemplate(null);
        }}
        template={editingTemplate}
        onSave={editingTemplate ? handleUpdate : handleCreate}
      />

      {/* Delete Dialog */}
      <DeleteTemplateDialog
        isOpen={deletingTemplate !== null}
        onClose={() => setDeletingTemplate(null)}
        template={deletingTemplate}
        onDelete={handleDelete}
      />
    </>
  );
}
