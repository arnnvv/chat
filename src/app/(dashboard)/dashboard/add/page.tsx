import { addFriendAction } from "@/actions";
import { FormComponent } from "@/app/_components/FormComponent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Page(): JSX.Element {
  return (
    <FormComponent action={addFriendAction}>
      <main className="pt-8">
        <h1 className="text-5xl font-bold mb-8">Add a friend</h1>
      </main>
      <Label
        htmlFor="email"
        className="block text-sm font-medium leading-6 text-gray-900"
      ></Label>
      <div className="mt-2 flex gap-4">
        <Input
          type="text"
          className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-cyan-300 sm:text-sm sm:leading-6"
          placeholder="Friend's email"
        />
        <Button>Add</Button>
      </div>
    </FormComponent>
  );
}
