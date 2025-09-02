"use client";

import { usePathname, useRouter } from "next/navigation";
import { type JSX, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  decryptMessage,
  deriveSharedSecret,
  importPublicKey,
} from "@/lib/crypto";
import { cryptoStore } from "@/lib/crypto-store";
import type { UserWithDevices } from "@/lib/getFriends";
import { pusherClient } from "@/lib/pusher-client";
import { chatHrefConstructor, toPusherKey } from "@/lib/utils";
import { CustomToast } from "./CustomToast";

interface NotificationPayload {
  senderId: number;
  senderName: string;
  senderImage: string | null;
  chatId: string;
  senderDeviceId: number;
  encryptedPreviews: Record<number, string>;
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
  const pathname: string | null = usePathname();
  const router = useRouter();

  const cryptoKeysRef = useRef<{
    ownPrivateKey: CryptoKey | null;
    ownDeviceId: string | null;
  }>({
    ownPrivateKey: null,
    ownDeviceId: null,
  });

  useEffect(() => {
    const initializeCrypto = async () => {
      const privateKey = await cryptoStore.getKey("privateKey");
      const deviceId = await cryptoStore.getDeviceId();

      if (privateKey && deviceId) {
        cryptoKeysRef.current = {
          ownPrivateKey: privateKey,
          ownDeviceId: deviceId,
        };
      } else {
        console.error(
          "SidebarChatList: Crypto keys not found. Toasts will not be decrypted.",
        );
      }
    };
    initializeCrypto();

    const channelName = toPusherKey(`private-user:${sessionId}`);
    pusherClient.subscribe(channelName);

    const newMessageHandler = async (payload: NotificationPayload) => {
      const shouldNotify: boolean =
        pathname !== `/dashboard/chat/${payload.chatId}`;

      if (!shouldNotify) return;

      let decryptedContent = "You received an encrypted message.";
      const { ownPrivateKey, ownDeviceId } = cryptoKeysRef.current;

      if (ownPrivateKey && ownDeviceId) {
        try {
          const ciphertextForThisDevice =
            payload.encryptedPreviews[+ownDeviceId];

          if (!ciphertextForThisDevice) {
            decryptedContent = "New message (not for this device)";
          } else {
            const sender = activeChats.find(
              (friend) => friend.id === payload.senderId,
            );
            const senderDevice = sender?.devices.find(
              (d) => d.id === payload.senderDeviceId,
            );

            if (!senderDevice?.publicKey) {
              throw new Error("Sender public key not found for toast.");
            }

            const senderPublicKey = await importPublicKey(
              senderDevice.publicKey,
            );
            const sharedKey = await deriveSharedSecret(
              ownPrivateKey,
              senderPublicKey,
            );
            decryptedContent = await decryptMessage(
              sharedKey,
              ciphertextForThisDevice,
            );
          }
        } catch (e) {
          console.error("Failed to decrypt toast notification:", e);
        }
      }

      toast.custom(
        (t: any): JSX.Element => (
          <CustomToast
            t={t}
            href={`/dashboard/chat/${chatHrefConstructor(
              sessionId,
              payload.senderId,
            )}`}
            senderMessage={decryptedContent}
            senderName={payload.senderName}
            image={payload.senderImage}
          />
        ),
      );

      setUnseenMessagesCount((prev) => ({
        ...prev,
        [payload.senderId]: (prev[payload.senderId] || 0) + 1,
      }));
    };

    const newFriendHandler = (newFriend: UserWithDevices) => {
      setActiveChats((prev) => [...prev, newFriend]);
    };

    pusherClient.bind("new_message_notification", newMessageHandler);
    pusherClient.bind("new_friend", newFriendHandler);

    return () => {
      pusherClient.unsubscribe(channelName);
      pusherClient.unbind("new_message_notification", newMessageHandler);
      pusherClient.unbind("new_friend", newFriendHandler);
    };
  }, [sessionId, router, pathname, activeChats]);

  useEffect(() => {
    if (pathname?.includes("chat")) {
      const chatPartnerId = Number(
        pathname.split("--").find((id) => Number(id) !== sessionId),
      );
      if (chatPartnerId && unseenMessagesCount[chatPartnerId]) {
        setUnseenMessagesCount((prev) => {
          const newCounts = { ...prev };
          delete newCounts[chatPartnerId];
          return newCounts;
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
