"use client";

import { useRouter } from "next/navigation";
import { type JSX, useEffect, useState, type ReactNode } from "react";
import { Spinner } from "./ui/spinner";
import { cryptoStore } from "@/lib/crypto-store";

export function DeviceSetupCheck({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkDeviceSetup = async () => {
      if (typeof window !== "undefined") {
        const privateKey = await cryptoStore.getKey("privateKey");
        const deviceId = await cryptoStore.getDeviceId();

        if (!privateKey || !deviceId) {
          router.push("/setup-device");
        } else {
          setIsChecking(false);
        }
      }
    };

    checkDeviceSetup();
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
