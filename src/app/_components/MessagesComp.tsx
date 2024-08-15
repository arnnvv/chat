"use client";

import { Message, User } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { MutableRefObject, useRef, useState } from "react";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AvatarImage } from "@radix-ui/react-avatar";

export const MessagesComp = ({
  chatId,
  chatPartner,
  sessionImg,
  sessionId,
  initialMessages,
}: {
  chatId: string;
  chatPartner: User;
  sessionId: string;
  sessionImg: string | null | undefined;
  initialMessages: Message[];
}): JSX.Element => {
  const scrollRef: MutableRefObject<HTMLDivElement | null> =
    useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  return (
    <div
      id="messages"
      className="flex h-full flex-1 flex-col-reverse gap-4 p-3 overflow-y-auto scrollbar-thumb-blue scrollbar-thumb-rounded scrollbar-track-blue-lighter scrollbar-w-2 scrolling-touch"
    >
      <div ref={scrollRef} />
      {messages.map((message: Message, index: number): JSX.Element => {
        const isCurrentUser: boolean = message.senderId === sessionId;

        const hasNxtMessage: boolean =
          messages[index - 1]?.senderId === messages[index]?.senderId;
        return (
          <div
            key={`${message.id}-${message.createdAt}`}
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
                    src="https://github.com/arnnvv.png"
                    alt="@shadcn"
                  />
                  <AvatarFallback>
                    {chatPartner.name
                      ? chatPartner.name[0]
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
                    "px-4 py-2 rounded-lg inline-block",
                    isCurrentUser
                      ? "bg-cyan-500 text-white"
                      : "bg-gray-200 text-gray-900",
                    isCurrentUser && !hasNxtMessage && "rounded-br-none",
                    !isCurrentUser && !hasNxtMessage && "rounded-bl-none",
                  )}
                >
                  {message.content}{" "}
                  <span className="ml-2 text-xs text-gray-50">
                    {format(message.createdAt, "HH:mm")}
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
