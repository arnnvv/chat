import { getCurrentSession } from "@/actions";
import { db } from "@/lib/db";
import { devices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { JSX } from "react";

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

  const userDevices = await db.query.devices.findMany({
    where: eq(devices.userId, user.id),
  });

  if (userDevices.length === 0) {
    return redirect("/setup-device");
  }

  return redirect("/dashboard");
}
