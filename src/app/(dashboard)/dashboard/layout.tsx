import { ReactNode } from "react";

export default function page({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return <>{children}</>;
}
