"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Message, User } from "@/lib/db/schema";
import { pusherClient } from "@/lib/pusher";
import { chatHrefConstructor, toPusherKey } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CustomToast } from "./CustomToast";

interface ExtendedMessageProps extends Message {
  senderName: string;
}

export const SidebarChatList = ({
  sessionId,
  friends,
}: {
  sessionId: string;
  friends: User[];
}): JSX.Element => {
  const [unseenMessages, setUnseenMessages] = useState<Message[]>([]);
  const [activeChats, setActiveChats] = useState<User[]>(friends);
  const pathname: string | null = usePathname();
  const router = useRouter();

  useEffect((): (() => void) => {
    const chatHandler = (extendedMessage: ExtendedMessageProps) => {
      const shouldNotify: boolean =
        pathname !==
        `/dashboard/chat/${chatHrefConstructor(sessionId, extendedMessage.senderId)}`;

      if (!shouldNotify) return;

      toast.custom(
        (t: any): JSX.Element => (
          <CustomToast
            t={t}
            sessionId={sessionId}
            senderId={extendedMessage.senderId}
            senderMessage={extendedMessage.content}
            senderName={extendedMessage.senderName}
          />
        ),
      );

      setUnseenMessages((prev: Message[]): Message[] => [
        ...prev,
        extendedMessage,
      ]);
    };

    const newFriendHandler = (newFriend: User) => {
      setActiveChats((prev: User[]): User[] => [...prev, newFriend]);
    };

    pusherClient.subscribe(toPusherKey(`user:${sessionId}:chats`));

    pusherClient.subscribe(toPusherKey(`user:${sessionId}:friends`));

    pusherClient.bind("new_message", chatHandler);

    pusherClient.bind("new_friend", newFriendHandler);

    return () => {
      pusherClient.unsubscribe(toPusherKey(`user:${sessionId}:chats`));

      pusherClient.unsubscribe(toPusherKey(`user:${sessionId}:friends`));

      pusherClient.unbind("new_message", chatHandler);

      pusherClient.unbind("new_friend", newFriendHandler);
    };
  }, [sessionId, router, pathname]);

  useEffect((): void => {
    if (pathname?.includes("chat"))
      setUnseenMessages((prev: Message[]): Message[] =>
        prev.filter(
          (msg: Message): boolean => !pathname?.includes(msg.senderId),
        ),
      );
  }, [pathname]);

  return (
    <ul role="list" className="max-h-[25rem] overflow-y-auto -mx-2 space-y-1">
      {activeChats.sort().map((friend: User): JSX.Element => {
        const unseenMsgCount: number = unseenMessages.filter(
          (unseenMsg: Message): boolean => unseenMsg.senderId === friend.id,
        ).length;
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
                <AvatarImage
                  src="https://github.com/arnnvv.png"
                  alt="@shadcn"
                />
                <AvatarFallback>
                  {friend.name ? friend.name[0] : friend.email[0]}
                </AvatarFallback>
              </Avatar>
              {friend.name ? friend.name : friend.email}{" "}
              {unseenMsgCount > 0 && (
                <div className="border-r-cyan-400 font-medium text-xs w-4 h-4 rounded-full flex justify-center items-center bg-cyan-400 text-white">
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
