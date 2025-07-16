"use client";

import type { Message, User } from "@/lib/db/schema";
import type { JSX } from "react";
import { Lock } from "lucide-react";

const isEncryptedPayload = (content: string): boolean => {
  try {
    const parsed = JSON.parse(content);
    return "senderDeviceId" in parsed && "recipients" in parsed;
  } catch (e) {
    return false;
  }
};

export const RecentChatPreview = ({
  lastMessage,
  sessionUser,
  friend,
}: {
  lastMessage: Message;
  sessionUser: User;
  friend: User;
}): JSX.Element => {
  const isFromSelf = lastMessage.senderId === sessionUser.id;
  const contentIsEncrypted = isEncryptedPayload(lastMessage.content);

  let previewText: string | JSX.Element = lastMessage.content;

  if (contentIsEncrypted) {
    previewText = (
      <span className="flex items-center gap-1 text-gray-500 italic">
        <Lock className="w-4 h-4" />
        Encrypted Message
      </span>
    );
  } else if (lastMessage.content.trim() === "") {
    previewText = "No messages yet.";
  }

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
