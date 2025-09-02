import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { JSX } from "react";
import { addFriendAction, getCurrentSession } from "@/actions";
import { FormComponent } from "@/components/FormComponent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Add friend",
  description: "Add a friend to your account",
};

export default async function Page(): Promise<JSX.Element> {
  const { user } = await getCurrentSession();
  if (!user) return redirect("/login");

  return (
    <FormComponent action={addFriendAction}>
      <main className="pt-8">
        <h1 className="text-5xl font-bold mb-8">Add a friend</h1>
        <Label
          htmlFor="friend-email"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
          Friend&apos;s Email
        </Label>
        <div className="mt-2 flex gap-4">
          <Input
            type="email"
            name="friend-email"
            id="friend-email"
            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-cyan-300 sm:text-sm sm:leading-6"
            placeholder="Friend's email"
            required
          />
          <Button type="submit">Add</Button>
        </div>
      </main>
    </FormComponent>
  );
}
