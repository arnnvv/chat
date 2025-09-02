import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { appConfig } from "../config";
import * as schema from "./schema";

export const pool = new Pool({
  connectionString: appConfig.database.connectionString,
});
export const db = drizzle(pool, { schema });
