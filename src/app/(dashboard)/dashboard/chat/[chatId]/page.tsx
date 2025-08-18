"use client";

import { useEffect, useState } from "react";
import { notFound, redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import type { JSX } from "react";
import type { Message, Device } from "@/lib/db/schema";
import type { UserWithDevices } from "@/lib/getFriends";
import {
  getCurrentSession,
  getPaginatedMessages,
  getVerifiedDeviceIdsForContact,
} from "@/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessagesComp } from "@/components/MessagesComp";
import { ChatInput } from "@/components/ChatInput";
import { DeviceVerificationModal } from "@/components/DeviceVerificationModal";
import Load from "./loading";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { users } from "@/lib/db/schema";

export default function Page({
  params,
}: {
  params: Promise<{
    chatId: string;
  }>;
}): JSX.Element {
  const [chatPartner, setChatPartner] = useState<UserWithDevices | null>(null);
  const [sessionUser, setSessionUser] = useState<UserWithDevices | null>(null);
  const [unverifiedDevices, setUnverifiedDevices] = useState<
    Pick<Device, "id" | "publicKey">[]
  >([]);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chatId, setChatId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resolvedParams = await params;
        const currentChatId = resolvedParams.chatId;
        setChatId(currentChatId);

        const { user: session } = await getCurrentSession();
        if (!session) {
          redirect("/login");
        }

        const [userId1, userId2] = currentChatId.split("--").map(Number);
        if (session.id !== userId1 && session.id !== userId2) {
          notFound();
        }

        const chatPartnerId = session.id === userId1 ? userId2 : userId1;

        const [
          partnerData,
          sessionData,
          verifiedIds,
          { messages: initialBatch },
        ] = await Promise.all([
          db.query.users.findFirst({
            where: eq(users.id, chatPartnerId),
            with: { devices: { columns: { id: true, publicKey: true } } },
          }),
          db.query.users.findFirst({
            where: eq(users.id, session.id),
            with: { devices: { columns: { id: true, publicKey: true } } },
          }),
          getVerifiedDeviceIdsForContact(chatPartnerId),
          getPaginatedMessages(currentChatId, null),
        ]);

        if (!partnerData || !sessionData) {
          notFound();
        }

        setChatPartner(partnerData);
        setSessionUser(sessionData);
        setUnverifiedDevices(
          partnerData.devices.filter((d) => !verifiedIds.includes(d.id)),
        );
        setInitialMessages(initialBatch.reverse());
      } catch (error) {
        console.error("Failed to load chat data:", error);
        toast.error("Could not load chat. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [params]);

  const handleVerificationComplete = async () => {
    setShowVerificationModal(false);
    if (chatPartner) {
      toast.info("Refreshing verification status...");
      const verifiedIds = await getVerifiedDeviceIdsForContact(chatPartner.id);
      setUnverifiedDevices(
        chatPartner.devices.filter((d) => !verifiedIds.includes(d.id)),
      );
    }
  };

  if (isLoading || !chatPartner || !sessionUser || !chatId) {
    return <Load />;
  }

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
            {chatPartner.username} has new, unverified devices.
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
