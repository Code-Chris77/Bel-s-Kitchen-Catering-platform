import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { ORDER_STATUSES, canCancel, nextStatus, type OrderStatus } from "@/lib/domain";
import { getKitchenSession, kitchenUnauthorizedResponse } from "@/lib/kitchen-auth";
import { logError } from "@/lib/log";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getKitchenSession(request);
    if (!session) return kitchenUnauthorizedResponse();

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
    const target = status as OrderStatus;

    const db = getDb();
    const [current] = await db
      .select({ orderType: orders.orderType, status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!current) {
      return Response.json({ error: "Order not found." }, { status: 404 });
    }

    const allowed =
      target === "cancelled"
        ? canCancel(current.status)
        : target === nextStatus(current.status, current.orderType);
    if (!allowed) {
      return Response.json(
        { error: "This order cannot move to that stage." },
        { status: 409 },
      );
    }

    // Compare-and-swap on the status we validated against, so two kitchen
    // devices cannot both advance (or skip) the same order. A database trigger
    // records the change in order_events using `updated_by`.
    const [result] = await db
      .update(orders)
      .set({ status: target, updatedAt: sql`CURRENT_TIMESTAMP`, updatedBy: session.actor })
      .where(and(eq(orders.id, orderId), eq(orders.status, current.status)))
      .returning({ id: orders.id, status: orders.status, updatedAt: orders.updatedAt });

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
        updatedAt: result.updatedAt,
      },
    });
  } catch (error) {
    logError("order_update_failed", error);
    return Response.json({ error: "The order could not be updated." }, { status: 500 });
  }
}
