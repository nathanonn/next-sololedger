import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { DashboardShell } from "@/components/features/dashboard/dashboard-shell";
import { Home, Settings } from "lucide-react";

/**
 * Protected layout
 * Validates session server-side and renders DashboardShell
 */

// Example sections and pages structure
// In a real app, you might fetch these from a database or config
const sections = [
  {
    id: "main",
    label: "Main",
    icon: <Home className="h-4 w-4" />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings className="h-4 w-4" />,
  },
];

const pages = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    sectionId: "main",
  },
  {
    id: "profile",
    label: "Profile",
    href: "/settings/profile",
    sectionId: "settings",
  },
];

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  // Validate session
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell
      userId={user.id}
      userEmail={user.email}
      sections={sections}
      pages={pages}
    >
      {children}
    </DashboardShell>
  );
}
