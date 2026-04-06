"use client";

import { usePathname } from "next/navigation";
import { type JSX, useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { decryptConversationMessage } from "@/lib/crypto/client";
import { cryptoStore } from "@/lib/crypto-store";
import type { Message } from "@/lib/db/schema";
import type { UserWithDevices } from "@/lib/getFriends";
import { pusherClient } from "@/lib/pusher-client";
import { parseStoredMessagePayload } from "@/lib/crypto/wire-format";
import { chatHrefConstructor, toPusherKey } from "@/lib/utils";
import { CustomToast } from "./CustomToast";

interface NotificationPayload {
  chatId: string;
  contactId: number;
  contactName: string;
  contactImage: string | null;
  message: Message & {
    senderName?: string;
    senderImage?: string | null;
  };
}

export const SidebarChatList = ({
  sessionId,
  friends,
}: {
  sessionId: number;
  friends: UserWithDevices[];
}): JSX.Element => {
  const [unseenMessagesCount, setUnseenMessagesCount] = useState<
    Record<number, number>
  >({});
  const [activeChats, setActiveChats] = useState<UserWithDevices[]>(friends);
  const [ownDeviceId, setOwnDeviceId] = useState<number | null>(null);
  const pathname: string | null = usePathname();

  useEffect(() => {
    setActiveChats(friends);
  }, [friends]);

  useEffect(() => {
    const loadDeviceId = async () => {
      const storedDeviceId = await cryptoStore.getDeviceId();
      if (!storedDeviceId) {
        return;
      }

      const parsedDeviceId = Number.parseInt(storedDeviceId, 10);
      if (Number.isInteger(parsedDeviceId)) {
        setOwnDeviceId(parsedDeviceId);
      }
    };

    loadDeviceId();
  }, []);

  useEffect(() => {
    const channelName = toPusherKey(`private-user:${sessionId}`);
    pusherClient.subscribe(channelName);

    const newMessageHandler = async (payload: NotificationPayload) => {
      const parsedPayload = parseStoredMessagePayload(payload.message.content);
      const senderDeviceId =
        parsedPayload && "senderDeviceId" in parsedPayload
          ? parsedPayload.senderDeviceId
          : null;

      if (
        ownDeviceId !== null &&
        payload.message.senderId === sessionId &&
        senderDeviceId === ownDeviceId
      ) {
        return;
      }

      const shouldNotify = pathname !== `/dashboard/chat/${payload.chatId}`;
      const contact = activeChats.find(
        (friend) => friend.id === payload.contactId,
      );

      let decryptedContent = "You received an encrypted message.";
      if (contact) {
        try {
          decryptedContent = await decryptConversationMessage({
            message: payload.message,
            currentUserId: sessionId,
            contact,
          });
        } catch {
          decryptedContent = "You received an encrypted message.";
        }
      }

      if (shouldNotify) {
        toast.custom(
          (t: any): JSX.Element => (
            <CustomToast
              t={t}
              href={`/dashboard/chat/${payload.chatId}`}
              senderMessage={decryptedContent}
              senderName={payload.contactName}
              image={payload.contactImage}
            />
          ),
        );

        setUnseenMessagesCount((prev) => ({
          ...prev,
          [payload.contactId]: (prev[payload.contactId] || 0) + 1,
        }));
      }
    };

    const newFriendHandler = (newFriend: UserWithDevices) => {
      setActiveChats((prev) => {
        const existing = prev.some((friend) => friend.id === newFriend.id);
        return existing ? prev : [...prev, newFriend];
      });
    };

    pusherClient.bind("new_message_notification", newMessageHandler);
    pusherClient.bind("new_friend", newFriendHandler);

    return () => {
      pusherClient.unsubscribe(channelName);
      pusherClient.unbind("new_message_notification", newMessageHandler);
      pusherClient.unbind("new_friend", newFriendHandler);
    };
  }, [activeChats, ownDeviceId, pathname, sessionId]);

  useEffect(() => {
    if (pathname?.includes("chat")) {
      const chatPartnerId = Number(
        pathname.split("--").find((id) => Number(id) !== sessionId),
      );
      if (chatPartnerId && unseenMessagesCount[chatPartnerId]) {
        setUnseenMessagesCount((prev) => {
          const nextCounts = { ...prev };
          delete nextCounts[chatPartnerId];
          return nextCounts;
        });
      }
    }
  }, [pathname, sessionId, unseenMessagesCount]);

  return (
    <ul className="max-h-[25rem] overflow-y-auto -mx-2 space-y-1">
      {activeChats
        .sort((a, b) => a.username.localeCompare(b.username))
        .map((friend) => {
          const unseenMsgCount = unseenMessagesCount[friend.id] || 0;
          return (
            <li key={friend.id}>
              <a
                href={`/dashboard/chat/${chatHrefConstructor(
                  sessionId,
                  friend.id,
                )}`}
                className="text-gray-700 hover:text-cyan-400 hover:bg-gray-50 group flex items-center gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
              >
                <Avatar>
                  <AvatarImage src={friend.picture || ""} />
                  <AvatarFallback>
                    {friend.username ? friend.username[0] : friend.email[0]}
                  </AvatarFallback>
                </Avatar>
                {friend.username ? friend.username : friend.email}{" "}
                {unseenMsgCount > 0 && (
                  <div className="border-r-cyan-400 font-medium text-xs w-5 h-5 rounded-full flex justify-center items-center bg-cyan-400 text-white">
                    {unseenMsgCount}
                  </div>
                )}
              </a>
            </li>
          );
        })}
    </ul>
  );
};
