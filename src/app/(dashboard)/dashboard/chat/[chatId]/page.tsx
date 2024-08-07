import { ChatInput } from "@/app/_components/ChatInput";
import { MessagesComp } from "@/app/_components/MessagesComp";
import { validateRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { User, users } from "@/lib/db/schema";
import { Messages } from "@/lib/validate";
import { eq } from "drizzle-orm";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";

const getChatMessages = async (chatId: string): Promise<Messages> => {
  let messages: Messages = [];
  return messages;
};

export default async function l({
  params,
}: {
  params: { chatId: string };
}): Promise<JSX.Element> {
  const { chatId } = params;
  const { user } = await validateRequest();
  if (!user) return redirect("/login");
  const [userId1, userId2] = chatId.split("--");
  if (user.id !== userId1 && user.id !== userId2) notFound();
  const chatPartnerId: string = user.id === userId1 ? userId2 : userId1;

  const chatPartner: User | undefined = await db.query.users.findFirst({
    where: eq(users.id, chatPartnerId),
  });

  if (!chatPartner) throw new Error("Chat partner not found");

  const initialMessages: Messages = await getChatMessages(chatId);
  return (
    <div className="flex-1 justify-between flex flex-col h-full max-h-[calc(100vh-6rem)]">
      <div className="flex sm:items-center justify-between py-3 border-b-2 border-gray-200">
        <div className="relative flex items-center space-x-4">
          <div className="relative">
            <div className="relative w-8 sm:w-12 h-8 sm:h-12">
              <Image
                fill
                referrerPolicy="no-referrer"
                src={""}
                alt={`${chatPartner.name} profile picture`}
                className="rounded-full"
              />
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
      <ChatInput chatId={chatId} chatPartner={chatPartner} />
    </div>
  );
}
