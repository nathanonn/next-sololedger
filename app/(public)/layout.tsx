import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function PublicLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return children;
}
