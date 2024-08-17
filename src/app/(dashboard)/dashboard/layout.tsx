import { validateRequest } from "@/actions";
import { FriendRequestSidebarOption } from "@/components/FriendRequestSidebarOption";
import { Icon, Icons } from "@/components/Icons";
import { SidebarChatList } from "@/components/SidebarChatList";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FriendRequest, type User } from "@/lib/db/schema";
import { getFriendRequests } from "@/lib/getFriendRequests";
import { getFriends } from "@/lib/getFriends";
import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your dashboard",
};

interface SidebarNavProps {
  id: number;
  name: string;
  href: string;
  Icon: Icon;
}

const sidebarNav: SidebarNavProps[] = [
  {
    id: 1,
    name: "Add friend",
    href: "/dashboard/add",
    Icon: "UserPlus",
  },
];

export default async function page({
  children,
}: {
  children: ReactNode;
}): Promise<JSX.Element> {
  const { user } = await validateRequest();
  if (!user) return redirect("/login");

  const friends: User[] = await getFriends(user.id);
  const unsceenReqCount: FriendRequest[] = await getFriendRequests(user.id);

  return (
    <div className="w-full flex h-screen">
      <div className="flex h-full w-full max-w-xs grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6">
        <Link href="/dashboard" className="flex h-16 shrink-10 items-center">
          <Icons.Logo className="h-8 w-auto text-cyan-400" />
        </Link>
        {friends.length > 0 ? (
          <div className="text-xs font-semibold leading-6 text-gray-400">
            Chats
          </div>
        ) : null}
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <SidebarChatList sessionId={user.id} friends={friends} />
            </li>

            <li>
              <div className="text-xs font-semibold leading-6 text-gray-400">
                Archived
              </div>
              <ul role="list" className="-mx-2 mt-2 space-y-1">
                {sidebarNav.map((opn: SidebarNavProps): JSX.Element => {
                  const Icon = Icons[opn.Icon];
                  return (
                    <li key={opn.id}>
                      <Link
                        href={opn.href}
                        className="text-gray-700 hover:text-cyan-500 hover: bg-gray-50 group flex gap-3 rounded-md p-2 text-sm leading-6 font-semibold"
                      >
                        <span className="text-gray-400 border-gray-200 group-hover:border-b group-hover:text-cyan-500 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white">
                          <Icon className="h-4 w-4" />
                        </span>

                        <span className="truncate">{opn.name}</span>
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <FriendRequestSidebarOption
                    sessionId={user.id}
                    initialUnseenFriendRequests={
                      unsceenReqCount ? unsceenReqCount.length : 0
                    }
                  ></FriendRequestSidebarOption>
                </li>
              </ul>
            </li>

            <li className="-mx-6 mt-auto flex flex-1 items-center gap-x-4 px-6 py-3 text-sm font-semibold leading-6 text-gray-900">
              <div className="flex flex-1 items-center gap-x-4 px-6 py-3 text-sm font-semibold leading-6 text-gray-900">
                <div className="relative h-8 w-8 bg-gray-50">
                  <Avatar>
                    <AvatarImage
                      src="https://github.com/arnnvv.png"
                      alt="@shadcn"
                    />
                    <AvatarFallback>
                      {user.name ? user.name[0] : user.email[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <span className="sr-only">Your profile</span>
                <div className="flex flex-col">
                  <span aria-hidden="true">{user.name}</span>
                  <span className="text-xs text-zinc-400" aria-hidden="true">
                    {user.email}
                  </span>
                </div>
              </div>
            </li>
          </ul>
        </nav>
      </div>

      <aside className="max-h-screen container py-16 md:py-12 w-full">
        {children}
      </aside>
    </div>
  );
}
