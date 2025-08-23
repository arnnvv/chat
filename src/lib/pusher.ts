import PusherServer from "pusher";
import PusherClient from "pusher-js";

const getPusher = (): {
  pusherAppId: string;
  pusherAppKey: string;
  pusherAppSecret: string;
  pusherAppCluster: string;
} => {
  const pusherAppId: string = process.env.PUSHER_APP_ID!;
  const pusherAppKey: string | undefined =
    process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
  const pusherAppSecret: string = process.env.PUSHER_APP_SECRET!;
  const pusherAppCluster: string | undefined =
    process.env.NEXT_PUBLIC_PUSHER_APP_CLUSTER;

  if (!pusherAppKey || pusherAppKey.length === 0)
    throw new Error("Missing PUSHER_APP_KEY");
  if (!pusherAppCluster || pusherAppCluster.length === 0)
    throw new Error("Missing PUSHER_APP_CLUSTER");

  return {
    pusherAppId,
    pusherAppKey,
    pusherAppSecret,
    pusherAppCluster,
  };
};

export const pusherServer = new PusherServer({
  appId: getPusher().pusherAppId,
  key: getPusher().pusherAppKey,
  secret: getPusher().pusherAppSecret,
  cluster: getPusher().pusherAppCluster,
  useTLS: true,
});

export const pusherClient = new PusherClient(getPusher().pusherAppKey, {
  cluster: getPusher().pusherAppCluster,
  authEndpoint: "/api/pusher/auth",
  authTransport: "ajax",
});
