"use client";

import { Lock } from "lucide-react";
import { type JSX, useCallback, useEffect, useState } from "react";
import {
  decryptMessage,
  deriveSharedSecret,
  importPublicKey,
} from "@/lib/crypto";
import { cryptoStore } from "@/lib/crypto-store";
import type { Device, Message, User } from "@/lib/db/schema";

interface MessagePayload {
  senderDeviceId: number;
  recipients: Record<number, string>;
}

const isEncryptedPayload = (content: string): boolean => {
  try {
    const parsed = JSON.parse(content);
    return "senderDeviceId" in parsed && "recipients" in parsed;
  } catch (_e) {
    return false;
  }
};

export type UserWithDevices = User & {
  devices: Pick<Device, "id" | "publicKey">[];
};

const decryptionCache = new Map<string, string>();

export const RecentChatPreview = ({
  lastMessage,
  sessionUser,
  friend,
}: {
  lastMessage: Message;
  sessionUser: UserWithDevices;
  friend: UserWithDevices;
}): JSX.Element => {
  const [previewText, setPreviewText] = useState<string | JSX.Element>(
    "Loading message...",
  );

  const decryptPreview = useCallback(async () => {
    if (lastMessage.id === -1) {
      setPreviewText("No messages yet.");
      return;
    }

    const cacheKey = `${lastMessage.id}-${lastMessage.content}`;
    if (decryptionCache.has(cacheKey)) {
      setPreviewText(decryptionCache.get(cacheKey)!);
      return;
    }

    if (!isEncryptedPayload(lastMessage.content)) {
      setPreviewText(lastMessage.content);
      decryptionCache.set(cacheKey, lastMessage.content);
      return;
    }

    try {
      const payload: MessagePayload = JSON.parse(lastMessage.content);
      const myDeviceId = await cryptoStore.getDeviceId();
      const myPrivateKey = await cryptoStore.getKey("privateKey");

      if (!myDeviceId || !myPrivateKey) {
        throw new Error("Local device keys not found.");
      }

      const senderIsSelf = lastMessage.senderId === sessionUser.id;

      let partnerPublicKey: CryptoKey;
      let ciphertext: string;

      const ciphertextForThisDevice = payload.recipients[+myDeviceId];

      if (!ciphertextForThisDevice) {
        if (senderIsSelf) {
          const friendDeviceIds = Object.keys(payload.recipients);
          if (friendDeviceIds.length === 0) {
            throw new Error("No recipients in message payload.");
          }
          const friendDeviceId = friendDeviceIds[0];
          const friendDevice = friend.devices.find(
            (d) => d.id === Number(friendDeviceId),
          );

          if (!friendDevice?.publicKey) {
            throw new Error("Friend's device or public key not found.");
          }
          partnerPublicKey = await importPublicKey(friendDevice.publicKey);
          ciphertext = payload.recipients[Number(friendDeviceId)];
        } else {
          throw new Error("Message not encrypted for this device.");
        }
      } else {
        const senderDevice = friend.devices.find(
          (d) => d.id === payload.senderDeviceId,
        );
        if (!senderDevice?.publicKey) {
          throw new Error("Sender's device or public key not found.");
        }
        partnerPublicKey = await importPublicKey(senderDevice.publicKey);
        ciphertext = ciphertextForThisDevice;
      }

      const sharedKey = await deriveSharedSecret(
        myPrivateKey,
        partnerPublicKey,
      );
      const decrypted = await decryptMessage(sharedKey, ciphertext);

      setPreviewText(decrypted);
      decryptionCache.set(cacheKey, decrypted);
    } catch (_e) {
      const fallback = (
        <span className="flex items-center gap-1 text-gray-500 italic">
          <Lock className="w-4 h-4" />
          Encrypted Message
        </span>
      );
      setPreviewText(fallback);
      decryptionCache.set(cacheKey, "🔒 Encrypted Message");
    }
  }, [lastMessage, sessionUser, friend]);

  useEffect(() => {
    decryptPreview();
  }, [decryptPreview]);

  const isFromSelf =
    lastMessage.id !== -1 && lastMessage.senderId === sessionUser.id;

  return (
    <div>
      <h4 className="text-lg font-semibold">{friend.username}</h4>
      <p className="mt-1 max-w-md truncate">
        <span className="text-zinc-400">{isFromSelf ? "You: " : ""}</span>
        {previewText}
      </p>
    </div>
  );
};
