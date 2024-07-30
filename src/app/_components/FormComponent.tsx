"use client";
import { useFormState } from "react-dom";
import { ReactNode } from "react";

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
  const [state, formAction] = useFormState(action, {
    error: null,
  });

  return (
    <form action={formAction}>
      {children}
      <p>{state.error}</p>
    </form>
  );
};
