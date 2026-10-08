import { getD1 } from "@/db";
import { adminUnauthorizedResponse, hasAdminSession } from "@/lib/admin-auth";
import { logError } from "@/lib/log";

type ExportRow = {
  id: number;
  created_at: string;
  order_type: string;
  status: string;
  payment_method: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
};

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

    const result = await getD1()
      .prepare(
        `SELECT id, created_at, order_type, status, payment_method, subtotal, delivery_fee, total
        FROM orders
        WHERE payment_status IN ('paid', 'demo_paid')
          AND (? = '' OR created_at >= ?)
          AND (? = '' OR created_at < date(?, '+1 day'))
        ORDER BY id DESC
        LIMIT 5000`,
      )
      .bind(from, from, to, to)
      .all<ExportRow>();

    const lines = [
      "order,created_at_utc,type,status,payment_method,subtotal_ghs,delivery_fee_ghs,total_ghs",
      ...(result.results ?? []).map((row) =>
        [
          row.id,
          row.created_at,
          row.order_type,
          row.status,
          row.payment_method,
          row.subtotal,
          row.delivery_fee,
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
