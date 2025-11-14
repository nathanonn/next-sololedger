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
import { Textarea } from "@/components/ui/textarea";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Info } from "lucide-react";

interface Account {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
}

export default function AccountsManagementPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [orgId, setOrgId] = React.useState<string>("");
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState<Account | null>(
    null
  );

  // Form state
  const [formName, setFormName] = React.useState("");
  const [formDescription, setFormDescription] = React.useState("");
  const [formIsDefault, setFormIsDefault] = React.useState(false);
  const [formActive, setFormActive] = React.useState(true);

  // Load organization and accounts
  React.useEffect(() => {
    async function loadOrgAndAccounts() {
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
        await loadAccounts(org.id);
      } catch (error) {
        console.error("Error loading organization:", error);
        toast.error("Failed to load organization");
      } finally {
        setIsInitialLoading(false);
      }
    }

    loadOrgAndAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, router]);

  async function loadAccounts(id: string) {
    try {
      const response = await fetch(`/api/orgs/${id}/accounts`);
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
      } else if (response.status === 403) {
        toast.error("Admin access required to manage accounts");
        router.push(`/o/${orgSlug}/dashboard`);
      }
    } catch (error) {
      console.error("Error loading accounts:", error);
    }
  }

  function resetForm() {
    setFormName("");
    setFormDescription("");
    setFormIsDefault(false);
    setFormActive(true);
    setEditingAccount(null);
  }

  function openAddDialog() {
    resetForm();
    setIsAddDialogOpen(true);
  }

  function openEditDialog(account: Account) {
    setFormName(account.name);
    setFormDescription(account.description || "");
    setFormIsDefault(account.isDefault);
    setFormActive(account.active);
    setEditingAccount(account);
    setIsAddDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formName.trim()) {
      toast.error("Please enter an account name");
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(
        editingAccount
          ? `/api/orgs/${orgId}/accounts/${editingAccount.id}`
          : `/api/orgs/${orgId}/accounts`,
        {
          method: editingAccount ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            description: formDescription || null,
            isDefault: formIsDefault,
            active: formActive,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to save account");
        return;
      }

      toast.success(
        editingAccount ? "Account updated" : "Account created"
      );
      setIsAddDialogOpen(false);
      resetForm();

      // Reload accounts
      await loadAccounts(orgId);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

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
        <h1 className="text-3xl font-bold">Accounts</h1>
        <p className="text-muted-foreground">
          Where your money lives (bank, cash, payment services)
        </p>
      </div>

      {/* Accounts List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>All Accounts</CardTitle>
            <CardDescription>Manage your business accounts</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}>+ New Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingAccount ? "Edit Account" : "New Account"}
                </DialogTitle>
                <DialogDescription>
                  {editingAccount
                    ? "Update account details"
                    : "Create a new account for your business"}
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
                    placeholder="e.g., Main Bank Account"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional description"
                    disabled={isLoading}
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="isDefault">Default Account</Label>
                    <p className="text-xs text-muted-foreground">
                      Only one default account per business
                    </p>
                  </div>
                  <Switch
                    id="isDefault"
                    checked={formIsDefault}
                    onCheckedChange={setFormIsDefault}
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
                    : editingAccount
                      ? "Update Account"
                      : "Create Account"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Only Owners/Admins can manage accounts.
            </AlertDescription>
          </Alert>

          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No accounts yet. Create your first account to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{account.name}</span>
                      {account.isDefault && (
                        <Badge variant="default" className="text-xs">
                          Default
                        </Badge>
                      )}
                      {!account.active && (
                        <Badge variant="outline" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    {account.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {account.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Created{" "}
                      {new Date(account.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(account)}
                  >
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
