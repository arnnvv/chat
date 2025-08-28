import PusherServer from "pusher";
import { appConfig } from "./config";

export const pusherServer = new PusherServer({
  appId: appConfig.pusher.appId,
  key: appConfig.pusher.key,
  secret: appConfig.pusher.secret,
  cluster: appConfig.pusher.cluster,
  useTLS: true,
});
