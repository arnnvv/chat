"use client";
import { ReactNode } from "react";
import { Toaster } from "sonner";

export const Providers = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => (
  <>
    <Toaster richColors position="top-center" />
    {children}
  </>
);
