"use client";

import type { Device, Message, User } from "@/lib/db/schema";
import { cn, toPusherKey } from "@/lib/utils";
import { type JSX, type RefObject, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { pusherClient } from "@/lib/pusher";
import {
  decryptMessage,
  deriveSharedSecret,
  importPrivateKey,
  importPublicKey,
} from "@/lib/crypto";
import { getRecipientDevices } from "@/actions";
import { toast } from "sonner";
import { Spinner } from "./ui/spinner";

interface DecryptedMessage extends Message {
  decryptedContent: string;
}

export const MessagesComp = ({
  chatId,
  chatPartner,
  sessionImg,
  sessionId,
  initialMessages,
}: {
  chatId: string;
  chatPartner: User;
  sessionId: number;
  sessionImg: string | null | undefined;
  initialMessages: Message[];
}): JSX.Element => {
  const scrollRef: RefObject<HTMLDivElement | null> = useRef(null);
  const [decryptedMessages, setDecryptedMessages] = useState<
    DecryptedMessage[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  const cryptoKeysRef = useRef<{
    ownPrivateKey: CryptoKey | null;
    ownDeviceId: string | null;
    ownPublicKeys: Map<number, CryptoKey>;
    partnerPublicKeys: Map<number, CryptoKey>;
  }>({
    ownPrivateKey: null,
    ownDeviceId: null,
    ownPublicKeys: new Map(),
    partnerPublicKeys: new Map(),
  });

  const decryptMessageContent = async (message: Message): Promise<string> => {
    const { ownPrivateKey, ownDeviceId, partnerPublicKeys, ownPublicKeys } =
      cryptoKeysRef.current;
    if (!ownPrivateKey || !ownDeviceId) return "[Decryption unavailable]";

    try {
      const payload = JSON.parse(message.content);
      const { senderDeviceId, recipients } = payload;
      const ownDeviceIdNum = parseInt(ownDeviceId, 10);

      const encryptedText = recipients[ownDeviceIdNum];
      if (!encryptedText) return "[Message not for this device]";

      const senderIsSelf = message.senderId === sessionId;
      const senderPublicKeyMap = senderIsSelf
        ? ownPublicKeys
        : partnerPublicKeys;
      const senderPublicKey = senderPublicKeyMap.get(senderDeviceId);

      if (!senderPublicKey) return "[Sender public key not found]";

      const sharedKey = await deriveSharedSecret(
        ownPrivateKey,
        senderPublicKey,
      );
      return await decryptMessage(sharedKey, encryptedText);
    } catch (e) {
      // Not a valid JSON or other error, return original content
      return message.content;
    }
  };

  useEffect(() => {
    const setupAndDecrypt = async () => {
      setIsLoading(true);
      try {
        const privateKeyData = localStorage.getItem("privateKey");
        const deviceId = localStorage.getItem("deviceId");
        if (!privateKeyData || !deviceId)
          throw new Error("Local device keys not found.");

        const ownPrivateKey = await importPrivateKey(privateKeyData);
        cryptoKeysRef.current.ownPrivateKey = ownPrivateKey;
        cryptoKeysRef.current.ownDeviceId = deviceId;

        const [ownDeviceList, partnerDeviceList] = await Promise.all([
          getRecipientDevices(sessionId),
          getRecipientDevices(chatPartner.id),
        ]);

        for (const device of ownDeviceList) {
          cryptoKeysRef.current.ownPublicKeys.set(
            device.id,
            await importPublicKey(device.publicKey),
          );
        }
        for (const device of partnerDeviceList) {
          cryptoKeysRef.current.partnerPublicKeys.set(
            device.id,
            await importPublicKey(device.publicKey),
          );
        }

        const newlyDecrypted = await Promise.all(
          initialMessages.map(async (msg) => ({
            ...msg,
            decryptedContent: await decryptMessageContent(msg),
          })),
        );

        setDecryptedMessages(newlyDecrypted);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to set up secure session.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    setupAndDecrypt();
  }, [initialMessages, chatPartner.id, sessionId]);

  useEffect(() => {
    const pusherMessageHandler = async (message: Message) => {
      const decryptedContent = await decryptMessageContent(message);
      setDecryptedMessages((prev) => [
        { ...message, decryptedContent },
        ...prev,
      ]);
    };

    pusherClient.subscribe(toPusherKey(`chat:${chatId}`));
    pusherClient.bind("incoming-message", pusherMessageHandler);

    return () => {
      pusherClient.unsubscribe(toPusherKey(`chat:${chatId}`));
      pusherClient.unbind("incoming-message", pusherMessageHandler);
    };
  }, [chatId, sessionId]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Spinner />
        <p className="ml-2">Decrypting messages...</p>
      </div>
    );
  }

  return (
    <div
      id="messages"
      className="flex h-full flex-1 flex-col-reverse gap-4 p-3 overflow-y-auto scrollbar-thumb-blue scrollbar-thumb-rounded scrollbar-track-blue-lighter scrollbar-w-2 scrolling-touch"
    >
      <div ref={scrollRef} />
      {decryptedMessages.map((message: DecryptedMessage, index: number) => {
        const isCurrentUser = message.senderId === sessionId;
        const hasNxtMessage =
          decryptedMessages[index - 1]?.senderId ===
          decryptedMessages[index]?.senderId;
        return (
          <div
            key={`${message.id}-${message.createdAt.toString()}`}
            className="chat-message"
          >
            <div
              className={cn(
                "flex items-start space-x-2",
                isCurrentUser && "justify-end space-x-reverse",
              )}
            >
              <div
                className={cn("flex-shrink-0", {
                  "order-2": isCurrentUser,
                  "order-1": !isCurrentUser,
                  invisible: hasNxtMessage,
                })}
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage
                    src={
                      !isCurrentUser
                        ? chatPartner.picture || ""
                        : sessionImg || ""
                    }
                  />
                  <AvatarFallback>
                    {chatPartner.username
                      ? chatPartner.username[0]
                      : chatPartner.email[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div
                className={cn(
                  "flex flex-col space-y-2 text-base max-w-md",
                  isCurrentUser ? "order-1" : "order-2",
                )}
              >
                <span
                  className={cn(
                    "px-4 py-2 rounded-lg inline-block break-words",
                    isCurrentUser
                      ? "bg-cyan-500 text-white"
                      : "bg-gray-200 text-gray-900",
                    isCurrentUser && !hasNxtMessage && "rounded-br-none",
                    !isCurrentUser && !hasNxtMessage && "rounded-bl-none",
                  )}
                >
                  {message.decryptedContent}{" "}
                  <span className="ml-2 text-xs text-gray-400">
                    {format(new Date(message.createdAt), "HH:mm")}
                  </span>
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
