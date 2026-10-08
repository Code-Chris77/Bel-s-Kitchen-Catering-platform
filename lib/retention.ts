/** Customer details are kept for this long, then anonymised (totals are kept for accounting). */
export const PERSONAL_DATA_RETENTION_DAYS = 90;

export async function purgeExpiredData(db: D1Database) {
  const [anonymised, limits] = await db.batch([
    db
      .prepare(
        `UPDATE orders
        SET customer_name = 'Removed', customer_phone = '', delivery_location = NULL
        WHERE created_at < datetime('now', ?)
          AND (customer_phone != '' OR delivery_location IS NOT NULL OR customer_name != 'Removed')`,
      )
      .bind(`-${PERSONAL_DATA_RETENTION_DAYS} days`),
    db.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(Math.floor(Date.now() / 1000) - 86_400),
  ]);
  return {
    anonymisedOrders: anonymised.meta.changes ?? 0,
    expiredRateLimits: limits.meta.changes ?? 0,
  };
}
