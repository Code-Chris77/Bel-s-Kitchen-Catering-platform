import { getD1 } from "@/db";
import { adminUnauthorizedResponse, hasAdminSession } from "@/lib/admin-auth";

type SummaryRow = {
  today_revenue: number;
  month_revenue: number;
  year_revenue: number;
  today_orders: number;
  month_orders: number;
  year_orders: number;
};

type DailyRow = {
  day: string;
  revenue: number;
  order_count: number;
};

type RecentOrderRow = {
  id: number;
  customer_name: string;
  order_type: string;
  total: number;
  status: string;
  payment_method: string;
  created_at: string;
};

export async function GET(request: Request) {
  if (!(await hasAdminSession(request))) return adminUnauthorizedResponse();

  try {
    const db = getD1();
    const [summaryResult, dailyResult, recentResult] = await db.batch([
      db.prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN date(created_at) = date('now') THEN total ELSE 0 END), 0) AS today_revenue,
          COALESCE(SUM(CASE WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now') THEN total ELSE 0 END), 0) AS month_revenue,
          COALESCE(SUM(CASE WHEN strftime('%Y', created_at) = strftime('%Y', 'now') THEN total ELSE 0 END), 0) AS year_revenue,
          COALESCE(SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END), 0) AS today_orders,
          COALESCE(SUM(CASE WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now') THEN 1 ELSE 0 END), 0) AS month_orders,
          COALESCE(SUM(CASE WHEN strftime('%Y', created_at) = strftime('%Y', 'now') THEN 1 ELSE 0 END), 0) AS year_orders
        FROM orders
        WHERE payment_status IN ('paid', 'demo_paid')
          AND status != 'cancelled'`,
      ),
      db.prepare(
        `SELECT date(created_at) AS day, COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS order_count
        FROM orders
        WHERE created_at >= datetime('now', '-13 days')
          AND payment_status IN ('paid', 'demo_paid')
          AND status != 'cancelled'
        GROUP BY date(created_at)
        ORDER BY day DESC`,
      ),
      db.prepare(
        `SELECT id, customer_name, order_type, total, status, payment_method, created_at
        FROM orders
        WHERE payment_status IN ('paid', 'demo_paid')
        ORDER BY id DESC
        LIMIT 40`,
      ),
    ]);

    const summary = (summaryResult.results?.[0] ?? {
      today_revenue: 0,
      month_revenue: 0,
      year_revenue: 0,
      today_orders: 0,
      month_orders: 0,
      year_orders: 0,
    }) as unknown as SummaryRow;

    return Response.json({
      summary: {
        todayRevenue: Number(summary.today_revenue),
        monthRevenue: Number(summary.month_revenue),
        yearRevenue: Number(summary.year_revenue),
        todayOrders: Number(summary.today_orders),
        monthOrders: Number(summary.month_orders),
        yearOrders: Number(summary.year_orders),
      },
      daily: (dailyResult.results ?? []).map((row) => {
        const item = row as unknown as DailyRow;
        return {
          day: item.day,
          revenue: Number(item.revenue),
          orderCount: Number(item.order_count),
        };
      }),
      recentOrders: (recentResult.results ?? []).map((row) => {
        const item = row as unknown as RecentOrderRow;
        return {
          id: item.id,
          orderNumber: item.id,
          customerName: item.customer_name,
          orderType: item.order_type,
          total: Number(item.total),
          status: item.status,
          paymentMethod: item.payment_method,
          createdAt: item.created_at,
        };
      }),
    });
  } catch {
    return Response.json({ error: "The financial dashboard could not be loaded." }, { status: 500 });
  }
}
