import { getD1 } from "@/db";
import { ORDER_STATUSES, canCancel, nextStatus, type OrderType } from "@/lib/domain";
import { hasKitchenSession, kitchenUnauthorizedResponse } from "@/lib/kitchen-auth";
import { logError } from "@/lib/log";

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

    if (
      !Number.isInteger(orderId) ||
      orderId < 1 ||
      !(ORDER_STATUSES as readonly string[]).includes(status)
    ) {
      return Response.json({ error: "Invalid order update." }, { status: 400 });
    }

    const db = getD1();
    const current = await db
      .prepare("SELECT order_type, status FROM orders WHERE id = ? LIMIT 1")
      .bind(orderId)
      .first<{ order_type: OrderType; status: string }>();

    if (!current) {
      return Response.json({ error: "Order not found." }, { status: 404 });
    }

    const allowed =
      status === "cancelled"
        ? canCancel(current.status)
        : status === nextStatus(current.status, current.order_type);
    if (!allowed) {
      return Response.json(
        { error: "This order cannot move to that stage." },
        { status: 409 },
      );
    }

    // Compare-and-swap on the status we validated against, so two kitchen
    // devices cannot both advance (or skip) the same order.
    const [updated] = await db.batch([
      db
        .prepare(
          `UPDATE orders
          SET status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = ?
          RETURNING id, status, updated_at`,
        )
        .bind(status, orderId, current.status),
      // Only logged when the update above actually changed a row.
      db
        .prepare(
          `INSERT INTO order_events (order_id, from_status, to_status, actor)
          SELECT ?, ?, ?, 'kitchen' WHERE changes() > 0`,
        )
        .bind(orderId, current.status, status),
    ]);
    const result = updated.results?.[0] as
      | { id: number; status: string; updated_at: string }
      | undefined;

    if (!result) {
      return Response.json(
        { error: "This order was just updated by someone else. Refresh the queue." },
        { status: 409 },
      );
    }

    return Response.json({
      order: {
        id: result.id,
        orderNumber: result.id,
        status: result.status,
        updatedAt: result.updated_at,
      },
    });
  } catch (error) {
    logError("order_update_failed", error);
    return Response.json({ error: "The order could not be updated." }, { status: 500 });
  }
}
