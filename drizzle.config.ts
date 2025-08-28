import { appConfig } from "@/lib/config";
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: appConfig.database.connectionString,
  },
  tablesFilter: ["chat_"],
  out: "./drizzle",
} satisfies Config;
