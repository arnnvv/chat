import type { ReactNode } from "react";

export default function page({
  children,
}: Readonly<{
  children: ReactNode;
}>): JSX.Element {
  return <>{children}</>;
}
