import { lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimits } from "@/db/schema";
import { logError } from "@/lib/log";

type Bucket = { name: string; limit: number; windowSeconds: number };

export const LOGIN_LIMIT: Bucket = { name: "login", limit: 8, windowSeconds: 300 };
export const TRACKING_LIMIT: Bucket = { name: "tracking", limit: 20, windowSeconds: 300 };
export const ORDER_LIMIT: Bucket = { name: "order", limit: 10, windowSeconds: 600 };

function clientId(request: Request) {
  return request.headers.get("cf-connecting-ip") || "unknown";
}

/**
 * Fixed-window counter per client IP, stored in D1. Returns true when the
 * request may proceed. Fails open if the database is unavailable so a limiter
 * fault never takes ordering offline.
 */
export async function allowRequest(request: Request, bucket: Bucket) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / bucket.windowSeconds);
    const db = getDb();
    const [row] = await db
      .insert(rateLimits)
      .values({ key: `${bucket.name}:${clientId(request)}:${window}`, windowStart: now, count: 1 })
      .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } })
      .returning({ count: rateLimits.count });

    if (Math.random() < 0.02) {
      await db.delete(rateLimits).where(lt(rateLimits.windowStart, now - 86_400));
    }
    return (row?.count ?? 1) <= bucket.limit;
  } catch (error) {
    logError("rate_limiter_unavailable", error);
    return true;
  }
}

export function tooManyRequests(bucket: Bucket) {
  return Response.json(
    { error: "Too many attempts. Please wait a few minutes and try again." },
    { status: 429, headers: { "Retry-After": String(bucket.windowSeconds) } },
  );
}
