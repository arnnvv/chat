import { validateRequest } from "@/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { db } from "@/lib/db";
import { Message, messages, User } from "@/lib/db/schema";
import { getFriends } from "@/lib/getFriends";
import { chatHrefConstructor } from "@/lib/utils";
import { and, desc, eq, or } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

interface FriendWithLastMsg extends User {
  lastMessage: Message;
}

export default async function Pager(): Promise<JSX.Element> {
  const { user } = await validateRequest();
  if (!user) return redirect("/login");

  const friends: User[] = await getFriends(user.id);

  const friendsWithLastMsg: FriendWithLastMsg[] = await Promise.all(
    friends.map(async (friend: User): Promise<FriendWithLastMsg> => {
      const last: Message[] | undefined = await db
        .select()
        .from(messages)
        .where(
          or(
            and(
              eq(messages.senderId, user.id),
              eq(messages.recipientId, friend.id),
            ),
            and(
              eq(messages.recipientId, user.id),
              eq(messages.senderId, friend.id),
            ),
          ),
        )
        .orderBy(desc(messages.createdAt));

      if (!last) {
        const lastMessage: Message = {
          id: "",
          senderId: "",
          recipientId: "",
          content: " ",
          createdAt: new Date(),
        };
        return { ...friend, lastMessage };
      }
      const lastMessage = last[0];
      return { ...friend, lastMessage };
    }),
  );

  return (
    <div className="container py-12">
      <h1 className="font-bold text-5xl mb-8">Recent chats</h1>
      {friendsWithLastMsg.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing to show here...</p>
      ) : (
        friendsWithLastMsg.map(
          (friend: FriendWithLastMsg): JSX.Element => (
            <div
              key={friend.id}
              className="relative bg-zinc-50 border border-zinc-200 p-3 rounded-md"
            >
              <div className="absolute right-4 inset-y-0 flex items-center">
                <ChevronRight className="h-7 w-7 text-zinc-400" />
              </div>

              <Link
                href={`/dashboard/chat/${chatHrefConstructor(
                  user.id,
                  friend.id,
                )}`}
                className="relative sm:flex"
              >
                <div className="mb-4 flex-shrink-0 sm:mb-0 sm:mr-4">
                  <div className="relative h-6 w-6">
                    <Avatar className="w-8 h-8">
                      <AvatarImage
                        src="https://github.com/arnnvv.png"
                        alt="@shadcn"
                      />
                      <AvatarFallback>
                        {friend.name ? friend.name[0] : friend.email[0]}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold">{friend.name}</h4>
                  <p className="mt-1 max-w-md">
                    <span className="text-zinc-400">
                      {friend.lastMessage.senderId === user.id
                        ? "You: "
                        : `${friend.name}: `}
                    </span>
                    {friend.lastMessage.content}
                  </p>
                </div>
              </Link>
            </div>
          ),
        )
      )}
    </div>
  );
}
