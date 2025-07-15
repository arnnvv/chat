"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateX25519KeyPair,
  exportPublicKey,
  exportPrivateKey,
} from "@/lib/crypto";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { LockKeyhole } from "lucide-react";
import { registerDeviceAction } from "@/actions";

export default function SetupDevicePage() {
  const router = useRouter();
  const [status, setStatus] = useState("Preparing secure setup...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    (async () => {
      try {
        const existingPrivateKey = localStorage.getItem("privateKey");
        if (existingPrivateKey) {
          setStatus("Secure keys already found. You're all set!");
          toast.info("This device is already set up for encryption.");
          setTimeout(() => router.push("/dashboard"), 1500);
          return;
        }

        setStatus("Generating your unique encryption keys...");
        const keyPair = await generateX25519KeyPair();

        setStatus("Saving your private key securely on this device...");
        const privateKeyData = await exportPrivateKey(keyPair.privateKey);
        localStorage.setItem("privateKey", privateKeyData);

        const publicKeyData = await exportPublicKey(keyPair.publicKey);
        localStorage.setItem("publicKey", publicKeyData);

        setStatus("Registering your device with your account...");
        const deviceName = `${navigator.vendor || "Unknown"} on ${
          navigator.platform || "Unknown OS"
        }`;
        const result = await registerDeviceAction(publicKeyData, deviceName);

        if (result.success && result.message.includes("ID:")) {
          const deviceId = result.message.split(":").pop()?.trim();
          if (deviceId) {
            localStorage.setItem("deviceId", deviceId);
            toast.success("Device registered successfully!");
            setStatus("Setup complete! Redirecting to your dashboard...");
            setTimeout(() => router.push("/dashboard"), 1500);
          } else {
            throw new Error("Failed to retrieve device ID from server.");
          }
        } else {
          throw new Error(
            result.message || "Server failed to register device.",
          );
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred";
        console.error("Encryption setup failed:", err);
        toast.error(`Setup failed: ${errorMessage}`);
        setError(`Error: ${errorMessage}. Please refresh to try again.`);
        localStorage.removeItem("privateKey");
        localStorage.removeItem("publicKey");
        localStorage.removeItem("deviceId");
      }
    })();
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="text-center max-w-lg">
        <LockKeyhole className="mx-auto h-12 w-12 text-cyan-500 mb-4" />
        <h1 className="text-3xl font-bold mb-4">Securing Your New Device</h1>
        <p className="mb-6 text-muted-foreground">
          We're creating a unique set of cryptographic keys for this device.
          This is a one-time setup to ensure your conversations remain private
          and secure.
        </p>
        <div className="flex items-center justify-center space-x-3 p-4 bg-secondary rounded-lg">
          {!error && <Spinner />}
          <p className="text-lg text-secondary-foreground">{error || status}</p>
        </div>
        {!error && (
          <p className="mt-4 text-sm text-gray-500">
            Please don't close this page. This should only take a moment.
          </p>
        )}
      </div>
    </div>
  );
}
