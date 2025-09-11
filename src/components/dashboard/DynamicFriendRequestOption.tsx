import { getCurrentSession } from "@/actions";
import { FriendRequestSidebarOption } from "@/components/FriendRequestSidebarOption";
import type { FriendRequest } from "@/lib/db/schema";
import { getFriendRequests } from "@/lib/getFriendRequests";

export async function DynamicFriendRequestOption() {
  const { user } = await getCurrentSession();
  if (!user) return null;

  const unseenReqCount: FriendRequest[] = await getFriendRequests(user.id);

  return (
    <FriendRequestSidebarOption
      sessionId={user.id}
      initialUnseenFriendRequests={unseenReqCount ? unseenReqCount.length : 0}
    />
  );
}
