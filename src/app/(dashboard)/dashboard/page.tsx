import { type JSX, Suspense } from "react";
import {
  RecentChats,
  RecentChatsSkeleton,
} from "@/components/dashboard/RecentChats";

export default function Page(): JSX.Element {
  return (
    <div className="container py-12">
      <h1 className="font-bold text-5xl mb-8">Recent chats</h1>
      <Suspense fallback={<RecentChatsSkeleton />}>
        <RecentChats />
      </Suspense>
    </div>
  );
}
