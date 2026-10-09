import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { logError } from "@/lib/log";
import { TRACKING_LIMIT, allowRequest, tooManyRequests } from "@/lib/rate-limit";
import { hashTrackingCode, legacyHashTrackingCode } from "@/lib/tracking";

export async function POST(request: Request) {
  if (!(await allowRequest(request, TRACKING_LIMIT))) return tooManyRequests(TRACKING_LIMIT);

  try {
    const payload = (await request.json()) as {
      orderNumber?: number | string;
      trackingCode?: string;
    };
    const orderNumber = Number(payload.orderNumber);
    const trackingCode =
      typeof payload.trackingCode === "string"
        ? payload.trackingCode.replace(/\D/g, "").slice(0, 6)
        : "";

    if (!Number.isInteger(orderNumber) || orderNumber < 1 || trackingCode.length !== 6) {
      return Response.json(
        { error: "Enter a valid order number and 6-digit password." },
        { status: 400 },
      );
    }

    const [keyedHash, legacyHash] = await Promise.all([
      hashTrackingCode(trackingCode),
      legacyHashTrackingCode(trackingCode),
    ]);
    const [order] = await getDb()
      .select({
        id: orders.id,
        orderType: orders.orderType,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        updatedAt: orders.updatedAt,
      })
      .from(orders)
      .where(
        and(
          eq(orders.id, orderNumber),
          inArray(orders.trackingCodeHash, [keyedHash, legacyHash]),
          inArray(orders.paymentStatus, ["paid", "demo_paid"]),
        ),
      )
      .limit(1);

    if (!order) {
      return Response.json(
        { error: "That order number or tracking password is incorrect." },
        { status: 404 },
      );
    }

    return Response.json({
      order: {
        orderNumber: order.id,
        orderType: order.orderType,
        status: order.status,
        paymentStatus: order.paymentStatus,
        updatedAt: order.updatedAt,
      },
    });
  } catch (error) {
    logError("order_status_failed", error);
    return Response.json(
      { error: "Your order progress could not be loaded. Please try again." },
      { status: 500 },
    );
  }
}
