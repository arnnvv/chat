"use client";

import { getRecipientDevices } from "@/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  decryptMessage,
  deriveSharedSecret,
  importPrivateKey,
  importPublicKey,
} from "@/lib/crypto";
import type { Message, User } from "@/lib/db/schema";
import { pusherClient } from "@/lib/pusher";
import { cn, toPusherKey } from "@/lib/utils";
import { format } from "date-fns";
import { type JSX, type RefObject, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface DecryptedMessage extends Message {
  decryptedContent: string | null;
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
  >(() => initialMessages.map((msg) => ({ ...msg, decryptedContent: null })));

  const cryptoKeysRef = useRef<{
    ownPrivateKey: CryptoKey | null;
    ownDeviceId: string | null;
    partnerPublicKeys: Map<number, CryptoKey>;
    isSetup: boolean;
  }>({
    ownPrivateKey: null,
    ownDeviceId: null,
    partnerPublicKeys: new Map(),
    isSetup: false,
  });

  const decryptMessageContent = async (message: Message): Promise<string> => {
    const { ownPrivateKey, ownDeviceId, partnerPublicKeys } =
      cryptoKeysRef.current;
    if (!ownPrivateKey || !ownDeviceId) return "[Key Error]";

    try {
      const payload = JSON.parse(message.content);
      const { senderDeviceId, recipients } = payload;
      const ownDeviceIdNum = parseInt(ownDeviceId, 10);
      const senderIsSelf = message.senderId === sessionId;

      if (senderIsSelf) {
        const anyRecipientIdStr = Object.keys(recipients)[0];
        if (!anyRecipientIdStr) return "[No Recipients]";
        const partnerPublicKey = partnerPublicKeys.get(
          parseInt(anyRecipientIdStr, 10),
        );
        if (!partnerPublicKey) return "[Partner Key Error]";
        const sharedKey = await deriveSharedSecret(
          ownPrivateKey,
          partnerPublicKey,
        );
        return await decryptMessage(sharedKey, recipients[anyRecipientIdStr]);
      } else {
        const encryptedForMe = recipients[ownDeviceIdNum];
        if (!encryptedForMe) return "[Not for this device]";
        const senderPublicKey = partnerPublicKeys.get(senderDeviceId);
        if (!senderPublicKey) return "[Sender Key Error]";
        const sharedKey = await deriveSharedSecret(
          ownPrivateKey,
          senderPublicKey,
        );
        return await decryptMessage(sharedKey, encryptedForMe);
      }
    } catch (_e) {
      return message.content;
    }
  };

  useEffect(() => {
    const setupAndDecrypt = async () => {
      try {
        if (cryptoKeysRef.current.isSetup) return;

        const privateKeyData = localStorage.getItem("privateKey");
        const deviceId = localStorage.getItem("deviceId");
        if (!privateKeyData || !deviceId)
          throw new Error("Local device keys not found.");

        cryptoKeysRef.current.ownPrivateKey =
          await importPrivateKey(privateKeyData);
        cryptoKeysRef.current.ownDeviceId = deviceId;

        const partnerDeviceList = await getRecipientDevices(chatPartner.id);
        await Promise.all(
          partnerDeviceList.map(async (device) => {
            const importedKey = await importPublicKey(device.publicKey);
            cryptoKeysRef.current.partnerPublicKeys.set(device.id, importedKey);
          }),
        );
        cryptoKeysRef.current.isSetup = true;

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
      }
    };

    setupAndDecrypt();
  }, [chatPartner.id, initialMessages, sessionId]);

  useEffect(() => {
    const pusherMessageHandler = async (message: Message) => {
      if (!cryptoKeysRef.current.isSetup) {
        console.warn("Pusher message received before crypto setup, ignoring.");
        return;
      }
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
                  {message.decryptedContent ?? "..."}{" "}
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
