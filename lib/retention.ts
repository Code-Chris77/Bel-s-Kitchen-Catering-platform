import { drizzle } from "drizzle-orm/d1";
import { and, lt, or, sql } from "drizzle-orm";
import { orders, rateLimits } from "../db/schema";

/** Customer details are kept for this long, then anonymised (totals are kept for accounting). */
export const PERSONAL_DATA_RETENTION_DAYS = 90;

export async function purgeExpiredData(d1: D1Database) {
  const db = drizzle(d1);
  const [anonymised, limits] = await db.batch([
    db
      .update(orders)
      .set({ customerName: "Removed", customerPhone: "", deliveryLocation: null })
      .where(
        and(
          lt(orders.createdAt, sql`datetime('now', ${`-${PERSONAL_DATA_RETENTION_DAYS} days`})`),
          or(
            sql`${orders.customerPhone} != ''`,
            sql`${orders.deliveryLocation} IS NOT NULL`,
            sql`${orders.customerName} != 'Removed'`,
          ),
        ),
      ),
    db.delete(rateLimits).where(lt(rateLimits.windowStart, Math.floor(Date.now() / 1000) - 86_400)),
  ]);
  return {
    anonymisedOrders: anonymised.meta.changes ?? 0,
    expiredRateLimits: limits.meta.changes ?? 0,
  };
}
