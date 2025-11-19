import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <>{children}</>;
}
