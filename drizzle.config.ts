import { getDB } from "@/lib/db";
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: getDB(),
  },
  tablesFilter: ["chat_"],
  out: "./drizzle",
} satisfies Config;
