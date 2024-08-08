import { getFriendRequestsAction } from "@/actions";
import { FriendRequests } from "@/app/_components/FriendRequests";
import { validateRequest } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function page(): Promise<JSX.Element> {
  const { user } = await validateRequest();
  if (!user) return redirect("/login");
  const incoming_friend_requests = await getFriendRequestsAction(user.id);

  return (
    <main className="pt-8">
      <h1 className="font-bold text-5xl mb-8">Add a friend</h1>
      <div className="flex flex-col gap-4">
        <FriendRequests
          incommingFriendReqs={incoming_friend_requests.data}
          sessionId={user.id}
        />
      </div>
    </main>
  );
}
