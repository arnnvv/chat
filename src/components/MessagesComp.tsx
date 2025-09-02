"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getPaginatedMessages } from "@/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  decryptMessage,
  deriveSharedSecret,
  importPublicKey,
} from "@/lib/crypto";
import { cryptoStore } from "@/lib/crypto-store";
import type { Message } from "@/lib/db/schema";
import type { UserWithDevices } from "@/lib/getFriends";
import { pusherClient } from "@/lib/pusher-client";
import { cn, toPusherKey } from "@/lib/utils";

function ChatMessage({
  message,
  isCurrentUser,
  hasNxtMessage,
  chatPartner,
  sessionImg,
  measureElement,
}: {
  message: DecryptedMessage;
  isCurrentUser: boolean;
  hasNxtMessage: boolean;
  chatPartner: UserWithDevices;
  sessionImg: string | null | undefined;
  measureElement: (element: HTMLElement | null) => void;
}) {
  return (
    <div ref={measureElement} className="chat-message">
      <div
        className={cn(
          "flex items-end space-x-2",
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
                !isCurrentUser ? chatPartner.picture || "" : sessionImg || ""
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
}

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
  chatPartner: UserWithDevices;
  sessionId: number;
  sessionImg: string | null | undefined;
  initialMessages: Message[];
}): JSX.Element => {
  const parentRef = useRef<HTMLDivElement>(null);

  const [decryptedMessages, setDecryptedMessages] = useState<
    DecryptedMessage[]
  >(() => initialMessages.map((msg) => ({ ...msg, decryptedContent: null })));

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50);
  const cursorRef = useRef<string | null>(
    initialMessages.length > 0
      ? initialMessages[0].createdAt.toISOString()
      : null,
  );

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

  const decryptMessageContent = useCallback(
    async (message: Message): Promise<string> => {
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
    },
    [sessionId],
  );

  const fetchPrevious = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const { messages: newMessages, nextCursor } = await getPaginatedMessages(
        chatId,
        cursorRef.current,
      );
      cursorRef.current = nextCursor;
      setHasMore(nextCursor !== null);

      const decryptedNewMessages = await Promise.all(
        newMessages.map(async (msg) => ({
          ...msg,
          decryptedContent: await decryptMessageContent(msg),
        })),
      );

      setDecryptedMessages((prev) => [
        ...decryptedNewMessages.reverse(),
        ...prev,
      ]);
    } catch (_error) {
      toast.error("Failed to load older messages.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatId, hasMore, isLoadingMore, decryptMessageContent]);

  useEffect(() => {
    const setupAndDecrypt = async () => {
      try {
        if (cryptoKeysRef.current.isSetup) return;
        const privateKey = await cryptoStore.getKey("privateKey");
        const deviceId = await cryptoStore.getDeviceId();
        if (!privateKey || !deviceId)
          throw new Error("Local device keys not found.");
        cryptoKeysRef.current.ownPrivateKey = privateKey;
        cryptoKeysRef.current.ownDeviceId = deviceId;
        const partnerDeviceList = chatPartner.devices;
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
  }, [chatPartner.devices, initialMessages, decryptMessageContent]);

  const virtualizer = useVirtualizer({
    count: decryptedMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 75,
    overscan: 10,
    getItemKey: (index) => decryptedMessages[index]?.id,
    onChange: (instance) => {
      if (
        instance.getVirtualItems().length > 0 &&
        instance.getVirtualItems()[0]?.index === 0 &&
        hasMore &&
        !isLoadingMore
      ) {
        fetchPrevious();
      }
    },
  });

  useEffect(() => {
    if (virtualizer.getVirtualItems().length > 0) {
      virtualizer.scrollToIndex(decryptedMessages.length - 1, {
        align: "end",
      });
    }
  }, [virtualizer, decryptedMessages.length]);

  useEffect(() => {
    const pusherMessageHandler = async (message: Message) => {
      if (!cryptoKeysRef.current.isSetup) return;
      const decryptedContent = await decryptMessageContent(message);
      const parentEl = parentRef.current;
      const isAtBottom =
        parentEl &&
        parentEl.scrollHeight - parentEl.scrollTop - parentEl.clientHeight < 1;

      setDecryptedMessages((prev) => [
        ...prev,
        { ...message, decryptedContent },
      ]);

      if (isAtBottom) {
        virtualizer.scrollToIndex(decryptedMessages.length, { align: "end" });
      }
    };

    pusherClient.subscribe(toPusherKey(`private-chat:${chatId}`));
    pusherClient.bind("incoming-message", pusherMessageHandler);
    return () => {
      pusherClient.unsubscribe(toPusherKey(`private-chat:${chatId}`));
      pusherClient.unbind("incoming-message", pusherMessageHandler);
    };
  }, [chatId, decryptMessageContent, decryptedMessages.length, virtualizer]);

  return (
    <div
      ref={parentRef}
      id="messages"
      className="flex h-full flex-1 flex-col gap-4 p-3 overflow-y-auto scrollbar-thumb-blue scrollbar-thumb-rounded scrollbar-track-blue-lighter scrollbar-w-2 scrolling-touch"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {isLoadingMore && hasMore && (
          <div className="flex justify-center my-4">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const message = decryptedMessages[virtualRow.index];
          const isCurrentUser = message.senderId === sessionId;
          const hasNxtMessage =
            decryptedMessages[virtualRow.index - 1]?.senderId ===
            message.senderId;

          return (
            <div
              key={message.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <ChatMessage
                measureElement={virtualizer.measureElement}
                message={message}
                isCurrentUser={isCurrentUser}
                hasNxtMessage={hasNxtMessage}
                chatPartner={chatPartner}
                sessionImg={sessionImg}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
