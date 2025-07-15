"use client";

import { useRouter } from "next/navigation";
import { type JSX, useEffect, useState, type ReactNode } from "react";
import { Spinner } from "./ui/spinner";

export function DeviceSetupCheck({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const privateKey = localStorage.getItem("privateKey");
      const deviceId = localStorage.getItem("deviceId");

      if (!privateKey || !deviceId) {
        router.push("/setup-device");
      } else {
        setIsChecking(false);
      }
    }
  }, [router]);

  if (isChecking) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <>{children}</>;
}
