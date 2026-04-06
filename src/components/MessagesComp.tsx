"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getPaginatedMessages } from "@/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { decryptConversationMessage } from "@/lib/crypto/client";
import type { Message } from "@/lib/db/schema";
import type { UserWithDevices } from "@/lib/getFriends";
import { pusherClient } from "@/lib/pusher-client";
import { cn, toPusherKey } from "@/lib/utils";

interface IncomingChatMessage extends Message {
  senderName?: string;
  senderImage?: string | null;
}

interface PendingSentMessageEventDetail {
  message: Message;
  plaintext: string;
}

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

function mergeMessage(
  current: DecryptedMessage[],
  nextMessage: DecryptedMessage,
): DecryptedMessage[] {
  const existingIndex = current.findIndex(
    (message) => message.id === nextMessage.id,
  );
  if (existingIndex === -1) {
    return [...current, nextMessage];
  }

  return current.map((message, index) =>
    index === existingIndex ? nextMessage : message,
  );
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

  const decryptSingleMessage = useCallback(
    async (message: Message): Promise<DecryptedMessage> => {
      try {
        return {
          ...message,
          decryptedContent: await decryptConversationMessage({
            message,
            currentUserId: sessionId,
            contact: chatPartner,
          }),
        };
      } catch {
        return {
          ...message,
          decryptedContent: "[Encrypted message]",
        };
      }
    },
    [chatPartner, sessionId],
  );

  const fetchPrevious = useCallback(async () => {
    if (isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const { messages: newMessages, nextCursor } = await getPaginatedMessages(
        chatId,
        cursorRef.current,
      );
      cursorRef.current = nextCursor;
      setHasMore(nextCursor !== null);

      const decryptedNewMessages = await Promise.all(
        newMessages.map(decryptSingleMessage),
      );

      setDecryptedMessages((prev) => [
        ...decryptedNewMessages.reverse(),
        ...prev,
      ]);
    } catch {
      toast.error("Failed to load older messages.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatId, decryptSingleMessage, hasMore, isLoadingMore]);

  useEffect(() => {
    let cancelled = false;

    const decryptInitialMessages = async () => {
      const nextMessages = await Promise.all(
        initialMessages.map(decryptSingleMessage),
      );

      if (!cancelled) {
        setDecryptedMessages(nextMessages);
      }
    };

    decryptInitialMessages();

    return () => {
      cancelled = true;
    };
  }, [decryptSingleMessage, initialMessages]);

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
    const pusherMessageHandler = async (message: IncomingChatMessage) => {
      const decrypted = await decryptSingleMessage(message);
      const parentEl = parentRef.current;
      const isAtBottom =
        parentEl &&
        parentEl.scrollHeight - parentEl.scrollTop - parentEl.clientHeight < 1;

      setDecryptedMessages((prev) => mergeMessage(prev, decrypted));

      if (isAtBottom) {
        virtualizer.scrollToIndex(decryptedMessages.length, { align: "end" });
      }
    };

    const pendingMessageHandler = (event: Event): void => {
      const customEvent = event as CustomEvent<PendingSentMessageEventDetail>;
      setDecryptedMessages((prev) =>
        mergeMessage(prev, {
          ...customEvent.detail.message,
          decryptedContent: customEvent.detail.plaintext,
        }),
      );
    };

    const channelName = toPusherKey(`private-chat:${chatId}`);
    pusherClient.subscribe(channelName);
    pusherClient.bind("incoming-message", pusherMessageHandler);
    window.addEventListener(
      "chat:message-sent",
      pendingMessageHandler as EventListener,
    );

    return () => {
      pusherClient.unsubscribe(channelName);
      pusherClient.unbind("incoming-message", pusherMessageHandler);
      window.removeEventListener(
        "chat:message-sent",
        pendingMessageHandler as EventListener,
      );
    };
  }, [chatId, decryptSingleMessage, decryptedMessages.length, virtualizer]);

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
