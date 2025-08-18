import { getCurrentSession, getPaginatedMessages } from "@/actions";
import { ChatInput } from "@/components/ChatInput";
import { MessagesComp } from "@/components/MessagesComp";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { db } from "@/lib/db";
import { type Message, type User, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { JSX } from "react";
import type { UserWithDevices } from "@/lib/getFriends";

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{
    chatId: string;
  }>;
}): Promise<Metadata> => {
  const { user } = await getCurrentSession();
  if (!user) return redirect("/login");
  const chatId = (await params).chatId;
  const [userIdd1, userIdd2] = chatId.split("--");
  const userId1 = Number(userIdd1);
  const userId2 = Number(userIdd2);
  const chatPartnerId = user.id === userId1 ? userId2 : userId1;
  const chatPartner: User | undefined = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, chatPartnerId),
  });

  return {
    title: "Chat Page",
    description: `Chat with ${chatPartner?.username || chatPartner?.email}`,
  };
};

export default async function l({
  params,
}: {
  params: Promise<{
    chatId: string;
  }>;
}): Promise<JSX.Element> {
  let initialMessages: Message[] = [];
  const { chatId } = await params;
  const { user } = await getCurrentSession();
  if (!user) return redirect("/login");
  const [userIdd1, userIdd2] = chatId.split("--");
  const userId1 = Number(userIdd1);
  const userId2 = Number(userIdd2);
  if (user.id !== userId1 && user.id !== userId2) notFound();
  const chatPartnerId: number = user.id === userId1 ? userId2 : userId1;

  const chatPartner: UserWithDevices | undefined =
    await db.query.users.findFirst({
      where: eq(users.id, chatPartnerId),
      with: {
        devices: {
          columns: {
            id: true,
            publicKey: true,
          },
        },
      },
    });

  if (!chatPartner) throw new Error("Chat partner not found");

  try {
    const { messages: initialBatch } = await getPaginatedMessages(chatId, null);
    initialMessages = initialBatch.reverse();
  } catch (e) {
    throw new Error(`Failed to fetch initial chat messages: ${e}`);
  }

  return (
    <div className="flex-1 justify-between flex flex-col h-full max-h-[calc(100vh-6rem)]">
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

      <MessagesComp
        chatId={chatId}
        chatPartner={chatPartner}
        sessionImg={user.picture}
        sessionId={user.id}
        initialMessages={initialMessages}
      />
      <ChatInput sender={user} receiver={chatPartner} />
    </div>
  );
}
