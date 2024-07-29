import { Redis } from "@upstash/redis";

export const getRedis = (): {
  upatashRedisRestUrl: string;
  upstashRedisRestToken: string;
} => {
  const upatashRedisRestUrl: string | undefined =
    process.env.UPSTASH_REDIS_REST_URL;
  const upstashRedisRestToken: string | undefined =
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!upatashRedisRestUrl || upatashRedisRestUrl.length === 0)
    throw new Error("Missing UPSTASH_REDIS_REST_URL");
  if (!upstashRedisRestToken || upstashRedisRestToken.length === 0)
    throw new Error("Missing UPSTASH_REDIS_REST_TOKEN");

  return {
    upatashRedisRestUrl,
    upstashRedisRestToken,
  };
};

export const redis = new Redis({
  url: getRedis().upatashRedisRestUrl,
  token: getRedis().upstashRedisRestToken,
});
