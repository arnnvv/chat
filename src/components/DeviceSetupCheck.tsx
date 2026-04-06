"use client";

import { useRouter } from "next/navigation";
import { type JSX, type ReactNode, useEffect, useState } from "react";
import { getCurrentDeviceStateAction } from "@/actions";
import {
  refillOneTimePreKeysIfNeeded,
  rotateSignedPreKeyIfNeeded,
} from "@/lib/crypto/client";
import { sessionStore } from "@/lib/crypto/session-store";
import { cryptoStore } from "@/lib/crypto-store";
import { Spinner } from "./ui/spinner";

export function DeviceSetupCheck({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkDeviceSetup = async () => {
      try {
        const storedDeviceId = await cryptoStore.getDeviceId();
        const identityKeys = await sessionStore.getIdentityKeys();
        const activeSignedPreKey = await sessionStore.getActiveSignedPreKey();

        if (!storedDeviceId || !identityKeys || !activeSignedPreKey) {
          router.replace("/setup-device");
          return;
        }

        const deviceId = Number.parseInt(storedDeviceId, 10);
        if (!Number.isInteger(deviceId)) {
          router.replace("/setup-device");
          return;
        }

        const deviceState = await getCurrentDeviceStateAction(deviceId);
        if (!deviceState.success || deviceState.requiresUpgrade) {
          router.replace("/setup-device");
          return;
        }

        const localOneTimePreKeyCount =
          await sessionStore.countOneTimePreKeys();
        const knownPreKeyCount = Math.min(
          localOneTimePreKeyCount,
          deviceState.oneTimePreKeyCount ?? localOneTimePreKeyCount,
        );

        await rotateSignedPreKeyIfNeeded(
          deviceId,
          deviceState.activeSignedPreKey?.createdAt,
        );
        await refillOneTimePreKeysIfNeeded(deviceId, knownPreKeyCount);
      } catch {
        router.replace("/setup-device");
        return;
      }

      if (!cancelled) {
        setIsChecking(false);
      }
    };

    checkDeviceSetup();

    return () => {
      cancelled = true;
    };
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
