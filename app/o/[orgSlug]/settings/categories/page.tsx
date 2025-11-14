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
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  GripVertical,
  Trash2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

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
  sortOrder: number;
}

interface CategoryUsage {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  active: boolean;
  sortOrder: number;
  transactionCount: number;
  totalAmount: number;
  lastUsedAt: string | null;
}

// Predefined color palette
const COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "Gray", value: "#6b7280" },
];

// Curated Lucide icon names
const ICONS = [
  "Briefcase",
  "DollarSign",
  "TrendingUp",
  "TrendingDown",
  "ShoppingCart",
  "Home",
  "Car",
  "Plane",
  "Coffee",
  "Utensils",
  "Monitor",
  "Smartphone",
  "Heart",
  "Book",
  "GraduationCap",
];

export default function CategoriesManagementPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [usage, setUsage] = React.useState<CategoryUsage[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null);
  const [activeTab, setActiveTab] = React.useState<"all" | "INCOME" | "EXPENSE">("all");

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [categoryToDelete, setCategoryToDelete] = React.useState<Category | null>(null);
  const [replacementCategoryId, setReplacementCategoryId] = React.useState("");

  // Drag and drop state
  const [draggedCategory, setDraggedCategory] = React.useState<Category | null>(null);

  // Form state
  const [formName, setFormName] = React.useState("");
  const [formType, setFormType] = React.useState<"INCOME" | "EXPENSE">("INCOME");
  const [formParentId, setFormParentId] = React.useState<string>("");
  const [formIncludePnL, setFormIncludePnL] = React.useState(true);
  const [formActive, setFormActive] = React.useState(true);
  const [formColor, setFormColor] = React.useState<string>("");
  const [formIcon, setFormIcon] = React.useState<string>("");

  // Load categories and usage
  React.useEffect(() => {
    async function loadData() {
      try {
        await Promise.all([loadCategories(), loadUsage()]);
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load categories");
      } finally {
        setIsInitialLoading(false);
      }
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug]);

  async function loadCategories() {
    try {
      const response = await fetch(`/api/orgs/${orgSlug}/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      } else if (response.status === 404) {
        toast.error("Organization not found");
        router.push("/");
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }

  async function loadUsage() {
    try {
      const response = await fetch(`/api/orgs/${orgSlug}/categories/usage`);
      if (response.ok) {
        const data = await response.json();
        setUsage(data.usage || []);
      }
    } catch (error) {
      console.error("Error loading usage:", error);
    }
  }

  function resetForm() {
    setFormName("");
    setFormType("INCOME");
    setFormParentId("");
    setFormIncludePnL(true);
    setFormActive(true);
    setFormColor("");
    setFormIcon("");
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
    setFormColor(category.color || "");
    setFormIcon(category.icon || "");
    setEditingCategory(category);
    setIsAddDialogOpen(true);
  }

  function openDeleteDialog(category: Category) {
    setCategoryToDelete(category);
    setReplacementCategoryId("");
    setDeleteDialogOpen(true);
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
          ? `/api/orgs/${orgSlug}/categories/${editingCategory.id}`
          : `/api/orgs/${orgSlug}/categories`,
        {
          method: editingCategory ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            ...(editingCategory ? {} : { type: formType }),
            parentId: formParentId || null,
            includeInPnL: formIncludePnL,
            active: formActive,
            color: formColor || null,
            icon: formIcon || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to save category");
        return;
      }

      toast.success(editingCategory ? "Category updated" : "Category created");
      setIsAddDialogOpen(false);
      resetForm();

      await Promise.all([loadCategories(), loadUsage()]);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!categoryToDelete) return;

    const categoryUsage = usage.find((u) => u.id === categoryToDelete.id);
    const hasTransactions = categoryUsage && categoryUsage.transactionCount > 0;

    // Only require replacement if category has transactions
    if (hasTransactions && !replacementCategoryId) {
      toast.error("Please select a replacement category");
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(
        `/api/orgs/${orgSlug}/categories/${categoryToDelete.id}/delete-with-reassignment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // For unused categories, send any valid category ID (the API will ignore it)
            // For used categories, send the selected replacement
            replacementCategoryId: replacementCategoryId || categoryToDelete.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to delete category");
        return;
      }

      toast.success(`Category deleted. ${result.reassignedCount || 0} transactions reassigned.`);
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
      setReplacementCategoryId("");

      await Promise.all([loadCategories(), loadUsage()]);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // Drag and drop handlers
  function handleDragStart(category: Category) {
    setDraggedCategory(category);
  }

  function handleDragOver(e: React.DragEvent, category: Category) {
    e.preventDefault();
    if (!draggedCategory || draggedCategory.id === category.id) return;
    if (draggedCategory.type !== category.type) return;
    if (draggedCategory.parentId !== category.parentId) return;
  }

  async function handleDrop(e: React.DragEvent, targetCategory: Category) {
    e.preventDefault();
    if (!draggedCategory || draggedCategory.id === targetCategory.id) return;
    if (draggedCategory.type !== targetCategory.type) return;
    if (draggedCategory.parentId !== targetCategory.parentId) return;

    // Get all categories in the same group
    const sameGroup = categories.filter(
      (c) =>
        c.type === draggedCategory.type &&
        c.parentId === draggedCategory.parentId
    ).sort((a, b) => a.sortOrder - b.sortOrder);

    // Remove dragged category
    const filtered = sameGroup.filter((c) => c.id !== draggedCategory.id);

    // Insert at target position
    const targetIndex = filtered.findIndex((c) => c.id === targetCategory.id);
    filtered.splice(targetIndex, 0, draggedCategory);

    // Build reorder payload
    const reorderPayload = filtered.map((cat, index) => ({
      id: cat.id,
      sortOrder: index,
    }));

    // Optimistically update UI
    const updatedCategories = categories.map((cat) => {
      const updated = reorderPayload.find((r) => r.id === cat.id);
      return updated ? { ...cat, sortOrder: updated.sortOrder } : cat;
    });
    setCategories(updatedCategories);

    // Persist to backend
    try {
      const response = await fetch(`/api/orgs/${orgSlug}/categories/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: reorderPayload }),
      });

      if (!response.ok) {
        toast.error("Failed to reorder categories");
        await loadCategories(); // Reload on error
      }
    } catch {
      toast.error("Network error during reorder");
      await loadCategories();
    }

    setDraggedCategory(null);
  }

  const parentOptions = categories.filter(
    (c) =>
      c.type === formType &&
      (!editingCategory || c.id !== editingCategory.id)
  );

  const filteredCategories =
    activeTab === "all"
      ? categories.sort((a, b) => {
          if (a.type !== b.type) return a.type.localeCompare(b.type);
          return a.sortOrder - b.sortOrder;
        })
      : categories.filter((c) => c.type === activeTab).sort((a, b) => a.sortOrder - b.sortOrder);

  // Get replacement options for delete dialog
  const replacementOptions = categoryToDelete
    ? categories.filter(
        (c) => c.type === categoryToDelete.type && c.id !== categoryToDelete.id && c.active
      )
    : [];

  const categoryUsageMap = new Map(usage.map((u) => [u.id, u]));

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
            Manage your income and expense categories. Drag to reorder within each group.
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
                    <Button variant="outline" onClick={() => openAddDialog("INCOME")}>
                      + Income
                    </Button>
                  </DialogTrigger>
                </Dialog>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" onClick={() => openAddDialog("EXPENSE")}>
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
                  {filteredCategories.map((category) => {
                    const usageData = categoryUsageMap.get(category.id);
                    return (
                      <div
                        key={category.id}
                        draggable
                        onDragStart={() => handleDragStart(category)}
                        onDragOver={(e) => handleDragOver(e, category)}
                        onDrop={(e) => handleDrop(e, category)}
                        className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-move"
                      >
                        <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />

                        {category.color && (
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: category.color }}
                          />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{category.name}</span>
                            <Badge
                              variant={category.type === "INCOME" ? "default" : "secondary"}
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
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                            {category.parent && <span>Parent: {category.parent.name}</span>}
                            <span>{category.includeInPnL ? "In P&L" : "Not in P&L"}</span>
                            {usageData && (
                              <>
                                <span>{usageData.transactionCount} transactions</span>
                                {usageData.lastUsedAt && (
                                  <span>Last used: {new Date(usageData.lastUsedAt).toLocaleDateString()}</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(category)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(category)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit/Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "New Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "Update category details" : "Create a new category"}
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
                <Select
                  value={formType}
                  onValueChange={(v) => setFormType(v as "INCOME" | "EXPENSE")}
                  disabled={isLoading}
                >
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
              <Select value={formParentId} onValueChange={setFormParentId} disabled={isLoading}>
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
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormColor(color.value)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formColor === color.value ? "border-primary ring-2 ring-primary ring-offset-2" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                    disabled={isLoading}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="icon">Icon</Label>
              <Select value={formIcon} onValueChange={setFormIcon} disabled={isLoading}>
                <SelectTrigger id="icon">
                  <SelectValue placeholder="Select an icon" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {ICONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      {icon}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
              {isLoading ? "Saving..." : editingCategory ? "Update Category" : "Create Category"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Category
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. You must reassign transactions to another category.
            </DialogDescription>
          </DialogHeader>

          {categoryToDelete && (
            <div className="space-y-4 pt-4">
              <Alert>
                <AlertDescription>
                  <div className="font-medium mb-2">
                    Deleting: <strong>{categoryToDelete.name}</strong>
                  </div>
                  {categoryUsageMap.get(categoryToDelete.id) && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Transactions: {categoryUsageMap.get(categoryToDelete.id)?.transactionCount || 0}</div>
                      <div>
                        Total amount: {categoryUsageMap.get(categoryToDelete.id)?.totalAmount.toFixed(2) || "0.00"}
                      </div>
                    </div>
                  )}
                </AlertDescription>
              </Alert>

              {(categoryUsageMap.get(categoryToDelete.id)?.transactionCount || 0) > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="replacement">
                    Replacement Category <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={replacementCategoryId}
                    onValueChange={setReplacementCategoryId}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="replacement">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {replacementOptions.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    All transactions will be reassigned to this category
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isLoading}
                >
                  {isLoading ? "Deleting..." : "Delete Category"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
