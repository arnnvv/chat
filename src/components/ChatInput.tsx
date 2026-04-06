"use client";

import {
  type ChangeEvent,
  type JSX,
  type KeyboardEvent,
  type Ref,
  type RefObject,
  useRef,
  useState,
} from "react";
import ReactTextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";
import {
  fetchKeyBundleAction,
  getVerifiedDeviceIdsForContact,
  sendMessageAction,
} from "@/actions";
import { Button } from "@/components/ui/button";
import { cachePlaintextForMessage, encodePlaintext } from "@/lib/crypto/client";
import {
  initRatchetAsInitiator,
  ratchetEncrypt,
} from "@/lib/crypto/double-ratchet";
import { sessionStore } from "@/lib/crypto/session-store";
import { envelopeToTransport } from "@/lib/crypto/wire-format";
import { initiateX3DH } from "@/lib/crypto/x3dh";
import { cryptoStore } from "@/lib/crypto-store";
import type { Message } from "@/lib/db/schema";
import { decodeBase64, encodeBase64 } from "@/lib/encoding";
import type { UserWithDevices } from "@/lib/getFriends";

interface PendingSentMessageEventDetail {
  message: Message;
  plaintext: string;
}

function emitPendingSentMessage(detail: PendingSentMessageEventDetail): void {
  window.dispatchEvent(
    new CustomEvent<PendingSentMessageEventDetail>("chat:message-sent", {
      detail,
    }),
  );
}

async function encryptForDevice(
  remoteDeviceId: number,
  plaintext: Uint8Array,
): Promise<{
  payload: ReturnType<typeof envelopeToTransport>;
}> {
  const identityKeys = await sessionStore.getIdentityKeys();
  if (!identityKeys) {
    throw new Error("Identity keys are unavailable on this device.");
  }

  let session = await sessionStore.getSession(remoteDeviceId);
  let x3dh:
    | {
        senderIdentityDHKey: string;
        senderEphemeralKey: string;
        usedSignedPreKeyId: number;
        usedOneTimePreKeyId?: number;
      }
    | undefined;

  if (!session) {
    const bundleResult = await fetchKeyBundleAction(remoteDeviceId);
    if (!bundleResult.success || !bundleResult.bundle) {
      throw new Error(
        bundleResult.error ?? "Failed to fetch recipient bundle.",
      );
    }

    const bundle = bundleResult.bundle;
    const x3dhResult = await initiateX3DH(
      identityKeys.dhKeyPair.privateKey,
      identityKeys.dhKeyPair.publicKey,
      {
        identityKey: decodeBase64(bundle.identitySigningKey),
        identityDHKey: decodeBase64(bundle.identityDHKey),
        signedPreKey: decodeBase64(bundle.signedPreKey.publicKey),
        signedPreKeySig: decodeBase64(bundle.signedPreKey.signature),
        signedPreKeyId: bundle.signedPreKey.keyId,
        ...(bundle.oneTimePreKey
          ? {
              oneTimePreKey: decodeBase64(bundle.oneTimePreKey.publicKey),
              oneTimePreKeyId: bundle.oneTimePreKey.keyId,
            }
          : {}),
      },
    );

    session = initRatchetAsInitiator(
      x3dhResult.sharedSecret,
      decodeBase64(bundle.signedPreKey.publicKey),
      remoteDeviceId,
    );

    x3dh = {
      senderIdentityDHKey: encodeBase64(identityKeys.dhKeyPair.publicKey),
      senderEphemeralKey: encodeBase64(x3dhResult.ephemeralPublicKey),
      usedSignedPreKeyId: x3dhResult.usedSignedPreKeyId,
      ...(x3dhResult.usedOneTimePreKeyId !== undefined
        ? { usedOneTimePreKeyId: x3dhResult.usedOneTimePreKeyId }
        : {}),
    };
  }

  const encrypted = await ratchetEncrypt(session, plaintext);
  await sessionStore.saveSession(remoteDeviceId, encrypted.session);

  return {
    payload: envelopeToTransport(encrypted.envelope, x3dh),
  };
}

