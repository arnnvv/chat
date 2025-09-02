import { redirect } from "next/navigation";
import type { JSX } from "react";
import { getCurrentSession } from "@/actions";

export default async function Home(): Promise<JSX.Element> {
  const { user, session } = await getCurrentSession();
  if (session === null) return redirect("/login");
  if (!user.verified) return redirect("/email-verification");

  if (
    user.username.startsWith("google-") ||
    user.username.startsWith("github-")
  ) {
    return redirect("/get-username");
  }

  return redirect("/dashboard");
}
