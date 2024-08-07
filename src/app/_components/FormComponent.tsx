"use client";
import { ReactNode, useActionState, useEffect } from "react";
import { toast } from "sonner";

export interface ActionResult {
  error: string | null;
}

export const FormComponent = ({
  children,
  action,
}: {
  children: ReactNode;
  action: (prevState: any, formdata: FormData) => Promise<ActionResult>;
}): JSX.Element => {
  const [state, formAction] = useActionState(action, {
    error: null,
  });

  useEffect((): void => {
    if (state.error)
      toast.error(state.error, {
        id: "1",
        action: {
          label: "Close",
          onClick: (): string | number => toast.dismiss("1"),
        },
      });
  }, [state.error]);

  return (
    <form action={formAction}>
      {children}
      <p>{state.error}</p>
    </form>
  );
};
