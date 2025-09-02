"use client";

import { ShieldAlert } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { getVerifiedDeviceIdsForContact } from "@/actions";
import { ChatInput } from "@/components/ChatInput";
import { DeviceVerificationModal } from "@/components/DeviceVerificationModal";
import { MessagesComp } from "@/components/MessagesComp";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Device, Message } from "@/lib/db/schema";
import type { UserWithDevices } from "@/lib/getFriends";

interface ChatInterfaceProps {
  chatId: string;
  chatPartner: UserWithDevices;
  sessionUser: UserWithDevices;
  initialMessages: Message[];
  initialUnverifiedDevices: Pick<Device, "id" | "publicKey">[];
}

export default function ChatInterface({
  chatId,
  chatPartner,
  sessionUser,
  initialMessages,
  initialUnverifiedDevices,
}: ChatInterfaceProps): JSX.Element {
  const [unverifiedDevices, setUnverifiedDevices] = useState(
    initialUnverifiedDevices,
  );
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  const handleVerificationComplete = async () => {
    setShowVerificationModal(false);
    toast.info("Refreshing verification status...");
    const verifiedIds = await getVerifiedDeviceIdsForContact(chatPartner.id);
    setUnverifiedDevices(
      chatPartner.devices.filter((d) => !verifiedIds.includes(d.id)),
    );
  };

  return (
    <div className="flex-1 justify-between flex flex-col h-full max-h-[calc(100vh-6rem)]">
      {showVerificationModal && (
        <DeviceVerificationModal
          sessionUser={sessionUser}
          chatPartner={chatPartner}
          unverifiedDevices={unverifiedDevices}
          onVerificationComplete={handleVerificationComplete}
        />
      )}

      <div className="flex sm:items-center justify-between py-3 border-b-2 border-gray-200">
        <div className="relative flex items-center space-x-4">
          <div className="relative">
            <div className="relative w-8 sm:w-12 h-8 sm:h-12">
              <Avatar>
                <AvatarImage src={chatPartner.picture || ""} />
                <AvatarFallback>
                  {chatPartner.username
                    ? chatPartner.username[0]
                    : chatPartner.email[0]}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
          <div className="flex flex-col leading-tight">
            <div className="text-xl flex items-center">
              <span className="text-gray-700 mr-3 font-semibold">
                {chatPartner.username}
              </span>
            </div>
            <span className="text-sm text-gray-600">{chatPartner.email}</span>
          </div>
        </div>
      </div>

      {unverifiedDevices.length > 0 && (
        <div
          className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4"
          role="alert"
        >
          <p className="font-bold flex items-center gap-2">
            <ShieldAlert />
            Security Alert
          </p>
          <p>
            {chatPartner.username} has new, unverified devices.{" "}
            <button
              type="button"
              onClick={() => setShowVerificationModal(true)}
              className="font-bold underline ml-1 hover:text-yellow-800"
            >
              Verify their identity
            </button>{" "}
            to ensure your chat is secure.
          </p>
        </div>
      )}

      <MessagesComp
        chatId={chatId}
        chatPartner={chatPartner}
        sessionImg={sessionUser.picture}
        sessionId={sessionUser.id}
        initialMessages={initialMessages}
      />
      <ChatInput sender={sessionUser} receiver={chatPartner} />
    </div>
  );
}
