import { and, eq, or } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import type { JSX } from "react";
import {
  getCurrentSession,
  getPaginatedMessages,
  getVerifiedDeviceIdsForContact,
} from "@/actions";
import ChatInterface from "@/components/ChatInterface";
import { db } from "@/lib/db";
import { friendRequests, users } from "@/lib/db/schema";
import type { SafeUserWithDevices } from "@/lib/safe-user";

export default async function Page({
  params,
}: {
  params: Promise<{
    chatId: string;
  }>;
}): Promise<JSX.Element> {
  const { chatId } = await params;
  const { user: session } = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  const [userId1, userId2] = chatId.split("--").map(Number);
  if (session.id !== userId1 && session.id !== userId2) {
    notFound();
  }
  const chatPartnerId = session.id === userId1 ? userId2 : userId1;

  const friendship = await db.query.friendRequests.findFirst({
    where: and(
      or(
        and(
          eq(friendRequests.requesterId, session.id),
          eq(friendRequests.recipientId, chatPartnerId),
        ),
        and(
          eq(friendRequests.requesterId, chatPartnerId),
          eq(friendRequests.recipientId, session.id),
        ),
      ),
      eq(friendRequests.status, "accepted"),
    ),
    columns: { id: true },
  });

  if (!friendship) {
    notFound();
  }

  const [partnerData, sessionData, verifiedIds, { messages: initialBatch }] =
    await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, chatPartnerId),
        columns: {
          id: true,
          username: true,
          email: true,
          verified: true,
          picture: true,
        },
        with: {
          devices: {
            columns: {
              id: true,
              userId: true,
              publicKey: true,
              identitySigningPublicKey: true,
              name: true,
            },
          },
        },
      }),
      db.query.users.findFirst({
        where: eq(users.id, session.id),
        columns: {
          id: true,
          username: true,
          email: true,
          verified: true,
          picture: true,
        },
        with: {
          devices: {
            columns: {
              id: true,
              userId: true,
              publicKey: true,
              identitySigningPublicKey: true,
              name: true,
            },
          },
        },
      }),
      getVerifiedDeviceIdsForContact(chatPartnerId),
      getPaginatedMessages(chatId, null),
    ]);
  if (!partnerData || !sessionData) {
    notFound();
  }
  const initialUnverifiedDevices = partnerData.devices.filter(
    (d) => !verifiedIds.includes(d.id),
  );
  const initialMessages = initialBatch.reverse();
  return (
    <ChatInterface
      chatId={chatId}
      chatPartner={partnerData as SafeUserWithDevices}
      sessionUser={sessionData as SafeUserWithDevices}
      initialMessages={initialMessages}
      initialUnverifiedDevices={initialUnverifiedDevices}
    />
  );
}
