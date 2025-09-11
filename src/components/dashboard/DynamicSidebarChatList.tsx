import Skeleton from "react-loading-skeleton";
import { getCurrentSession } from "@/actions";
import { SidebarChatList } from "@/components/SidebarChatList";
import { getFriends, type UserWithDevices } from "@/lib/getFriends";

export async function DynamicSidebarChatList() {
  const { user } = await getCurrentSession();
  if (!user) return null;

  const friends: UserWithDevices[] = await getFriends(user.id);

  if (friends.length === 0) return null;

  return (
    <>
      <div className="text-xs font-semibold leading-6 text-gray-400">Chats</div>
      <SidebarChatList sessionId={user.id} friends={friends} />
    </>
  );
}

export function ChatListSkeleton() {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold leading-6 text-gray-400">Chats</div>
      <div className="flex items-center gap-x-3 p-2">
        <Skeleton circle height={32} width={32} />
        <Skeleton height={20} width={120} />
      </div>
      <div className="flex items-center gap-x-3 p-2">
        <Skeleton circle height={32} width={32} />
        <Skeleton height={20} width={150} />
      </div>
    </div>
  );
}