export const ChatInput = ({
  sender,
  receiver,
}: {
  sender: UserWithDevices;
  receiver: UserWithDevices;
}): JSX.Element => {
  const textareaRef: RefObject<HTMLTextAreaElement | null> =
    useRef<HTMLTextAreaElement | null>(null);

  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const sendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      toast.error("Cannot send an empty message.");
      return;
    }

    setIsLoading(true);

    try {
      const senderDeviceIdValue = await cryptoStore.getDeviceId();
      if (!senderDeviceIdValue) {
        throw new Error(
          "This device is not registered for encrypted messaging.",
        );
      }

      const senderDeviceId = Number.parseInt(senderDeviceIdValue, 10);
      if (!Number.isInteger(senderDeviceId)) {
        throw new Error("Stored device ID is invalid.");
      }

      const identityKeys = await sessionStore.getIdentityKeys();
      if (!identityKeys) {
        throw new Error(
          "Your Signal key bundle is not available on this device. Set the device up again.",
        );
      }

      const verifiedRecipientDeviceIds = await getVerifiedDeviceIdsForContact(
        receiver.id,
      );

      const verifiedRecipientDevices = receiver.devices.filter(
        (device) =>
          verifiedRecipientDeviceIds.includes(device.id) &&
          device.identitySigningPublicKey.length > 0,
      );

      if (verifiedRecipientDevices.length === 0) {
        throw new Error(
          `You have not verified any of ${receiver.username}'s Signal-capable devices.`,
        );
      }

      const senderOtherDevices = sender.devices.filter(
        (device) =>
          device.id !== senderDeviceId &&
          device.identitySigningPublicKey.length > 0,
      );

      const targetDeviceIds = Array.from(
        new Set(
          [...verifiedRecipientDevices, ...senderOtherDevices].map(
            (device) => device.id,
          ),
        ),
      );

      const plaintext = encodePlaintext(trimmedInput);
      const recipients = Object.fromEntries(
        await Promise.all(
          targetDeviceIds.map(async (deviceId) => {
            const encrypted = await encryptForDevice(deviceId, plaintext);
            return [deviceId, encrypted.payload] as const;
          }),
        ),
      );

      const response = await sendMessageAction({
        senderDeviceId,
        receiverId: receiver.id,
        payload: {
          v: 2,
          senderDeviceId,
          recipients,
        },
        protocolVersion: 2,
      });

      if (!response || response.error) {
        throw new Error(response?.error ?? "Failed to send message.");
      }

      if (!response.sentMessage) {
        throw new Error("The server did not return the stored message.");
      }

      await cachePlaintextForMessage(response.sentMessage.id, trimmedInput, 2);
      emitPendingSentMessage({
        message: response.sentMessage,
        plaintext: trimmedInput,
      });

      setInput("");
      textareaRef.current?.focus();
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "An unknown error occurred.";
      toast.error(`Failed to send message: ${errorMessage}`, {
        id: "message-error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border-t border-gray-200 px-4 pt-4 mb-2 sm:mb-0">
      <div className="relative flex-1 overflow-hidden rounded-lg shadow-sm ring-1 ring-inset ring-gray-300 focus-within:ring-2 focus-within:ring-cyan-400">
        <ReactTextareaAutosize
          ref={textareaRef as Ref<HTMLTextAreaElement>}
          onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          rows={1}
          value={input}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            setInput(e.target.value)
          }
          placeholder={`Message ${receiver.username}`}
          className="block w-full resize-none border-0 bg-transparent text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:py-1.5 sm:text-sm sm:leading-6"
        />

        <div
          onClick={(): void => textareaRef.current?.focus()}
          className="py-2"
          aria-hidden="true"
        >
          <div className="py-px">
            <div className="h-9" />
          </div>
        </div>

        <div className="absolute right-0 bottom-0 flex justify-between py-2 pl-3 pr-2">
          <div className="flex-shrin-0">
            <Button isLoading={isLoading} onClick={sendMessage} type="submit">
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
