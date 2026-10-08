import { getD1 } from "@/db";

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
    const db = getD1();
    const row = await db
      .prepare(
        `INSERT INTO rate_limits (key, window_start, count)
        VALUES (?, ?, 1)
        ON CONFLICT(key) DO UPDATE SET count = count + 1
        RETURNING count`,
      )
      .bind(`${bucket.name}:${clientId(request)}:${window}`, now)
      .first<{ count: number }>();

    if (Math.random() < 0.02) {
      await db
        .prepare("DELETE FROM rate_limits WHERE window_start < ?")
        .bind(now - 86_400)
        .run();
    }
    return (row?.count ?? 1) <= bucket.limit;
  } catch (error) {
    console.error("Rate limiter unavailable", error instanceof Error ? error.message : error);
    return true;
  }
}

export function tooManyRequests(bucket: Bucket) {
  return Response.json(
    { error: "Too many attempts. Please wait a few minutes and try again." },
    { status: 429, headers: { "Retry-After": String(bucket.windowSeconds) } },
  );
}
