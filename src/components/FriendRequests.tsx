"use client";

import { Check, UserPlus, X } from "lucide-react";
import { type JSX, useEffect, useState } from "react";
import { toast } from "sonner";
import { acceptFriendRequest, rejectFriendRequest } from "@/actions";
import { pusherClient } from "@/lib/pusher-client";
import { toPusherKey } from "@/lib/utils";

interface IncomingFriendRequest {
  id: number;
  username: string;
  email: string;
}

interface PusherPayload {
  senderId: number;
  senderEmail: string;
  senderName: string;
}

export const FriendRequests = ({
  incommingFriendReqs,
  sessionId,
}: {
  incommingFriendReqs: IncomingFriendRequest[];
  sessionId: number;
}): JSX.Element => {
  const [friendReqs, setFriendReqs] =
    useState<IncomingFriendRequest[]>(incommingFriendReqs);

  useEffect(() => {
    const channelName = toPusherKey(`private-user:${sessionId}`);
    pusherClient.subscribe(channelName);

    const friendReqHandler = (payload: PusherPayload): void => {
      const { senderId, senderEmail, senderName } = payload;
      setFriendReqs((prevReqs) => [
        ...prevReqs,
        {
          id: senderId,
          email: senderEmail,
          username: senderName,
        },
      ]);
    };

    const eventName = "incoming_friend_request";
    pusherClient.bind(eventName, friendReqHandler);

    return () => {
      pusherClient.unsubscribe(channelName);
      pusherClient.unbind(eventName, friendReqHandler);
    };
  }, [sessionId]);

  const handleAccept = async (senderId: number) => {
    const res = await acceptFriendRequest(senderId, sessionId);
    if ("error" in res) {
      toast.error(res.error);
    } else {
      toast.success(res.message);
      setFriendReqs((prev) => prev.filter((req) => req.id !== senderId));
    }
  };

  const handleReject = async (senderId: number) => {
    const res = await rejectFriendRequest(senderId, sessionId);
    if ("error" in res) {
      toast.error(res.error);
    } else {
      toast.success(res.message);
      setFriendReqs((prev) => prev.filter((req) => req.id !== senderId));
    }
  };

  return (
    <>
      {friendReqs.length === 0 ? (
        <p className="text-sm italic text-zinc-500">No friend requests..</p>
      ) : (
        friendReqs.map((friendReq) => (
          <div key={friendReq.id} className="flex gap-4 items-center">
            <UserPlus className="text-black" />
            <p className="font-medium text-lg">
              {friendReq.username || friendReq.email}
            </p>
            <button
              type="button"
              onClick={() => handleAccept(friendReq.id)}
              aria-label="accept friend"
              className="w-8 h-8 bg-cyan-500 hover:bg-cyan-600 grid place-items-center rounded-full transition hover:shadow-md"
            >
              <Check className="font-semibold text-white w-3/4 h-3/4" />
            </button>
            <button
              type="button"
              onClick={() => handleReject(friendReq.id)}
              aria-label="deny friend"
              className="w-8 h-8 bg-red-600 hover:bg-red-700 grid place-items-center rounded-full transition hover:shadow-md"
            >
              <X className="font-semibold text-white w-3/4 h-3/4" />
            </button>
          </div>
        ))
      )}
    </>
  );
};
