import { validateRequest } from "@/actions";
import { redirect } from "next/navigation";

export default async function Pager(): Promise<JSX.Element> {
  const { user } = await validateRequest();
  if (!user) return redirect("/login");
  return <>DASH</>;
}
