import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentSession } from "@/actions";

export async function AuthPageWrapper({ children }: { children: ReactNode }) {
  const { session } = await getCurrentSession();

  if (session !== null) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
