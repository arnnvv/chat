import { redis } from "@/lib/db/cache";

export default async function Home(): Promise<JSX.Element> {
  await redis.set("hello", "Hello");
  return <>HI</>;
}
