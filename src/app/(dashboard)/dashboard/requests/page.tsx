import { getFriendRequestsAction } from "@/actions";
import { FriendRequests } from "@/app/_components/FriendRequests";
import { validateRequest } from "@/lib/auth";
import { FriendRequest } from "@/lib/db/schema";
import { redirect } from "next/navigation";

export default async function page(): Promise<JSX.Element> {
  const { user } = await validateRequest();
  if (!user) return redirect("/login");
  const incoming_friend_requests = await getFriendRequestsAction(user.id);
  if (!incoming_friend_requests.data)
    return <div>{incoming_friend_requests.error}</div>;
  const ids: string[] = incoming_friend_requests.data.map(
    (req: FriendRequest): string => req.requesterId,
  );
  return (
    <main className="pt-8">
      <h1 className="font-bold text-5xl mb-8">Add a friend</h1>
      <div className="flex flex-col gap-4">
        <FriendRequests incommingFriendReqIds={ids} sessionId={user.id} />
      </div>
    </main>
  );
}
