"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  includeInPnL: boolean;
  active: boolean;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  color: string | null;
  icon: string | null;
}

export default function CategoriesManagementPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [orgId, setOrgId] = React.useState<string>("");
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(
    null
  );
  const [activeTab, setActiveTab] = React.useState<"all" | "INCOME" | "EXPENSE">(
    "all"
  );

  // Form state
  const [formName, setFormName] = React.useState("");
  const [formType, setFormType] = React.useState<"INCOME" | "EXPENSE">("INCOME");
  const [formParentId, setFormParentId] = React.useState<string>("");
  const [formIncludePnL, setFormIncludePnL] = React.useState(true);
  const [formActive, setFormActive] = React.useState(true);

  // Load organization and categories
  React.useEffect(() => {
    async function loadOrgAndCategories() {
      try {
        const orgsResponse = await fetch("/api/orgs");
        const orgsData = await orgsResponse.json();
        const org = orgsData.organizations?.find(
          (o: { slug: string }) => o.slug === orgSlug
        );

        if (!org) {
          toast.error("Organization not found");
          router.push("/");
          return;
        }

        setOrgId(org.id);
        await loadCategories(org.id);
      } catch (error) {
        console.error("Error loading organization:", error);
        toast.error("Failed to load organization");
      } finally {
        setIsInitialLoading(false);
      }
    }

    loadOrgAndCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, router]);

  async function loadCategories(id: string) {
    try {
      const response = await fetch(`/api/orgs/${id}/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }

  function resetForm() {
    setFormName("");
    setFormType("INCOME");
    setFormParentId("");
    setFormIncludePnL(true);
    setFormActive(true);
    setEditingCategory(null);
  }

  function openAddDialog(type: "INCOME" | "EXPENSE") {
    resetForm();
    setFormType(type);
    setIsAddDialogOpen(true);
  }

  function openEditDialog(category: Category) {
    setFormName(category.name);
    setFormType(category.type);
    setFormParentId(category.parentId || "");
    setFormIncludePnL(category.includeInPnL);
    setFormActive(category.active);
    setEditingCategory(category);
    setIsAddDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formName.trim()) {
      toast.error("Please enter a category name");
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(
        editingCategory
          ? `/api/orgs/${orgId}/categories/${editingCategory.id}`
          : `/api/orgs/${orgId}/categories`,
        {
          method: editingCategory ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            ...(editingCategory ? {} : { type: formType }),
            parentId: formParentId || null,
            includeInPnL: formIncludePnL,
            active: formActive,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to save category");
        return;
      }

      toast.success(
        editingCategory ? "Category updated" : "Category created"
      );
      setIsAddDialogOpen(false);
      resetForm();

      // Reload categories
      await loadCategories(orgId);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // Get parent options based on type
  const parentOptions = categories.filter(
    (c) =>
      c.type === formType &&
      (!editingCategory || c.id !== editingCategory.id)
  );

  const filteredCategories =
    activeTab === "all"
      ? categories
      : categories.filter((c) => c.type === activeTab);

  if (isInitialLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Categories</h1>
        <p className="text-muted-foreground">
          Income and expense categories for this business
        </p>
      </div>

      {/* Categories List */}
      <Card>
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
          <CardDescription>
            Manage your income and expense categories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="INCOME">Income</TabsTrigger>
                <TabsTrigger value="EXPENSE">Expense</TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={() => openAddDialog("INCOME")}
                    >
                      + Income
                    </Button>
                  </DialogTrigger>
                </Dialog>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={() => openAddDialog("EXPENSE")}
                    >
                      + Expense
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </div>
            </div>

            <TabsContent value={activeTab} className="mt-4">
              {filteredCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No categories found for this filter.
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredCategories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{category.name}</span>
                          <Badge
                            variant={
                              category.type === "INCOME"
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {category.type}
                          </Badge>
                          {!category.active && (
                            <Badge variant="outline" className="text-xs">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          {category.parent && (
                            <span>Parent: {category.parent.name}</span>
                          )}
                          <span>
                            {category.includeInPnL ? "In P&L" : "Not in P&L"}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(category)}
                      >
                        Edit
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit/Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "New Category"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Update category details"
                : "Create a new category"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Consulting Revenue"
                disabled={isLoading}
              />
            </div>

            {!editingCategory && (
              <div className="space-y-2">
                <Label htmlFor="type">
                  Type <span className="text-destructive">*</span>
                </Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as "INCOME" | "EXPENSE")} disabled={isLoading}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCOME">Income</SelectItem>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="parent">Parent Category</Label>
              <Select
                value={formParentId}
                onValueChange={setFormParentId}
                disabled={isLoading}
              >
                <SelectTrigger id="parent">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {parentOptions.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose a parent of the same type
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="includePnL">Include in Profit & Loss</Label>
              <Switch
                id="includePnL"
                checked={formIncludePnL}
                onCheckedChange={setFormIncludePnL}
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="active">Active</Label>
              <Switch
                id="active"
                checked={formActive}
                onCheckedChange={setFormActive}
                disabled={isLoading}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading
                ? "Saving..."
                : editingCategory
                  ? "Update Category"
                  : "Create Category"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
