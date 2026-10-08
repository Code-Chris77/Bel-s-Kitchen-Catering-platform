import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/** The D1 binding for the current request (real D1 in production, local D1 in dev). */
export function getD1(): D1Database {
  return env.DB;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}
