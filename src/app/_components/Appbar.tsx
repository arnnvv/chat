import { FormComponent } from "./FormComponent";
import { Button } from "@/components/ui/button";
import { signOutAction, validateRequest } from "@/actions";

export const Appbar = async (): Promise<JSX.Element> => {
  const { user } = await validateRequest();
  return (
    <div className="flex justify-between border-b px-4">
      <div className="text-lg flex flex-col justify-center">CHAT</div>
      {user && (
        <div className="flex flex-col justify-center pt-2">
          <FormComponent action={signOutAction}>
            <Button>Logout</Button>
          </FormComponent>
        </div>
      )}
    </div>
  );
};
