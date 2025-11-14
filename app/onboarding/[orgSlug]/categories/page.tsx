"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Info } from "lucide-react";

interface Category {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  includeInPnL: boolean;
  active: boolean;
  parentId: string | null;
  parent: { id: string; name: string } | null;
}

export default function CategorySetupPage(): React.JSX.Element {
  const router = useRouter();
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [orgId, setOrgId] = React.useState<string>("");
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [addingType, setAddingType] = React.useState<"INCOME" | "EXPENSE">(
    "INCOME"
  );

  // New category form state
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryIncludePnL, setNewCategoryIncludePnL] =
    React.useState(true);

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
          router.push("/onboarding/create-organization");
          return;
        }

        setOrgId(org.id);

        // Seed default categories if none exist
        await fetch(`/api/orgs/${org.id}/categories/seed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        // Load categories
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

  async function handleAddCategory() {
    if (!newCategoryName.trim()) {
      toast.error("Please enter a category name");
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(`/api/orgs/${orgId}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategoryName,
          type: addingType,
          includeInPnL: newCategoryIncludePnL,
          active: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to add category");
        return;
      }

      toast.success("Category added");
      setNewCategoryName("");
      setNewCategoryIncludePnL(true);
      setIsAddDialogOpen(false);

      // Reload categories
      await loadCategories(orgId);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleActive(categoryId: string, active: boolean) {
    try {
      const response = await fetch(
        `/api/orgs/${orgId}/categories/${categoryId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !active }),
        }
      );

      if (!response.ok) {
        toast.error("Failed to update category");
        return;
      }

      toast.success(active ? "Category deactivated" : "Category activated");
      await loadCategories(orgId);
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  async function handleFinishSetup() {
    try {
      setIsLoading(true);

      // Validate categories
      const activeIncome = categories.filter(
        (c) => c.type === "INCOME" && c.active
      );
      const activeExpense = categories.filter(
        (c) => c.type === "EXPENSE" && c.active
      );

      if (activeIncome.length === 0 || activeExpense.length === 0) {
        toast.error(
          "You need at least one active income and one active expense category"
        );
        return;
      }

      // Complete onboarding
      const response = await fetch(`/api/orgs/${orgId}/complete-onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to complete onboarding");
        return;
      }

      toast.success("Onboarding complete! Welcome to Sololedger");

      // Redirect to dashboard
      router.push(`/o/${orgSlug}/dashboard`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const incomeCategories = categories.filter((c) => c.type === "INCOME");
  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");
  const hasActiveIncome = incomeCategories.some((c) => c.active);
  const hasActiveExpense = expenseCategories.some((c) => c.active);
  const canFinish = hasActiveIncome && hasActiveExpense;

  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <div className="text-sm text-muted-foreground mb-2">
            Step 4 of 4 – Categories
          </div>
          <CardTitle>Income & expense categories</CardTitle>
          <CardDescription>
            Start with a few useful categories. You can tweak these later in
            Settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              We&apos;ve created some defaults for you (Owner contributions,
              Tax, Transfers). You need at least one Income and one Expense
              category to finish onboarding.
            </AlertDescription>
          </Alert>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Income Categories */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Income categories</h3>
                <Dialog
                  open={isAddDialogOpen && addingType === "INCOME"}
                  onOpenChange={(open) => {
                    setIsAddDialogOpen(open);
                    if (open) setAddingType("INCOME");
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      + Add income
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add income category</DialogTitle>
                      <DialogDescription>
                        Create a new income category
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="e.g., Consulting Revenue"
                          disabled={isLoading}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="includePnL">Include in P&L</Label>
                        <Switch
                          id="includePnL"
                          checked={newCategoryIncludePnL}
                          onCheckedChange={setNewCategoryIncludePnL}
                          disabled={isLoading}
                        />
                      </div>

                      <Button
                        onClick={handleAddCategory}
                        disabled={isLoading}
                        className="w-full"
                      >
                        {isLoading ? "Adding..." : "Add category"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-2">
                {incomeCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{cat.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {cat.includeInPnL ? "In P&L" : "Not in P&L"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={cat.active ? "default" : "secondary"}
                      >
                        {cat.active ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(cat.id, cat.active)}
                      >
                        {cat.active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Expense Categories */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Expense categories</h3>
                <Dialog
                  open={isAddDialogOpen && addingType === "EXPENSE"}
                  onOpenChange={(open) => {
                    setIsAddDialogOpen(open);
                    if (open) setAddingType("EXPENSE");
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      + Add expense
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add expense category</DialogTitle>
                      <DialogDescription>
                        Create a new expense category
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="name-expense">Name</Label>
                        <Input
                          id="name-expense"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="e.g., Office Supplies"
                          disabled={isLoading}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="includePnL-expense">
                          Include in P&L
                        </Label>
                        <Switch
                          id="includePnL-expense"
                          checked={newCategoryIncludePnL}
                          onCheckedChange={setNewCategoryIncludePnL}
                          disabled={isLoading}
                        />
                      </div>

                      <Button
                        onClick={handleAddCategory}
                        disabled={isLoading}
                        className="w-full"
                      >
                        {isLoading ? "Adding..." : "Add category"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-2">
                {expenseCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{cat.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {cat.includeInPnL ? "In P&L" : "Not in P&L"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={cat.active ? "default" : "secondary"}
                      >
                        {cat.active ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(cat.id, cat.active)}
                      >
                        {cat.active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {!canFinish && (
            <Alert variant="destructive">
              <AlertDescription>
                You need at least one active income and one active expense
                category to finish onboarding.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/onboarding/${orgSlug}/financial`)}
              disabled={isLoading}
            >
              Back
            </Button>
            <Button
              onClick={handleFinishSetup}
              disabled={isLoading || !canFinish}
              className="flex-1"
            >
              {isLoading ? "Finishing..." : "Finish setup"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center pt-4">
            You can refine categories later under Business → Categories
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
