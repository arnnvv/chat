"use client";

import { Lock } from "lucide-react";
import { type JSX, useEffect, useState } from "react";
import { decryptConversationMessage } from "@/lib/crypto/client";
import type { Message } from "@/lib/db/schema";
import type { UserWithDevices } from "@/lib/getFriends";

export const RecentChatPreview = ({
  lastMessage,
  sessionUser,
  friend,
}: {
  lastMessage: Message;
  sessionUser: UserWithDevices;
  friend: UserWithDevices;
}): JSX.Element => {
  const [previewText, setPreviewText] = useState<string | JSX.Element>(
    "Loading message...",
  );

  useEffect(() => {
    let cancelled = false;

    const decryptPreview = async () => {
      if (lastMessage.id === -1) {
        setPreviewText("No messages yet.");
        return;
      }

      try {
        const plaintext = await decryptConversationMessage({
          message: lastMessage,
          currentUserId: sessionUser.id,
          contact: friend,
        });

        if (!cancelled) {
          setPreviewText(plaintext);
        }
      } catch {
        if (!cancelled) {
          setPreviewText(
            <span className="flex items-center gap-1 text-gray-500 italic">
              <Lock className="w-4 h-4" />
              Encrypted Message
            </span>,
          );
        }
      }
    };

    decryptPreview();

    return () => {
      cancelled = true;
    };
  }, [friend, lastMessage, sessionUser.id]);

  const isFromSelf =
    lastMessage.id !== -1 && lastMessage.senderId === sessionUser.id;

  return (
    <div>
      <h4 className="text-lg font-semibold">{friend.username}</h4>
      <p className="mt-1 max-w-md truncate">
        <span className="text-zinc-400">{isFromSelf ? "You: " : ""}</span>
        {previewText}
      </p>
    </div>
  );
};
