import { getD1 } from "@/db";
import { hasKitchenSession, kitchenUnauthorizedResponse } from "@/lib/kitchen-auth";

const STATUSES = new Set([
  "received",
  "preparing",
  "ready",
  "collected",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await hasKitchenSession(request))) return kitchenUnauthorizedResponse();

    const { id } = await context.params;
    const orderId = Number(id);
    const payload = (await request.json()) as { status?: string };
    const status = typeof payload.status === "string" ? payload.status : "";

    if (!Number.isInteger(orderId) || orderId < 1 || !STATUSES.has(status)) {
      return Response.json({ error: "Invalid order update." }, { status: 400 });
    }

    const db = getD1();
    const current = await db
      .prepare("SELECT order_type, status FROM orders WHERE id = ? LIMIT 1")
      .bind(orderId)
      .first<{ order_type: "delivery" | "dine_in"; status: string }>();

    if (!current) {
      return Response.json({ error: "Order not found." }, { status: 404 });
    }

    const allowedNextStatus =
      current.status === "received"
        ? "preparing"
        : current.status === "preparing"
          ? "ready"
          : current.status === "ready" && current.order_type === "dine_in"
            ? "collected"
            : current.status === "ready"
              ? "out_for_delivery"
              : current.status === "out_for_delivery"
                ? "delivered"
                : null;

    if (status !== allowedNextStatus) {
      return Response.json(
        { error: "This order cannot move to that stage." },
        { status: 409 },
      );
    }

    const result = await db
      .prepare(
        `UPDATE orders
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        RETURNING id, status, updated_at`,
      )
      .bind(status, orderId)
      .first<{ id: number; status: string; updated_at: string }>();

    if (!result) {
      return Response.json({ error: "Order not found." }, { status: 404 });
    }

    return Response.json({
      order: {
        id: result.id,
        orderNumber: result.id,
        status: result.status,
        updatedAt: result.updated_at,
      },
    });
  } catch {
    return Response.json({ error: "The order could not be updated." }, { status: 500 });
  }
}
