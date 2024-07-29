import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
export { eq, sql } from "drizzle-orm";

export const getDB = (): string => {
  const db: string | undefined = process.env.DATABASE_URL;

  if (!db || db.length === 0) throw new Error("Missing DATABASE_URL");

  return db;
};

export const pool = new Pool({ connectionString: getDB() });
export const db = drizzle(pool, { schema });
