import { eq } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { JSX } from "react";
import { getCurrentSession } from "@/actions";
import { RecentChatPreview } from "@/components/RecentChatPreview";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  type FriendWithLastMsg,
  getFriendsWithLastMessage,
} from "@/lib/getFriends";
import { chatHrefConstructor } from "@/lib/utils";

export default async function Pager(): Promise<JSX.Element> {
  const { user, session } = await getCurrentSession();
  if (session === null) return redirect("/login");

  const friendsWithLastMsg: FriendWithLastMsg[] =
    await getFriendsWithLastMessage(user.id);

  const sessionUserWithDevices = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    with: {
      devices: {
        columns: {
          id: true,
          publicKey: true,
        },
      },
    },
  });

  if (!sessionUserWithDevices) return redirect("/login");

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
              className="relative bg-zinc-50 border border-zinc-200 p-3 rounded-md mb-2"
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
                        src={friend?.picture || "/default-avatar.png"}
                      />
                      <AvatarFallback>
                        {friend.username ? friend.username[0] : friend.email[0]}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <RecentChatPreview
                  lastMessage={friend.lastMessage}
                  sessionUser={sessionUserWithDevices}
                  friend={friend}
                />
              </Link>
            </div>
          ),
        )
      )}
    </div>
  );
}
