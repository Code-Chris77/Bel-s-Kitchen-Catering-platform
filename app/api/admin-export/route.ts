import { and, desc, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { adminUnauthorizedResponse, hasAdminSession } from "@/lib/admin-auth";
import { logError } from "@/lib/log";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** CSV of paid orders (no customer details), optionally limited to `from`/`to` dates (UTC, inclusive). */
export async function GET(request: Request) {
  if (!(await hasAdminSession(request))) return adminUnauthorizedResponse();

  try {
    const params = new URL(request.url).searchParams;
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    if ((from && !DATE_PATTERN.test(from)) || (to && !DATE_PATTERN.test(to))) {
      return Response.json({ error: "Use dates in YYYY-MM-DD format." }, { status: 400 });
    }

    const rows = await getDb()
      .select({
        id: orders.id,
        createdAt: orders.createdAt,
        orderType: orders.orderType,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        subtotal: orders.subtotal,
        deliveryFee: orders.deliveryFee,
        total: orders.total,
      })
      .from(orders)
      .where(
        and(
          inArray(orders.paymentStatus, ["paid", "demo_paid"]),
          from ? gte(orders.createdAt, from) : undefined,
          to ? lt(orders.createdAt, sql`date(${to}, '+1 day')`) : undefined,
        ),
      )
      .orderBy(desc(orders.id))
      .limit(5000);

    const lines = [
      "order,created_at_utc,type,status,payment_method,subtotal_ghs,delivery_fee_ghs,total_ghs",
      ...rows.map((row) =>
        [
          row.id,
          row.createdAt,
          row.orderType,
          row.status,
          row.paymentMethod,
          row.subtotal,
          row.deliveryFee,
          row.total,
        ].join(","),
      ),
    ];

    return new Response(`${lines.join("\n")}\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="bels-kitchen-orders.csv"',
      },
    });
  } catch (error) {
    logError("admin_export_failed", error);
    return Response.json({ error: "The export could not be created." }, { status: 500 });
  }
}
