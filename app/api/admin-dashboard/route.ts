import { and, count, desc, gte, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { adminUnauthorizedResponse, hasAdminSession } from "@/lib/admin-auth";
import { logError } from "@/lib/log";

const PAID = inArray(orders.paymentStatus, ["paid", "demo_paid"]);

export async function GET(request: Request) {
  if (!(await hasAdminSession(request))) return adminUnauthorizedResponse();

  try {
    const db = getDb();
    const revenueSince = (since: ReturnType<typeof sql>) =>
      sql<number>`COALESCE(SUM(CASE WHEN ${orders.createdAt} >= ${since} THEN ${orders.total} ELSE 0 END), 0)`;
    const ordersSince = (since: ReturnType<typeof sql>) =>
      sql<number>`COALESCE(SUM(CASE WHEN ${orders.createdAt} >= ${since} THEN 1 ELSE 0 END), 0)`;
    const today = sql`date('now')`;
    const monthStart = sql`date('now', 'start of month')`;
    const yearStart = sql`date('now', 'start of year')`;
    const day = sql<string>`date(${orders.createdAt})`;

    const [summaryRows, daily, recent] = await db.batch([
      db
        .select({
          todayRevenue: revenueSince(today),
          monthRevenue: revenueSince(monthStart),
          yearRevenue: revenueSince(yearStart),
          todayOrders: ordersSince(today),
          monthOrders: ordersSince(monthStart),
          yearOrders: count(),
        })
        .from(orders)
        .where(and(gte(orders.createdAt, yearStart), PAID, ne(orders.status, "cancelled"))),
      db
        .select({
          day,
          revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
          orderCount: count(),
        })
        .from(orders)
        .where(
          and(gte(orders.createdAt, sql`datetime('now', '-13 days')`), PAID, ne(orders.status, "cancelled")),
        )
        .groupBy(day)
        .orderBy(desc(day)),
      db
        .select({
          id: orders.id,
          customerName: orders.customerName,
          orderType: orders.orderType,
          total: orders.total,
          status: orders.status,
          paymentMethod: orders.paymentMethod,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(PAID)
        .orderBy(desc(orders.id))
        .limit(40),
    ]);

    const summary = summaryRows[0];
    return Response.json({
      summary: {
        todayRevenue: Number(summary?.todayRevenue ?? 0),
        monthRevenue: Number(summary?.monthRevenue ?? 0),
        yearRevenue: Number(summary?.yearRevenue ?? 0),
        todayOrders: Number(summary?.todayOrders ?? 0),
        monthOrders: Number(summary?.monthOrders ?? 0),
        yearOrders: Number(summary?.yearOrders ?? 0),
      },
      daily: daily.map((row) => ({
        day: row.day,
        revenue: Number(row.revenue),
        orderCount: Number(row.orderCount),
      })),
      recentOrders: recent.map((row) => ({
        id: row.id,
        orderNumber: row.id,
        customerName: row.customerName,
        orderType: row.orderType,
        total: Number(row.total),
        status: row.status,
        paymentMethod: row.paymentMethod,
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    logError("admin_dashboard_failed", error);
    return Response.json({ error: "The financial dashboard could not be loaded." }, { status: 500 });
  }
}
