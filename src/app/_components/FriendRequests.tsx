"use client";

import { acceptFriendRequest, rejectFriendRequest } from "@/actions";
import { type User } from "@/lib/db/schema";
import { pusherClient } from "@/lib/pusher";
import { toPusherKey } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const friendReqHandler = (): void => {
  console.log(`new Friend Request`);
};

export const FriendRequests = ({
  incommingFriendReqs,
  sessionId,
}: {
  incommingFriendReqs: User[];
  sessionId: string;
}): JSX.Element => {
  const [friendReqs, setFriendReqs] = useState<User[]>(incommingFriendReqs);

  useEffect(() => {
    pusherClient.subscribe(
      toPusherKey(`user:${sessionId}:incoming_friend_request`),
    );

    pusherClient.bind(`incoming_friend_request`, friendReqHandler);

    return () => {
      pusherClient.unsubscribe(
        toPusherKey(`user:${sessionId}:incoming_friend_request`),
      );
      pusherClient.unbind(`incoming_friend_request`, friendReqHandler);
    };
  }, [sessionId]);

  return (
    <>
      {friendReqs.length === 0 ? (
        <p className="text-sm italic text-zinc-500">No friend requests..</p>
      ) : (
        friendReqs.map(
          (friendReq: User): JSX.Element => (
            <div key={friendReq.id} className="flex gap-4 items-center">
              <p className="font-medium text-lg">
                {friendReq.name ? friendReq.name : friendReq.email}
              </p>
              <button
                onClick={async (): Promise<void> => {
                  const res = await acceptFriendRequest(
                    friendReq.id,
                    sessionId,
                  );
                  if ("error" in res)
                    toast.error(res.error, {
                      description: "Chat",
                      action: {
                        label: "Undo",
                        onClick: (): string | number =>
                          toast.dismiss(res.error),
                      },
                    });
                  else if ("message" in res)
                    toast.success(res.message, {
                      description: "Chat",
                      action: {
                        label: "Undo",
                        onClick: (): string | number =>
                          toast.dismiss(res.message),
                      },
                    });
                }}
                aria-label="accept friend"
                className="w-8 h-8 bg-cyan-500 hover:bg-cyan-500 grid place-items-center rounded-full transition hover:shadow-md"
              >
                <Check className="font-semibold text-white w-3/4 h-3/4" />
              </button>

              <button
                onClick={async (): Promise<void> => {
                  const res = await rejectFriendRequest(
                    friendReq.id,
                    sessionId,
                  );
                  if ("error" in res)
                    toast.error(res.error, {
                      description: "Chat",
                      action: {
                        label: "Undo",
                        onClick: (): string | number =>
                          toast.dismiss(res.error),
                      },
                    });
                  else if ("message" in res)
                    toast.success(res.message, {
                      description: "Chat",
                      action: {
                        label: "Undo",
                        onClick: (): string | number =>
                          toast.dismiss(res.message),
                      },
                    });
                }}
                aria-label="deny friend"
                className="w-8 h-8 bg-red-600 hover:bg-red-700 grid place-items-center rounded-full transition hover:shadow-md"
              >
                <X className="font-semibold text-white w-3/4 h-3/4" />
              </button>
            </div>
          ),
        )
      )}
    </>
  );
};
