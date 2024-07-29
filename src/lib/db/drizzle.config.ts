import { type Config } from "drizzle-kit";
import { getDB } from ".";

export default {
  schema: "./schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: getDB(),
  },
  tablesFilter: ["chat_"],
  out: "./drizzle",
} satisfies Config;
