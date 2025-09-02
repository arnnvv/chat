import { type NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/actions";
import { pusherServer } from "@/lib/pusher-server";
import { globalPOSTRateLimit } from "@/lib/request";

export async function POST(req: NextRequest) {
  if (!(await globalPOSTRateLimit())) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }
  const { user, session } = await getCurrentSession();

  if (!session || !user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const data = await req.formData();
  const socketId = data.get("socket_id") as string;
  const channel = data.get("channel_name") as string;

  if (!socketId || !channel) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  let isAuthorized = false;

  if (channel.startsWith("private-user__")) {
    const channelUserId = Number(channel.split("__")[1]);
    if (user.id === channelUserId) {
      isAuthorized = true;
    }
  }

  if (channel.startsWith("private-chat__")) {
    const chatId = channel.replace(/^private-chat__/, "").replace(/__/g, ":");
    const [userId1, userId2] = chatId.split("--").map(Number);

    if (user.id === userId1 || user.id === userId2) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const userData = {
    user_id: user.id.toString(),
    user_info: {
      username: user.username,
      picture: user.picture,
    },
  };

  const authResponse = pusherServer.authorizeChannel(
    socketId,
    channel,
    userData,
  );
  return NextResponse.json(authResponse);
}
