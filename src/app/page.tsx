import { getCurrentSession } from "@/actions";
import { redirect } from "next/navigation";

export default async function Home(): Promise<never> {
  const { user } = await getCurrentSession();
  if (!user) return redirect("login");
  else return redirect("/dashboard");
}
