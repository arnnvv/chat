"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type JSX, useState, useTransition } from "react";
import { toast } from "sonner";
import { registerDeviceAction } from "@/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportPublicKey, generateX25519KeyPair } from "@/lib/crypto";
import { cryptoStore } from "@/lib/crypto-store";

export default function SetupDevicePage(): JSX.Element {
  const router = useRouter();
  const [deviceName, setDeviceName] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!deviceName.trim()) {
      toast.error("Please enter a name for your device.");
      return;
    }

    startTransition(async () => {
      try {
        const keyPair = await generateX25519KeyPair();
        const publicKeyB64 = await exportPublicKey(keyPair.publicKey);

        const result = await registerDeviceAction(publicKeyB64, deviceName);

        if (result.success) {
          const deviceId = result.message.split(": ")[1];
          if (!deviceId) {
            throw new Error("Could not retrieve device ID from server.");
          }

          await cryptoStore.saveKey("privateKey", keyPair.privateKey);
          await cryptoStore.saveDeviceId(deviceId);

          toast.success("Device setup complete!");

          router.push("/dashboard");
        } else {
          toast.error(result.message || "Failed to register device.");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred.";
        toast.error(`Device setup failed: ${errorMessage}`);
      }
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <KeyRound className="w-6 h-6" />
              Secure Device Setup
            </CardTitle>
            <CardDescription>
              To enable end-to-end encryption, we need to set up this device.
              Please give it a name you'll recognize.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="device-name">Device Name</Label>
              <Input
                id="device-name"
                name="device-name"
                placeholder="e.g., My MacBook Pro, Personal Phone"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                required
                disabled={isPending}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" isLoading={isPending}>
              {isPending ? "Securing..." : "Save and Continue"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
