"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type JSX, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getCurrentDeviceStateAction,
  publishKeyBundleAction,
  upgradeLegacyDeviceBundleAction,
} from "@/actions";
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
import {
  ed25519Sign,
  generateEd25519KeyPair,
  generateX25519KeyPair,
} from "@/lib/crypto/primitives";
import { generateKeyId, generateOneTimePreKeyBatch } from "@/lib/crypto/client";
import { sessionStore } from "@/lib/crypto/session-store";
import { cryptoStore } from "@/lib/crypto-store";
import { encodeBase64 } from "@/lib/encoding";

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
        const existingIdentityKeys = await sessionStore.getIdentityKeys();
        const previousSignedPreKey = await sessionStore.getActiveSignedPreKey();

        const signingKeyPair =
          existingIdentityKeys?.signingKeyPair ?? generateEd25519KeyPair();
        const identityDhKeyPair =
          existingIdentityKeys?.dhKeyPair ?? generateX25519KeyPair();
        const signedPreKeyId = generateKeyId();
        const signedPreKeyPair = generateX25519KeyPair();
        const signedPreKeySignature = ed25519Sign(
          signingKeyPair.privateKey,
          signedPreKeyPair.publicKey,
        );
        const oneTimePreKeys = generateOneTimePreKeyBatch();

        await sessionStore.saveIdentityKeys(signingKeyPair, identityDhKeyPair);
        if (previousSignedPreKey) {
          await sessionStore.markSignedPreKeyInactive(previousSignedPreKey.id);
        }
        await sessionStore.saveSignedPreKey(
          signedPreKeyId,
          signedPreKeyPair,
          signedPreKeySignature,
        );
        await sessionStore.replaceOneTimePreKeys(oneTimePreKeys);

        const existingDeviceId = await cryptoStore.getDeviceId();
        const parsedExistingDeviceId = existingDeviceId
          ? Number.parseInt(existingDeviceId, 10)
          : null;

        let resultingDeviceId: number | null = null;

        if (
          parsedExistingDeviceId &&
          Number.isInteger(parsedExistingDeviceId)
        ) {
          const deviceState = await getCurrentDeviceStateAction(
            parsedExistingDeviceId,
          );
          if (deviceState.success) {
            const upgradeResult = await upgradeLegacyDeviceBundleAction({
              deviceId: parsedExistingDeviceId,
              devicePublicKey: encodeBase64(identityDhKeyPair.publicKey),
              identitySigningPublicKey: encodeBase64(signingKeyPair.publicKey),
              signedPreKey: {
                keyId: signedPreKeyId,
                publicKey: encodeBase64(signedPreKeyPair.publicKey),
                signature: encodeBase64(signedPreKeySignature),
              },
              oneTimePreKeys: oneTimePreKeys.map((key) => ({
                keyId: key.id,
                publicKey: encodeBase64(key.keyPair.publicKey),
              })),
            });

            if (!upgradeResult.success) {
              throw new Error(upgradeResult.message);
            }

            resultingDeviceId = parsedExistingDeviceId;
          }
        }

        if (!resultingDeviceId) {
          const publishResult = await publishKeyBundleAction({
            devicePublicKey: encodeBase64(identityDhKeyPair.publicKey),
            identitySigningPublicKey: encodeBase64(signingKeyPair.publicKey),
            deviceName: deviceName.trim(),
            signedPreKey: {
              keyId: signedPreKeyId,
              publicKey: encodeBase64(signedPreKeyPair.publicKey),
              signature: encodeBase64(signedPreKeySignature),
            },
            oneTimePreKeys: oneTimePreKeys.map((key) => ({
              keyId: key.id,
              publicKey: encodeBase64(key.keyPair.publicKey),
            })),
          });

          if (!publishResult.success || !publishResult.deviceId) {
            throw new Error(
              publishResult.message || "Failed to publish key bundle.",
            );
          }

          resultingDeviceId = publishResult.deviceId;
        }

        await cryptoStore.saveDeviceId(String(resultingDeviceId));
        toast.success("Device setup complete.");
        router.push("/dashboard");
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
              This device needs an identity key, signed pre-key, and one-time
              pre-keys before it can participate in Signal-style encrypted
              messaging.
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
