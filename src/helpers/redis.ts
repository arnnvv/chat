import { getRedis } from "@/lib/db/cache";

type Command = "zrange" | "sismember" | "get" | "smembers";

export const fetchRedis = async (
  command: Command,
  ...args: (string | number)[]
) => {
  const commandUrl = `${getRedis().upatashRedisRestUrl}/${command}/${args.join("/")}`;
  const response = await fetch(commandUrl, {
    headers: {
      Authorization: `Bearer ${getRedis().upstashRedisRestToken}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `Error executing ${command} command: ${response.statusText}`,
    );
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(`Error in the received data: ${data.error}`);
  }
  return data.result;
};
