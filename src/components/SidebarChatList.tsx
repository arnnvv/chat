"use client";

import { usePathname, useRouter } from "next/navigation";
import { type JSX, useEffect, useState } from "react";
import { toast } from "sonner";
import { pusherClient } from "@/lib/pusher";
import { chatHrefConstructor, toPusherKey } from "@/lib/utils";
import type { Message } from "@/lib/db/schema";
import {
  decryptMessage,
  deriveSharedSecret,
  importPrivateKey,
  importPublicKey,
} from "@/lib/crypto";
import type { UserWithDevices } from "@/lib/getFriends";
import { CustomToast } from "./CustomToast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ExtendedMessageProps extends Message {
  senderName: string;
  senderImage: string;
}

export const SidebarChatList = ({
  sessionId,
  friends,
}: {
  sessionId: number;
  friends: UserWithDevices[];
}): JSX.Element => {
  const [unseenMessages, setUnseenMessages] = useState<Message[]>([]);
  const [activeChats, setActiveChats] = useState<UserWithDevices[]>(friends);
  const pathname: string | null = usePathname();
  const router = useRouter();

  useEffect((): (() => void) => {
    const chatHandler = async (extendedMessage: ExtendedMessageProps) => {
      const shouldNotify: boolean =
        pathname !==
        `/dashboard/chat/${chatHrefConstructor(
          sessionId,
          extendedMessage.senderId,
        )}`;

      if (!shouldNotify) return;

      let decryptedContent = "[Encrypted Message]";
      try {
        const payload = JSON.parse(extendedMessage.content);
        const { senderDeviceId } = payload;

        const sender = activeChats.find(
          (friend) => friend.id === extendedMessage.senderId,
        );
        const senderDevice = sender?.devices.find(
          (d) => d.id === senderDeviceId,
        );

        const privateKeyData = localStorage.getItem("privateKey");

        if (senderDevice?.publicKey && privateKeyData) {
          const ownPrivateKey = await importPrivateKey(privateKeyData);
          const senderPublicKey = await importPublicKey(senderDevice.publicKey);
          const sharedKey = await deriveSharedSecret(
            ownPrivateKey,
            senderPublicKey,
          );

          const ownDeviceId = localStorage.getItem("deviceId");
          const encryptedForMe = payload.recipients[ownDeviceId!];

          if (encryptedForMe) {
            decryptedContent = await decryptMessage(sharedKey, encryptedForMe);
          }
        }
      } catch (e) {
        console.error("Failed to decrypt toast notification:", e);
        decryptedContent = "You received a new message.";
      }

      toast.custom(
        (t: any): JSX.Element => (
          <CustomToast
            t={t}
            href={`/dashboard/chat/${chatHrefConstructor(
              sessionId,
              extendedMessage.senderId,
            )}`}
            senderMessage={decryptedContent}
            senderName={extendedMessage.senderName}
            image={extendedMessage.senderImage}
          />
        ),
      );

      setUnseenMessages((prev: Message[]): Message[] => [
        ...prev,
        extendedMessage,
      ]);
    };

    const newFriendHandler = (newFriend: UserWithDevices) => {
      setActiveChats((prev: UserWithDevices[]): UserWithDevices[] => [
        ...prev,
        newFriend,
      ]);
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
  }, [sessionId, router, pathname, activeChats]);

  useEffect((): void => {
    if (pathname?.includes("chat"))
      setUnseenMessages((prev: Message[]): Message[] =>
        prev.filter(
          (msg: Message): boolean =>
            !pathname?.includes(msg.senderId.toString()),
        ),
      );
  }, [pathname]);

  return (
    <ul className="max-h-[25rem] overflow-y-auto -mx-2 space-y-1">
      {activeChats.sort().map((friend: UserWithDevices): JSX.Element => {
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
                <AvatarImage src={friend.picture || ""} />
                <AvatarFallback>
                  {friend.username ? friend.username[0] : friend.email[0]}
                </AvatarFallback>
              </Avatar>
              {friend.username ? friend.username : friend.email}{" "}
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
