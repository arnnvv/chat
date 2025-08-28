import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
import { appConfig } from "../config";

export const pool = new Pool({
  connectionString: appConfig.database.connectionString,
});
export const db = drizzle(pool, { schema });
