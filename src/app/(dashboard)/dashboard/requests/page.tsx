import { validateRequest } from "@/actions";
import { FriendRequests } from "@/components/FriendRequests";
import { FriendRequest, User } from "@/lib/db/schema";
import { getFriendRequests } from "@/lib/getFriendRequests";
import { resolveIdstoUsers } from "@/lib/resolveIdsToUsers";
import { redirect } from "next/navigation";

export default async function page(): Promise<JSX.Element> {
  const { user } = await validateRequest();
  if (!user) return redirect("/login");
  const incoming_friend_requests: FriendRequest[] = await getFriendRequests(
    user.id,
  );
  const ids: string[] = incoming_friend_requests.map(
    (req: FriendRequest): string => req.requesterId,
  );
  const users: User[] = await resolveIdstoUsers(ids);

  const incommingFriendReqUsers: Omit<User, "number" | "password">[] =
    users.map((user: User): Omit<User, "number" | "password"> => {
      return {
        id: user.id,
        name: user.name,
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
