import { getCurrentSession } from "@/actions";
import { ChatInput } from "@/components/ChatInput";
import { MessagesComp } from "@/components/MessagesComp";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { db } from "@/lib/db";
import { Message, messages, User, users } from "@/lib/db/schema";
import { validateMessages } from "@/lib/validate";
import { and, eq, or } from "drizzle-orm";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { JSX } from "react";

export const generateMetadata = async ({
  params,
}: {
  params: {
    chatId: string;
  };
}): Promise<Metadata> => {
  const { user } = await getCurrentSession();
  if (!user) return redirect("/login");
  const [userId1, userId2] = params.chatId.split("--");
  const chatPartnerId = user.id === userId1 ? userId2 : userId1;
  const chatPartner: User | undefined = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, chatPartnerId),
  });

  return {
    title: "Chat Page",
    description: `Chat with ${chatPartner?.name || chatPartner?.email}`,
  };
};

export default async function l({
  params,
}: {
  params: { chatId: string };
}): Promise<JSX.Element> {
  let initialMessages: Message[] = [];
  const { chatId } = params;
  const { user } = await getCurrentSession();
  if (!user) return redirect("/login");
  const [userId1, userId2] = chatId.split("--");
  if (user.id !== userId1 && user.id !== userId2) notFound();
  const chatPartnerId: string = user.id === userId1 ? userId2 : userId1;

  const chatPartner: User | undefined = await db.query.users.findFirst({
    where: eq(users.id, chatPartnerId),
  });

  if (!chatPartner) throw new Error("Chat partner not found");

  try {
    if (!user.id || !chatPartner.id) throw new Error("Invalid chat id");
    const chatMessages: Message[] | undefined =
      (await db.query.messages.findMany({
        where: or(
          and(
            eq(messages.recipientId, chatPartner.id),
            eq(messages.senderId, user.id),
          ),
          and(
            eq(messages.recipientId, user.id),
            eq(messages.senderId, chatPartner.id),
          ),
        ),
        orderBy: (messages, { asc }) => [asc(messages.createdAt)],
      })) as Message[] | undefined;
    if (!chatMessages) throw new Error("Chat messages not found");
    const reversedChatMessages: Message[] = chatMessages.reverse();
    if (!validateMessages(reversedChatMessages))
      throw new Error("Invalid messages");
    initialMessages = reversedChatMessages;
  } catch (e) {
    throw new Error(`Failed to fetch chat messages ${e}`);
  }

  return (
    <div className="flex-1 justify-between flex flex-col h-full max-h-[calc(100vh-6rem)]">
      <div className="flex sm:items-center justify-between py-3 border-b-2 border-gray-200">
        <div className="relative flex items-center space-x-4">
          <div className="relative">
            <div className="relative w-8 sm:w-12 h-8 sm:h-12">
              <Avatar>
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
          </div>

          <div className="flex flex-col leading-tight">
            <div className="text-xl flex items-center">
              <span className="text-gray-700 mr-3 font-semibold">
                {chatPartner.name}
              </span>
            </div>

            <span className="text-sm text-gray-600">{chatPartner.email}</span>
          </div>
        </div>
      </div>

      <MessagesComp
        chatId={chatId}
        chatPartner={chatPartner}
        sessionImg={""}
        sessionId={user.id}
        initialMessages={initialMessages}
      />
      <ChatInput sender={user} receiver={chatPartner} />
    </div>
  );
}
