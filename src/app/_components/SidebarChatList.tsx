"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Message, User } from "@/lib/db/schema";
import { chatHrefConstructor } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface SidebarChatListProps {
  friends: User[];
  sessionId: string;
}

interface ExtendedMessageProps extends Message {
  senderImg: string;
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
  const pathname: string | null = usePathname();
  useEffect((): void => {
    if (pathname?.includes("chat")) {
      setUnseenMessages((prev: Message[]): Message[] =>
        prev.filter(
          (msg: Message): boolean => !pathname?.includes(msg.senderId),
        ),
      );
    }
  }, [pathname]);

  return (
    <ul role="list" className="max-h-[25rem] overflow-y-auto -mx-2 space-y-1">
      {friends.sort().map((friend: User): JSX.Element => {
        const unseenMsgCount: number = unseenMessages.filter(
          (unseenMsg: Message): boolean => {
            return unseenMsg.senderId === friend.id;
          },
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
              {friend.name ? friend.name : friend.email}
              {unseenMsgCount > 0 && (
                <div className="border-r-cyan-400 font-medium text-white text-xs w-4 h-4 rounded-full flex justify-center items-center">
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
