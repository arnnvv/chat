import { redirect } from "next/navigation";
import type { JSX } from "react";
import { getCurrentSession } from "@/actions";
import { FriendRequests } from "@/components/FriendRequests";
import type { FriendRequest, User } from "@/lib/db/schema";
import { getFriendRequests } from "@/lib/getFriendRequests";
import { resolveIdstoUsers } from "@/lib/resolveIdsToUsers";

export default async function page(): Promise<JSX.Element> {
  const { user } = await getCurrentSession();
  if (!user) return redirect("/login");
  const incoming_friend_requests: FriendRequest[] = await getFriendRequests(
    user.id,
  );
  const ids: number[] = incoming_friend_requests.map(
    (req): number => req.requesterId,
  );
  const users: User[] = await resolveIdstoUsers(ids);

  const incommingFriendReqUsers = users.map((user: User) => {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
    };
  });
  return (
    <main className="pt-8">
      <h1 className="font-bold text-5xl mb-8">Add a friend</h1>
      <div className="flex flex-col gap-4">
        <FriendRequests
          incommingFriendReqs={incommingFriendReqUsers}
          sessionId={user.id}
        />
      </div>
    </main>
  );
}
